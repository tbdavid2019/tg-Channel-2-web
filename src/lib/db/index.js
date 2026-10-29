import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'
import { detectIsAd, fastHeuristicCheck } from '../ad-detector.js'

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
let pendingPostWrite = null

// High-speed O(1) in-memory lookup indexes
const channelPostMap = new Map() // key: `${channel}:${id}` -> post
const postsByChannel = new Map() // channel -> Array<post>

function rebuildIndex(posts) {
  channelPostMap.clear()
  postsByChannel.clear()
  if (!Array.isArray(posts)) return

  for (const post of posts) {
    if (!post || !post.id) continue
    const ch = (post.channel || '').toLowerCase()
    if (!ch) continue
    const key = `${ch}:${post.id}`
    channelPostMap.set(key, post)

    let list = postsByChannel.get(ch)
    if (!list) {
      list = []
      postsByChannel.set(ch, list)
    }
    list.push(post)
  }
}

// Known scanner probe handles to discard during DB hygiene
const SCANNER_PROBES = new Set([
  'credentials', 'kubeconfig', 'actuator', 'node_modules', 'id_ed25519',
  'printenv', 'drush', 'signup', 'wordpress', 'themes', 'devtools',
  'undefined', 'null', 'wp-admin', 'wp-login', '.env', 'config'
])

// Helper to read DB with mtime cache check and automated data hygiene
function readDb() {
  try {
    if (!fs.existsSync(dbPath)) {
      dbCache = { posts: [], channelHistory: [] }
      dbCacheMtime = 0
      rebuildIndex(dbCache.posts)
      return dbCache
    }
    const stat = fs.statSync(dbPath)
    if (dbCache && stat.mtimeMs === dbCacheMtime) {
      return dbCache
    }
    const data = fs.readFileSync(dbPath, 'utf-8')
    const db = JSON.parse(data)
    
    // Prune invalid channels & scanner garbage, keeping max 1000 newest posts per channel
    const rawPosts = Array.isArray(db.posts) ? db.posts : []
    const validPosts = []
    const channelPostCounts = new Map()

    for (const p of rawPosts) {
      if (!p || !p.id || !p.datetime) continue
      const ch = (p.channel || '').toLowerCase().trim()
      if (!ch || ch === 'undefined' || ch === 'null' || SCANNER_PROBES.has(ch)) continue

      // Reconcile false positive ads (e.g. daybuy store news or tool sharing)
      if (p.isAd === true) {
        const text = p.text || p.title || ''
        const fast = fastHeuristicCheck(text, ch)
        if (fast === false) {
          p.isAd = false
        }
      }
      
      const count = channelPostCounts.get(ch) || 0
      if (count < 1000) {
        validPosts.push(p)
        channelPostCounts.set(ch, count + 1)
      }
    }

    dbCache = {
      ...db,
      posts: validPosts,
      channelHistory: Array.isArray(db.channelHistory) ? db.channelHistory : [],
    }
    dbCacheMtime = stat.mtimeMs
    rebuildIndex(dbCache.posts)
    return dbCache
  } catch (error) {
    console.error('Error reading DB:', error)
    if (!dbCache) {
      dbCache = { posts: [], channelHistory: [] }
      rebuildIndex(dbCache.posts)
    }
    return dbCache
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
    rebuildIndex(dbCache.posts)
  } catch (error) {
    console.error('Error writing DB:', error)
  }
}

