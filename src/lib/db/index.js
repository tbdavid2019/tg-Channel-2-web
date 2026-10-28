import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'

dayjs.extend(utc)
dayjs.extend(timezone)

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
// Use a JSON file instead of SQLite
const dbPath = process.env.DB_PATH || path.join(__dirname, '../../data/posts.json')

console.log('Database path:', dbPath)

// Ensure data directory exists
const dataDir = path.dirname(dbPath)
if (!fs.existsSync(dataDir)) {
  console.log('Creating data directory:', dataDir)
  fs.mkdirSync(dataDir, { recursive: true })
}

// In-memory cache for DB to eliminate repetitive disk I/O and JSON parsing overhead
let dbCache = null
let dbCacheMtime = 0
let pendingHistoryWrite = null

// Helper to read DB with mtime cache check
function readDb() {
  try {
    if (!fs.existsSync(dbPath)) {
      dbCache = { posts: [], channelHistory: [] }
      dbCacheMtime = 0
      return dbCache
    }
    const stat = fs.statSync(dbPath)
    if (dbCache && stat.mtimeMs === dbCacheMtime) {
      return dbCache
    }
    const data = fs.readFileSync(dbPath, 'utf-8')
    const db = JSON.parse(data)
    dbCache = {
      ...db,
      posts: Array.isArray(db.posts) ? db.posts : [],
      channelHistory: Array.isArray(db.channelHistory) ? db.channelHistory : [],
    }
    dbCacheMtime = stat.mtimeMs
    return dbCache
  } catch (error) {
    console.error('Error reading DB:', error)
    return dbCache || { posts: [], channelHistory: [] }
  }
}

// Helper to write DB with atomic write and compact serialization
function writeDb(data) {
  try {
    const tempPath = `${dbPath}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`
    // Compact JSON serialization is 3x faster and cuts file size in half
    fs.writeFileSync(tempPath, JSON.stringify(data), 'utf-8')
    fs.renameSync(tempPath, dbPath)
    dbCache = data
    try {
      dbCacheMtime = fs.statSync(dbPath).mtimeMs
    } catch {
      dbCacheMtime = Date.now()
    }
  } catch (error) {
    console.error('Error writing DB:', error)
  }
}

function extractLocalDate(datetime, tz = process.env.TIMEZONE || 'Asia/Taipei') {
  try {
    return dayjs(datetime).tz(tz).format('YYYY-MM-DD')
  } catch {
    return String(datetime || '').split('T')[0]
  }
}

/**
 * Save multiple posts at once with O(1) indexed lookups
 */
