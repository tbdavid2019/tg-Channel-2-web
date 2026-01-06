import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

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
      return { posts: [] }
    }
    const data = fs.readFileSync(dbPath, 'utf-8')
    return JSON.parse(data)
  } catch (error) {
    console.error('Error reading DB:', error)
    return { posts: [] }
  }
}

// Helper to write DB
function writeDb(data) {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf-8')
  } catch (error) {
    console.error('Error writing DB:', error)
  }
}

/**
 * Save or update a post in the database
 */
export function savePost(post) {
  if (!post.id || !post.datetime) return
  
  const db = readDb()
  const date = post.datetime.split('T')[0] // Extract YYYY-MM-DD
  
  const existingIndex = db.posts.findIndex(p => p.id == post.id)
  
  const newPost = {
    id: parseInt(post.id),
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
export function savePosts(posts) {
  if (!posts || posts.length === 0) return
  
  const db = readDb()
  let changed = false
  
  for (const post of posts) {
    if (!post.id || !post.datetime) continue
    
    const date = post.datetime.split('T')[0]
    const existingIndex = db.posts.findIndex(p => p.id == post.id)
    
    const newPost = {
      id: parseInt(post.id),
      datetime: post.datetime,
      date,
      title: post.title?.substring(0, 200) || '',
      created_at: new Date().toISOString()
    }
    
    if (existingIndex >= 0) {
      // Check if update needed (optional, just update for now)
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

/**
 * Get dates with posts (for calendar)
 * Returns dates from the last N days
 */
export function getDatesWithPosts(days = 30) {
  const db = readDb()
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - days)
  const cutoffStr = cutoffDate.toISOString().split('T')[0]
  
  const dateMap = {}
  
  for (const post of db.posts) {
    if (post.date >= cutoffStr) {
      dateMap[post.date] = (dateMap[post.date] || 0) + 1
    }
  }
  
  return Object.entries(dateMap)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => b.date.localeCompare(a.date))
}

/**
 * Get dates comprising posts for a specific month
 * @param {string} yearMonth - Format 'YYYY-MM'
 */
export function getDatesByMonth(yearMonth) {
  const db = readDb()
  const dateMap = {}
  
  for (const post of db.posts) {
    if (post.date.startsWith(yearMonth)) {
      dateMap[post.date] = (dateMap[post.date] || 0) + 1
    }
  }
  
  return Object.entries(dateMap)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Get post IDs for a specific date
 */
export function getPostIdsByDate(date) {
  const db = readDb()
  const posts = db.posts.filter(p => p.date === date)
  // Already sorted by datetime desc in storage
  return posts
}

/**
 * Get the first post ID for a specific date (for pagination)
 */
export function getFirstPostIdByDate(date) {
  const db = readDb()
  const post = db.posts.find(p => p.date === date)
  // Data is sorted by datetime descending, so first found is latest
  // But usually pagination wants the 'start' cursor which might be the LAST post of the day or FIRST?
  // Telegram 'before' cursor usually means posts older than X. 
  // If we want to show a day's posts, we usually fetch posts for that day from DB directly now.
  // This function might be less relevant if we serve from DB, but keeping API compatible.
  return post?.id
}

/**
 * Get available dates for pagination (returns array of dates with posts)
 */
export function getAvailableDates(days = 30) {
  const dates = getDatesWithPosts(days)
  return dates.map(d => d.date)
}

/**
 * Get previous and next date relative to a given date
 */
export function getAdjacentDates(currentDate, days = 30) {
  const dates = getAvailableDates(days)
  const currentIndex = dates.indexOf(currentDate)
  
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
export function getTotalPostCount() {
  const db = readDb()
  return db.posts.length
}

export default {
  savePost,
  savePosts,
  getDatesWithPosts,
  getDatesByMonth,
  getPostIdsByDate,
  getFirstPostIdByDate,
  getAvailableDates,
  getAdjacentDates,
  getTotalPostCount
}