function schedulePostWrite(db) {
  const isTest = process.env.NODE_ENV === 'test' || String(process.env.DB_PATH || '').includes('telegram-reader-')
  if (isTest) {
    writeDb(db)
  } else if (!pendingPostWrite) {
    pendingPostWrite = setTimeout(() => {
      pendingPostWrite = null
      writeDb(dbCache || db)
    }, 2000)
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
 * Save multiple posts at once with O(1) indexed lookups and non-blocking debounced writes
 */
export function savePosts(posts, channel = '') {
  if (!posts || posts.length === 0) return

  const db = readDb()
  let changed = false
  const effectiveChannel = (channel || '').toLowerCase().trim()

  for (const post of posts) {
    if (!post.id || !post.datetime) continue

    const postChan = (channel || post.channel || '').toLowerCase().trim()
    if (!postChan || postChan === 'undefined' || SCANNER_PROBES.has(postChan)) continue

    const key = `${postChan}:${post.id}`
    const existingPost = channelPostMap.get(key)

    // 1. Instant synchronous heuristic check for explicit promo tags and software resource sharing
    const text = post.text || post.title || ''
    const fastDecision = fastHeuristicCheck(text, postChan)

    let isAd = undefined
    if (fastDecision !== null) {
      isAd = fastDecision
    } else if (post.isAd !== undefined) {
      isAd = post.isAd
    } else if (existingPost?.isAd !== undefined) {
      isAd = existingPost.isAd
    }

    if (isAd !== undefined) {
      post.isAd = isAd
    }

    if (existingPost) {
      // Only mark changed if isAd status or title actually changed
      if (isAd !== undefined && existingPost.isAd !== isAd) {
        existingPost.isAd = isAd
        changed = true
      }
    } else {
      const date = extractLocalDate(post.datetime)
      const newPost = {
        id: parseInt(post.id),
        channel: postChan,
        datetime: post.datetime,
        date,
        title: post.title?.substring(0, 200) || '',
        created_at: new Date().toISOString(),
        ...(isAd !== undefined ? { isAd } : {}),
      }
      db.posts.push(newPost)
      channelPostMap.set(key, newPost)

      let channelList = postsByChannel.get(postChan)
      if (!channelList) {
        channelList = []
        postsByChannel.set(postChan, channelList)
      }
      channelList.push(newPost)
      changed = true
    }
  }

  if (changed) {
    schedulePostWrite(db)
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
      readDb()

      // Determine which posts need classification and aren't already in-flight
      const targetPosts = []
      for (const p of posts) {
        if (!p.id) continue
        const effectiveChannel = (channel || p.channel || '').toLowerCase().trim()
        const key = `${effectiveChannel}:${p.id}`

        if (inFlightAdKeys.has(key)) continue

        const stored = channelPostMap.get(key)

        // Evaluate if stored post has no isAd decision yet, or if it needs correction
        if (stored) {
          const text = p.text || p.title || ''
          const fastDecision = fastHeuristicCheck(text, effectiveChannel)
          const needsCorrection = stored.isAd === true && fastDecision === false

          if (stored.isAd === undefined || needsCorrection) {
            if (text.trim().length > 0) {
              inFlightAdKeys.add(key)
              keysToProcess.push(key)
              targetPosts.push({ key, effectiveChannel, id: parseInt(p.id), text, postRef: p })
            }
          }
        }
      }

      if (targetPosts.length === 0) return

      // Perform evaluations in parallel batches (up to 5 concurrent) to eliminate CPU/event-loop starvation
      const classifiedResults = []
      const batchSize = 5
      for (let i = 0; i < targetPosts.length; i += batchSize) {
        const batch = targetPosts.slice(i, i + batchSize)
        await Promise.allSettled(
          batch.map(async item => {
            try {
              const isAd = await detectIsAd(item.text, { channel: item.effectiveChannel })
              classifiedResults.push({ ...item, isAd })
              item.postRef.isAd = isAd
            } catch (e) {
              console.warn(`[AdDetector] Error classifying post ${item.key}:`, e.message)
            }
          })
        )
      }

      // Update in-memory map & scheduled write
      if (classifiedResults.length > 0) {
        let updated = false
        for (const res of classifiedResults) {
          const match = channelPostMap.get(res.key)
          if (match && (match.isAd === undefined || match.isAd !== res.isAd)) {
            match.isAd = res.isAd
            updated = true
          }
        }

        if (updated) {
          schedulePostWrite(dbCache)
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
 * Ultra-fast string boundary check over channel-indexed posts
 */
export function getDatesWithPosts(days = 30, channel = '', tz = process.env.TIMEZONE || 'Asia/Taipei') {
  const db = readDb()
  const targetChannel = channel ? channel.toLowerCase().trim() : null
  const candidates = targetChannel ? (postsByChannel.get(targetChannel) || []) : db.posts
  const todayStart = dayjs().tz(tz).startOf('day')
  const cutoffStr = todayStart.subtract(days - 1, 'day').format('YYYY-MM-DD')
  const tomorrowStr = todayStart.add(1, 'day').format('YYYY-MM-DD')

  const dateMap = {}

  for (const post of candidates) {
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
 * Ultra-fast string prefix match over channel-indexed posts
 */
export function getDatesByMonth(yearMonth, channel = '', tz = process.env.TIMEZONE || 'Asia/Taipei') {
  const db = readDb()
  const targetChannel = channel ? channel.toLowerCase().trim() : null
  const candidates = targetChannel ? (postsByChannel.get(targetChannel) || []) : db.posts
  const dateMap = {}

  for (const post of candidates) {
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
  const targetChannel = channel ? channel.toLowerCase().trim() : null
  const candidates = targetChannel ? (postsByChannel.get(targetChannel) || []) : db.posts
  const startMs = dayjs.tz(startDate, tz).startOf('day').valueOf()
  const endMs = dayjs.tz(endDate, tz).add(1, 'day').startOf('day').valueOf()

  return candidates.filter(p => {
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
  const targetChannel = channel ? channel.toLowerCase().trim() : null
  const candidates = targetChannel ? (postsByChannel.get(targetChannel) || []) : db.posts
  return candidates.filter(p => {
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
  const targetChannel = channel.toLowerCase().trim()
  return (postsByChannel.get(targetChannel) || []).length
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