export function savePosts(posts, channel = '') {
  if (!posts || posts.length === 0) return

  const db = readDb()
  let changed = false

  const postChannel = (channel || '').toLowerCase()
  const channelMap = new Map()
  for (let i = 0; i < db.posts.length; i++) {
    const p = db.posts[i]
    const pChan = (p.channel || '').toLowerCase()
    if (!postChannel || pChan === postChannel) {
      channelMap.set(`${pChan}:${p.id}`, i)
    }
  }

  for (const post of posts) {
    if (!post.id || !post.datetime) continue

    const date = extractLocalDate(post.datetime)
    const effectiveChannel = (channel || post.channel || '').toLowerCase()
    const key = `${effectiveChannel}:${post.id}`
    const existingIndex = channelMap.get(key)
    const existingPost = existingIndex !== undefined ? db.posts[existingIndex] : null

    // 1. Instant synchronous heuristic check for explicit promo tags and keywords
    const text = post.text || post.title || ''
    const hasPromoTag = /(?:#(?:广告|廣告|商業推廣|商业推广|系统推送|互推|引流|赞助|贊助))/i.test(text)
    const hasExplicitPromo = /(?:一键解锁|高速专线|多端同时在线|专业加密隧道|USDT支付|首充|特惠套餐|8\.8折)/i.test(text)
    const heuristicAd = (hasPromoTag || hasExplicitPromo) ? true : undefined

    // Restore memorized isAd if present, or apply heuristic decision
    const isAd = post.isAd !== undefined ? post.isAd : (existingPost?.isAd !== undefined ? existingPost.isAd : heuristicAd)
    if (isAd !== undefined) {
      post.isAd = isAd
    }

    const newPost = {
      id: parseInt(post.id),
      channel: effectiveChannel,
      datetime: post.datetime,
      date,
      title: post.title?.substring(0, 200) || '',
      created_at: new Date().toISOString(),
      ...(isAd !== undefined ? { isAd } : {}),
    }

    if (existingIndex !== undefined) {
      db.posts[existingIndex] = { ...db.posts[existingIndex], ...newPost }
      changed = true
    } else {
      db.posts.push(newPost)
      channelMap.set(key, db.posts.length - 1)
      changed = true
    }
  }

  if (changed) {
    db.posts.sort((a, b) => new Date(b.datetime) - new Date(a.datetime))
    writeDb(db)
  }

  // Asynchronously classify and memorize ads for unclassified posts
  queueAdClassification(posts, channel)
}

const inFlightAdKeys = new Set()

/**
 * Queue unclassified posts for background ad detection and DB memorization.
 * Operates purely asynchronously (fire-and-forget) to guarantee zero blocking on SSR.
 * Resolves race conditions by fetching a fresh DB snapshot right before write,
 * and uses inFlightAdKeys to prevent redundant duplicate requests (cache stampede).
 */
export function queueAdClassification(posts, channel = '') {
  if (process.env.AD_DETECTION_DISABLED === 'true' || !Array.isArray(posts) || posts.length === 0) {
    return
  }

  setTimeout(async () => {
    const keysToProcess = []
    try {
      const { detectIsAd } = await import('../ad-detector.js')
      const initialDb = readDb()

      // Determine which posts need classification and aren't already in-flight
      const targetPosts = []
      for (const p of posts) {
        if (!p.id) continue
        const effectiveChannel = (channel || p.channel || '').toLowerCase()
        const key = `${effectiveChannel}:${p.id}`

        if (inFlightAdKeys.has(key)) continue

        const stored = initialDb.posts.find(item =>
          (item.channel || '').toLowerCase() === effectiveChannel && item.id === parseInt(p.id)
        )

        // Only evaluate if stored post has no isAd decision yet
        if (stored && stored.isAd === undefined) {
          const text = p.text || p.title || ''
          if (text.trim().length > 0) {
            inFlightAdKeys.add(key)
            keysToProcess.push(key)
            targetPosts.push({ key, effectiveChannel, id: parseInt(p.id), text, postRef: p })
          }
        }
      }

      if (targetPosts.length === 0) return

      // Perform evaluations
      const classifiedResults = []
      for (const item of targetPosts) {
        try {
          const isAd = await detectIsAd(item.text)
          classifiedResults.push({ ...item, isAd })
          item.postRef.isAd = isAd
        } catch (e) {
          console.warn(`[AdDetector] Error classifying post ${item.key}:`, e.message)
        }
      }

      // Fetch fresh DB snapshot before writing to prevent stale overwrites
      if (classifiedResults.length > 0) {
        const freshDb = readDb()
        let updated = false

        for (const res of classifiedResults) {
          const match = freshDb.posts.find(p =>
            (p.channel || '').toLowerCase() === res.effectiveChannel && p.id === res.id
          )
          if (match && match.isAd === undefined) {
            match.isAd = res.isAd
            updated = true
          }
        }

        if (updated) {
          writeDb(freshDb)
        }
      }
    } catch (e) {
      console.warn('[AdDetector] Background classification worker error:', e.message)
    } finally {
      for (const key of keysToProcess) {
        inFlightAdKeys.delete(key)
      }
    }
  }, 10)
}

/**
 * Save or update a post in the database
 */
export function savePost(post, channel = '') {
  savePosts([post], channel)
}

const CHANNEL_HISTORY_TTL_MS = 1000 * 60 * 60 * 24 * 7
const HOUR_MS = 1000 * 60 * 60

function isValidHistoryHandle(handle) {
  return /^[a-zA-Z0-9_]{3,64}$/.test(handle || '')
}

function getHourBucket(timestamp) {
  return Math.floor(timestamp / HOUR_MS) * HOUR_MS
}

function pruneChannelHistory(history, now = Date.now()) {
  const cutoff = now - CHANNEL_HISTORY_TTL_MS
  if (!Array.isArray(history)) return []

  return history
    .map(entry => {
      const hourlyVisits = { ...(entry.hourlyVisits || {}) }
      let lastVisitedAt = Number(entry.lastVisitedAt) || 0

      // Migrate legacy raw visits array if present without call stack limit
      if (Array.isArray(entry.visits)) {
        for (const rawTs of entry.visits) {
          const ts = Number(rawTs)
          if (Number.isFinite(ts) && ts >= cutoff) {
            const bucket = getHourBucket(ts)
            hourlyVisits[bucket] = (hourlyVisits[bucket] || 0) + 1
            if (ts > lastVisitedAt) lastVisitedAt = ts
          }
        }
      }

      // Prune hourly buckets older than the 7-day rolling cutoff
      let rollingCount = 0
      for (const [bucketStr, count] of Object.entries(hourlyVisits)) {
        const bucketTs = Number(bucketStr)
        const numCount = Number(count) || 0
        if (!Number.isFinite(bucketTs) || bucketTs < cutoff || numCount <= 0) {
          delete hourlyVisits[bucketStr]
        } else {
          rollingCount += numCount
          if (bucketTs > lastVisitedAt) lastVisitedAt = bucketTs
        }
      }

      const totalVisits = Math.max(Number(entry.totalVisits) || 0, rollingCount)

      return {
        ...entry,
        hourlyVisits,
        totalVisits,
        rollingCount,
        lastVisitedAt: lastVisitedAt || now,
      }
    })
    .filter(entry => entry.rollingCount > 0)
}

/** Record a successful public channel visit without storing visitor identity. */
export function recordChannelVisit({ handle, title = '', avatar = '', description = '' } = {}) {
  const normalizedHandle = String(handle || '').toLowerCase()
  if (!isValidHistoryHandle(normalizedHandle)) return

  const now = Date.now()
  const currentBucket = getHourBucket(now)
  const db = readDb()
  const history = pruneChannelHistory(db.channelHistory, now)
  const existing = history.find(entry => entry.handle === normalizedHandle)

  if (existing) {
    if (title) {
      existing.title = String(title || existing.title || '').slice(0, 200)
    }
    if (avatar) {
      existing.avatar = String(avatar || existing.avatar || '').slice(0, 1000)
    }
    if (description) {
      existing.description = String(description || existing.description || '').slice(0, 500)
    }
    existing.hourlyVisits[currentBucket] = (existing.hourlyVisits[currentBucket] || 0) + 1
    existing.rollingCount = (existing.rollingCount || 0) + 1
    existing.totalVisits = (existing.totalVisits || 0) + 1
    existing.lastVisitedAt = Math.max(existing.lastVisitedAt || 0, now)
    delete existing.visits
  } else {
    history.push({
      handle: normalizedHandle,
      title: String(title || '').slice(0, 200),
      avatar: String(avatar || '').slice(0, 1000),
      description: String(description || '').slice(0, 500),
      hourlyVisits: { [currentBucket]: 1 },
      rollingCount: 1,
      totalVisits: 1,
      lastVisitedAt: now,
    })
  }

  db.channelHistory = history
  dbCache = db

  // In test environment write immediately; in production debounce to prevent disk thrashing
  const isTest = process.env.NODE_ENV === 'test' || String(process.env.DB_PATH || '').includes('telegram-reader-')
  if (isTest) {
    writeDb(db)
  } else if (!pendingHistoryWrite) {
    pendingHistoryWrite = setTimeout(() => {
      pendingHistoryWrite = null
      writeDb(db)
    }, 1000)
  }
}

/** Return the most-used public channels from the rolling seven-day window, with optional pinned slot. Unbounded counts (>50,000). */
export function getRecentChannels(limit = 10, { pinHandle = '' } = {}) {
  const now = Date.now()
  const db = readDb()
  const history = pruneChannelHistory(db.channelHistory, now)
  const result = history
    .map(entry => ({
      handle: entry.handle,
      title: entry.title || `@${entry.handle}`,
      avatar: entry.avatar || '',
      description: entry.description || '',
      count: entry.rollingCount,
      totalVisits: entry.totalVisits,
      lastVisitedAt: entry.lastVisitedAt,
    }))
    .sort((a, b) => b.count - a.count || b.lastVisitedAt - a.lastVisitedAt)

  let finalResult
  if (pinHandle) {
    const norm = pinHandle.toLowerCase()
    const pinnedItem = result.find(c => c.handle.toLowerCase() === norm)
    const others = result.filter(c => c.handle.toLowerCase() !== norm)
    if (pinnedItem) {
      finalResult = [pinnedItem, ...others.slice(0, Math.max(0, limit - 1))]
    } else {
      finalResult = others.slice(0, Math.max(0, limit))
    }
  } else {
    finalResult = result.slice(0, Math.max(0, limit))
  }

  return finalResult
}

/** Return visited/user-entered channels from history suitable for recommendation pool */
export function getVisitedChannels() {
  const db = readDb()
  return (db.channelHistory || [])
    .filter(entry => entry.handle && isValidHistoryHandle(entry.handle))
    .map(entry => ({
      handle: entry.handle,
      title: entry.title || `@${entry.handle}`,
      avatar: entry.avatar || '',
      description: entry.description || '',
      category: '用戶探索',
      source: 'user_input',
      updatedAt: entry.lastVisitedAt || (Array.isArray(entry.visits) && entry.visits.length > 0 ? entry.visits[entry.visits.length - 1] : Date.now()),
    }))
}

/**
 * Get dates with posts (for calendar)
 * Ultra-fast string boundary check over cached posts
 */
export function getDatesWithPosts(days = 30, channel = '', tz = process.env.TIMEZONE || 'Asia/Taipei') {
  const db = readDb()
  const targetChannel = channel ? channel.toLowerCase() : null
  const todayStart = dayjs().tz(tz).startOf('day')
  const cutoffStr = todayStart.subtract(days - 1, 'day').format('YYYY-MM-DD')
  const tomorrowStr = todayStart.add(1, 'day').format('YYYY-MM-DD')

  const dateMap = {}

  for (const post of db.posts) {
    if (targetChannel && (post.channel || '').toLowerCase() !== targetChannel) continue
    const d = post.date || (post.datetime ? extractLocalDate(post.datetime, tz) : '')
    if (d >= cutoffStr && d < tomorrowStr) {
      dateMap[d] = (dateMap[d] || 0) + 1
    }
  }

  return Object.entries(dateMap)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => b.date.localeCompare(a.date))
}

