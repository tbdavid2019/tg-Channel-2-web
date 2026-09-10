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

// Helper to read DB
function readDb() {
  try {
    if (!fs.existsSync(dbPath)) {
      return { posts: [], channelHistory: [] }
    }
    const data = fs.readFileSync(dbPath, 'utf-8')
    const db = JSON.parse(data)
    return {
      ...db,
      posts: Array.isArray(db.posts) ? db.posts : [],
      channelHistory: Array.isArray(db.channelHistory) ? db.channelHistory : [],
    }
  } catch (error) {
    console.error('Error reading DB:', error)
    return { posts: [], channelHistory: [] }
  }
}

// Helper to write DB with atomic write to prevent corruption across shared containers
function writeDb(data) {
  try {
    const tempPath = `${dbPath}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8')
    fs.renameSync(tempPath, dbPath)
  } catch (error) {
    console.error('Error writing DB:', error)
  }
}

function extractLocalDate(datetime) {
  const tz = process.env.TIMEZONE || 'Asia/Taipei'
  try {
    return dayjs(datetime).tz(tz).format('YYYY-MM-DD')
  } catch {
    return String(datetime || '').split('T')[0]
  }
}

/**
 * Save or update a post in the database
 */
export function savePost(post, channel = '') {
  if (!post.id || !post.datetime) return
  
  const db = readDb()
  const date = extractLocalDate(post.datetime)
  const postChannel = (channel || post.channel || '').toLowerCase()
  
  const existingIndex = db.posts.findIndex(p => (p.channel || '').toLowerCase() === postChannel && p.id == post.id)
  
  const newPost = {
    id: parseInt(post.id),
    channel: postChannel,
    datetime: post.datetime,
    date,
    title: post.title?.substring(0, 200) || '',
    created_at: new Date().toISOString()
  }
  
  if (existingIndex >= 0) {
    db.posts[existingIndex] = { ...db.posts[existingIndex], ...newPost }
  } else {
    db.posts.push(newPost)
  }
  
  // Sort by datetime desc
  db.posts.sort((a, b) => new Date(b.datetime) - new Date(a.datetime))
  
  writeDb(db)
}

/**
 * Save multiple posts at once
 */
export function savePosts(posts, channel = '') {
  if (!posts || posts.length === 0) return
  
  const db = readDb()
  let changed = false
  
  for (const post of posts) {
    if (!post.id || !post.datetime) continue
    
    const date = extractLocalDate(post.datetime)
    const postChannel = (channel || post.channel || '').toLowerCase()
    const existingIndex = db.posts.findIndex(p => (p.channel || '').toLowerCase() === postChannel && p.id == post.id)
    
    const newPost = {
      id: parseInt(post.id),
      channel: postChannel,
      datetime: post.datetime,
      date,
      title: post.title?.substring(0, 200) || '',
      created_at: new Date().toISOString()
    }
    
    if (existingIndex >= 0) {
      db.posts[existingIndex] = { ...db.posts[existingIndex], ...newPost }
      changed = true
    } else {
      db.posts.push(newPost)
      changed = true
    }
  }
  
  if (changed) {
    // Sort by datetime desc
    db.posts.sort((a, b) => new Date(b.datetime) - new Date(a.datetime))
    writeDb(db)
  }
}

const CHANNEL_HISTORY_TTL_MS = 1000 * 60 * 60 * 24 * 7

function isValidHistoryHandle(handle) {
  return /^[a-zA-Z0-9_]{3,64}$/.test(handle || '')
}

function pruneChannelHistory(history, now = Date.now()) {
  const cutoff = now - CHANNEL_HISTORY_TTL_MS
  return history
    .map(entry => ({
      ...entry,
      visits: (Array.isArray(entry.visits) ? entry.visits : [])
        .map(Number)
        .filter(timestamp => Number.isFinite(timestamp) && timestamp >= cutoff),
    }))
    .filter(entry => entry.visits.length > 0)
}

/** Record a successful public channel visit without storing visitor identity. */
export function recordChannelVisit({ handle, title = '', avatar = '', description = '' } = {}) {
  const normalizedHandle = String(handle || '').toLowerCase()
  if (!isValidHistoryHandle(normalizedHandle)) return

  const now = Date.now()
  const db = readDb()
  const history = pruneChannelHistory(db.channelHistory, now)
  const existing = history.find(entry => entry.handle === normalizedHandle)

  if (existing) {
    existing.title = String(title || existing.title || '').slice(0, 200)
    existing.avatar = String(avatar || existing.avatar || '').slice(0, 1000)
    if (description) {
      existing.description = String(description || existing.description || '').slice(0, 500)
    }
    existing.visits.push(now)
    existing.visits = existing.visits.slice(-50000)
  } else {
    history.push({
      handle: normalizedHandle,
      title: String(title || '').slice(0, 200),
      avatar: String(avatar || '').slice(0, 1000),
      description: String(description || '').slice(0, 500),
      visits: [now],
    })
  }

  writeDb({ ...db, channelHistory: history })
}

/** Return the most-used public channels from the rolling seven-day window, with optional pinned slot. */
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
      count: entry.visits.length,
      lastVisitedAt: Math.max(...entry.visits),
    }))
    .sort((a, b) => b.count - a.count || b.lastVisitedAt - a.lastVisitedAt)

  let finalResult = result.slice(0, Math.max(0, limit))

  if (pinHandle) {
    const norm = pinHandle.toLowerCase()
    const inTop = finalResult.some(c => c.handle.toLowerCase() === norm)
    if (!inTop) {
      const pinnedItem = result.find(c => c.handle.toLowerCase() === norm)
      if (pinnedItem) {
        if (finalResult.length >= limit) {
          finalResult[finalResult.length - 1] = pinnedItem
        } else {
          finalResult.push(pinnedItem)
        }
      }
    }
  }

  if (JSON.stringify(history) !== JSON.stringify(db.channelHistory)) {
    writeDb({ ...db, channelHistory: history })
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
      updatedAt: Math.max(...(entry.visits || [Date.now()])),
    }))
}

/**
 * Get dates with posts (for calendar)
 * Returns dates from the last N days using timezone-aware midnight boundaries [Today - (N-1), Tomorrow 00:00:00)
 */
export function getDatesWithPosts(days = 30, channel = '', tz = process.env.TIMEZONE || 'Asia/Taipei') {
  const db = readDb()
  const targetChannel = channel ? channel.toLowerCase() : null
  const todayStart = dayjs().tz(tz).startOf('day')
  const startMs = todayStart.subtract(days - 1, 'day').valueOf()
  const endMs = todayStart.add(1, 'day').valueOf() // Left-closed, Right-open: [Start, Tomorrow 00:00:00)
  
  const dateMap = {}
  
  for (const post of db.posts) {
    if (targetChannel && (post.channel || '').toLowerCase() !== targetChannel) continue
    if (post.datetime) {
      const postMs = new Date(post.datetime).getTime()
      if (postMs >= startMs && postMs < endMs) {
        const localDate = dayjs(post.datetime).tz(tz).format('YYYY-MM-DD')
        dateMap[localDate] = (dateMap[localDate] || 0) + 1
      }
    } else if (post.date) {
      const cutoffStr = todayStart.subtract(days - 1, 'day').format('YYYY-MM-DD')
      if (post.date >= cutoffStr) {
        dateMap[post.date] = (dateMap[post.date] || 0) + 1
      }
    }
  }
  
  return Object.entries(dateMap)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => b.date.localeCompare(a.date))
}

/**
 * Get dates comprising posts for a specific month
 * Uses Half-Open interval [MonthStart 00:00:00, NextMonthStart 00:00:00)
 * @param {string} yearMonth - Format 'YYYY-MM'
 */
export function getDatesByMonth(yearMonth, channel = '', tz = process.env.TIMEZONE || 'Asia/Taipei') {
  const db = readDb()
  const targetChannel = channel ? channel.toLowerCase() : null
  const monthStart = dayjs.tz(`${yearMonth}-01`, tz).startOf('month')
  const startMs = monthStart.valueOf()
  const endMs = monthStart.add(1, 'month').startOf('month').valueOf()
  const dateMap = {}
  
  for (const post of db.posts) {
    if (targetChannel && (post.channel || '').toLowerCase() !== targetChannel) continue
    if (post.datetime) {
      const postMs = new Date(post.datetime).getTime()
      if (postMs >= startMs && postMs < endMs) {
        const localDate = dayjs(post.datetime).tz(tz).format('YYYY-MM-DD')
        dateMap[localDate] = (dateMap[localDate] || 0) + 1
      }
    } else if (post.date && post.date.startsWith(yearMonth)) {
      dateMap[post.date] = (dateMap[post.date] || 0) + 1
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
    if (!p.datetime) return false
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
  const startMs = dayjs.tz(date, tz).startOf('day').valueOf()
  const endMs = dayjs.tz(date, tz).add(1, 'day').startOf('day').valueOf()

  return db.posts.filter(p => {
    if (targetChannel && (p.channel || '').toLowerCase() !== targetChannel) return false
    if (p.datetime) {
      const postMs = new Date(p.datetime).getTime()
      return postMs >= startMs && postMs < endMs
    }
    return p.date === date
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
