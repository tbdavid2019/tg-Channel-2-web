import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { getVisitedChannels, recordChannelVisit } from '../db/index.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const bundledSeedPath = path.join(__dirname, '../../data/recommended-channels.json')

export function getBundledSeed() {
  try {
    if (fs.existsSync(bundledSeedPath)) {
      return JSON.parse(fs.readFileSync(bundledSeedPath, 'utf-8'))
    }
  } catch (err) {
    console.warn('Could not read bundled seed:', err.message)
  }
  return []
}

// Persistent cache path (in /app/data volume when deployed in Docker)
const cachePath = process.env.RECOMMENDATIONS_PATH || path.join(__dirname, '../../../data/recommendations-cache.json')

// Cache TTL: 24 hours
const CACHE_TTL_MS = 1000 * 60 * 60 * 24

/**
 * Registry of recommendation sources.
 * Future sources can easily be added here.
 */
export const RECOMMENDATION_SOURCES = [
  {
    id: 'tgnav',
    name: '玩轉電報 (tgnav.com)',
    url: 'https://tgnav.com/',
    parserUrl: 'https://2md.aiurl.tw/tgnav.com',
    backupParserUrls: [
      'https://2md.glsoft.ai/tgnav.com',
      'https://create360.ai/tgnav.com',
    ],
    parse: parseTgNavMarkdown,
  },
]

/**
 * Clean up title and description from raw markdown text
 */
export function cleanTitleDesc(raw) {
  const clean = String(raw || '').replace(/#+/g, ' ').replace(/\s+/g, ' ').trim()
  if (!clean) return { title: '', description: '' }

  if (clean.includes(' - ')) {
    const [t, ...rest] = clean.split(' - ')
    return { title: t.trim(), description: rest.join(' - ').trim() }
  }
  if (clean.includes(' | ')) {
    const [t, ...rest] = clean.split(' | ')
    return { title: t.trim(), description: rest.join(' | ').trim() }
  }
  const spaceIdx = clean.indexOf(' ')
  if (spaceIdx > 0 && spaceIdx <= 30) {
    return { title: clean.slice(0, spaceIdx).trim(), description: clean.slice(spaceIdx + 1).trim() }
  }
  return { title: clean, description: '' }
}

/**
 * Parse Markdown returned by 2md from tgnav.com
 */
export function parseTgNavMarkdown(md) {
  if (!md || typeof md !== 'string') return []

  const lines = md.split('\n')
  let currentCategory = '特別推薦'
  const channels = []
  const seen = new Set()

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('## ')) {
      currentCategory = trimmed.replace(/^##\s*/, '').replace(/[⭐|#]/g, '').trim()
      continue
    }

    const linkRegex = /\[(?:!\[[^\]]*\]\([^)]*\)\s*)?#*\s*([^\]]+)\]\(https?:\/\/t\.me\/([a-zA-Z0-9_]+)(?:\?[^)]*)?\)/g
    let match
    while ((match = linkRegex.exec(trimmed)) !== null) {
      const [_, rawText, handle] = match
      const lower = handle.toLowerCase()

      // Filter out bots, invalid names, and generic search links
      if (lower.endsWith('bot') || lower.length < 3 || lower === 'soso' || lower === 'smss') {
        continue
      }

      if (seen.has(lower)) continue
      seen.add(lower)

      const { title, description } = cleanTitleDesc(rawText)
      channels.push({
        handle,
        title: title || handle,
        description,
        category: currentCategory || '其他',
        source: 'https://tgnav.com/',
        updatedAt: Date.now(),
      })
    }
  }

  return channels
}

/**
 * Atomic write helper to ensure data integrity
 */