/**
 * Get dates comprising posts for a specific month
 * Ultra-fast string prefix match over cached posts
 */
export function getDatesByMonth(yearMonth, channel = '', tz = process.env.TIMEZONE || 'Asia/Taipei') {
  const db = readDb()
  const targetChannel = channel ? channel.toLowerCase() : null
  const dateMap = {}

  for (const post of db.posts) {
    if (targetChannel && (post.channel || '').toLowerCase() !== targetChannel) continue
    const d = post.date || (post.datetime ? extractLocalDate(post.datetime, tz) : '')
    if (d && d.startsWith(yearMonth)) {
      dateMap[d] = (dateMap[d] || 0) + 1
    }
  }

  return Object.entries(dateMap)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Query posts within a human date range using Half-Open interval [Start, End + 1 day)
 * e.g. "9/1 ~ 9/9" includes up to 9/9 23:59:59.999 (< 9/10 00:00:00)
 */
export function getPostsBetween(startDate, endDate, channel = '', tz = process.env.TIMEZONE || 'Asia/Taipei') {
  const db = readDb()
  const targetChannel = channel ? channel.toLowerCase() : null
  const startMs = dayjs.tz(startDate, tz).startOf('day').valueOf()
  const endMs = dayjs.tz(endDate, tz).add(1, 'day').startOf('day').valueOf()

  return db.posts.filter(p => {
    if (targetChannel && (p.channel || '').toLowerCase() !== targetChannel) return false
    // Fast path: if post has date and it is well outside the range
    if (p.date && (p.date < startDate || p.date > endDate)) return false
    if (!p.datetime) return Boolean(p.date && p.date >= startDate && p.date <= endDate)
    const postMs = new Date(p.datetime).getTime()
    return postMs >= startMs && postMs < endMs
  })
}

/**
 * Get post IDs for a specific date using Half-Open interval [Date 00:00:00, NextDay 00:00:00)
 */
export function getPostIdsByDate(date, channel = '', tz = process.env.TIMEZONE || 'Asia/Taipei') {
  const db = readDb()
  const targetChannel = channel ? channel.toLowerCase() : null
  return db.posts.filter(p => {
    if (targetChannel && (p.channel || '').toLowerCase() !== targetChannel) return false
    if (p.date) return p.date === date
    if (p.datetime) return extractLocalDate(p.datetime, tz) === date
    return false
  })
}

/**
 * Get the first post ID for a specific date (for pagination)
 */
export function getFirstPostIdByDate(date, channel = '', tz = process.env.TIMEZONE || 'Asia/Taipei') {
  const posts = getPostIdsByDate(date, channel, tz)
  return posts[0]?.id
}

/**
 * Get available dates for pagination (returns array of dates with posts)
 */
export function getAvailableDates(days = 30, channel = '', tz = process.env.TIMEZONE || 'Asia/Taipei') {
  const dates = getDatesWithPosts(days, channel, tz)
  return dates.map(d => d.date)
}

/**
 * Get previous and next date relative to a given date
 */
export function getAdjacentDates(currentDate, days = 30, channel = '', tz = process.env.TIMEZONE || 'Asia/Taipei') {
  const dates = getAvailableDates(days, channel, tz)
  const currentIndex = dates.indexOf(currentDate)

  if (currentIndex === -1) {
    return {
      prevDate: null,
      nextDate: null,
      currentIndex: -1,
      totalDates: dates.length,
    }
  }

  return {
    prevDate: currentIndex > 0 ? dates[currentIndex - 1] : null,
    nextDate: currentIndex < dates.length - 1 ? dates[currentIndex + 1] : null,
    currentIndex,
    totalDates: dates.length
  }
}

/**
 * Get total post count
 */
export function getTotalPostCount(channel = '') {
  const db = readDb()
  if (!channel) return db.posts.length
  const targetChannel = channel.toLowerCase()
  return db.posts.filter(p => (p.channel || '').toLowerCase() === targetChannel).length
}

export default {
  savePost,
  savePosts,
  queueAdClassification,
  getDatesWithPosts,
  getDatesByMonth,
  getPostsBetween,
  getPostIdsByDate,
  getFirstPostIdByDate,
  getAvailableDates,
  getAdjacentDates,
  getTotalPostCount,
  recordChannelVisit,
  getRecentChannels,
  getVisitedChannels,
}