function writeCacheFile(data) {
  try {
    const dataDir = path.dirname(cachePath)
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true })
    }
    const tempPath = `${cachePath}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8')
    fs.renameSync(tempPath, cachePath)
  } catch (error) {
    console.error('Error writing recommendations cache:', error)
  }
}

/**
 * Read the local persistent cache file
 */
function readCacheFile() {
  try {
    if (fs.existsSync(cachePath)) {
      const content = fs.readFileSync(cachePath, 'utf-8')
      const parsed = JSON.parse(content)
      if (Array.isArray(parsed.channels) && parsed.channels.length > 0) {
        return parsed
      }
    }
  } catch (error) {
    console.warn('Could not read recommendations cache, falling back:', error.message)
  }
  return null
}

let isSyncing = false

/**
 * Fetch and merge recommendations from all registered sources.
 * If any source or parser is down, existing channels remain safely preserved.
 */
export async function syncRecommendations() {
  if (isSyncing) return
  isSyncing = true

  try {
    const existingCache = readCacheFile()
    const existingChannels = existingCache?.channels || []
    const seedChannels = getBundledSeed()
    const channelMap = new Map()

    // Seed channels first
    for (const c of seedChannels) {
      if (c && c.handle) {
        channelMap.set(c.handle.toLowerCase(), { ...c })
      }
    }
    // Then merge existing runtime cache
    for (const c of existingChannels) {
      if (c && c.handle) {
        channelMap.set(c.handle.toLowerCase(), { ...c })
      }
    }

    const sourceStatus = existingCache?.sources || {}

    for (const source of RECOMMENDATION_SOURCES) {
      const urlsToTry = [source.parserUrl, ...(source.backupParserUrls || [])]
      let fetchedText = null
      let successfulUrl = null

      for (const url of urlsToTry) {
        try {
          const controller = new AbortController()
          const timeout = setTimeout(() => controller.abort(), 12000)
          const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Telegram-Channel-Reader/1.0)' },
            signal: controller.signal,
          })
          clearTimeout(timeout)

          if (res.ok) {
            fetchedText = await res.text()
            successfulUrl = url
            break
          }
        } catch (err) {
          console.warn(`[recommendations] Failed to fetch ${url}:`, err.message)
        }
      }

      if (fetchedText && typeof source.parse === 'function') {
        try {
          const newChannels = source.parse(fetchedText)
          if (newChannels.length > 0) {
            for (const item of newChannels) {
              const key = item.handle.toLowerCase()
              const prev = channelMap.get(key)
              channelMap.set(key, {
                ...prev,
                ...item,
                source: source.url,
                updatedAt: Date.now(),
              })
            }
            sourceStatus[source.id] = {
              status: 'ok',
              url: source.url,
              channelCount: newChannels.length,
              lastFetched: Date.now(),
              endpointUsed: successfulUrl,
            }
          }
        } catch (parseErr) {
          console.error(`[recommendations] Parse error for ${source.id}:`, parseErr)
        }
      } else {
        // If source failed, we KEEP existing channels and record warning
        sourceStatus[source.id] = {
          ...(sourceStatus[source.id] || {}),
          status: 'fetch_failed_retained_cache',
          lastAttempt: Date.now(),
        }
      }
    }

    const mergedChannels = Array.from(channelMap.values())
    writeCacheFile({
      updatedAt: Date.now(),
      sources: sourceStatus,
      channels: mergedChannels,
    })
  } catch (error) {
    console.error('[recommendations] syncRecommendations error:', error)
  } finally {
    isSyncing = false
  }
}

/**
 * Get all available recommended channels.
 * Dynamically incorporates:
 * 1. Curated high-activity seeds
 * 2. Remote directory recommendations (tgnav.com)
 * 3. User-entered and visited channels from history (動態納入使用者自行輸入與瀏覽過的頻道)
 */
export function getRecommendedChannels() {
  const cached = readCacheFile()
  const now = Date.now()

  // Background refresh if expired or no cache
  if (!cached || !cached.updatedAt || now - cached.updatedAt > CACHE_TTL_MS) {
    syncRecommendations().catch(err => console.warn('Background sync error:', err.message))
  }

  const seed = getBundledSeed()
  const channelMap = new Map()

  // 1. Curated seed channels
  for (const item of seed) {
    if (item && item.handle) {
      channelMap.set(item.handle.toLowerCase(), { ...item })
    }
  }

  // 2. Synced channels from remote directory
  if (cached && Array.isArray(cached.channels)) {
    for (const item of cached.channels) {
      if (item && item.handle) {
        channelMap.set(item.handle.toLowerCase(), { ...item })
      }
    }
  }

  // 3. User-entered and visited channels (動態納入使用者自行輸入與瀏覽過的頻道，隨機池非固定)
  try {
    const visited = getVisitedChannels()
    for (const item of visited) {
      if (!item || !item.handle) continue
      const key = item.handle.toLowerCase()
      if (!channelMap.has(key)) {
        channelMap.set(key, {
          handle: item.handle,
          title: item.title || `@${item.handle}`,
          description: item.description || '',
          category: '用戶探索',
          source: 'user_input',
          updatedAt: item.updatedAt || Date.now(),
        })
      } else {
        const existing = channelMap.get(key)
        if (!existing.description && item.description) {
          existing.description = item.description
        }
      }
    }
  } catch (err) {
    console.warn('Could not read user-entered visited channels:', err.message)
  }

  return Array.from(channelMap.values())
}

/**
 * Dynamically register a user-entered channel into the recommendation pool.
 */
export function addUserChannelToPool({ handle, title = '', description = '', category = '用戶探索' } = {}) {
  if (!handle) return false
  const cleanHandle = String(handle).replace(/^@/, '').trim().toLowerCase()
  if (!/^[a-zA-Z0-9_]{3,64}$/.test(cleanHandle)) return false

  recordChannelVisit({
    handle: cleanHandle,
    title: title || `@${cleanHandle}`,
    description,
  })
  return true
}

/**
 * Pick a random channel from the recommendations pool.
 */
export function getRandomChannel(excludeHandle = '') {
  const channels = getRecommendedChannels()
  if (!channels || channels.length === 0) {
    return { handle: 'oliservice', title: '選出潛力股 | 投資新聞濃縮包 | 333', category: '精選' }
  }

  const normalizedExclude = String(excludeHandle || '').toLowerCase()
  const pool = channels.filter(c => c.handle.toLowerCase() !== normalizedExclude)
  const candidateList = pool.length > 0 ? pool : channels

  const randomIndex = Math.floor(Math.random() * candidateList.length)
  return candidateList[randomIndex]
}
