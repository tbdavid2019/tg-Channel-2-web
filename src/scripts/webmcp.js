import { normalizeTelegramTarget } from '../lib/telegram/normalize.js'

/**
 * WebMCP (Web Model Context Protocol) Implementation for 888 Telegram Channel Browser
 * Compliant with Chrome / W3C WebMCP specification:
 * https://developer.chrome.com/docs/ai/webmcp
 * https://github.com/webmachinelearning/webmcp
 *
 * Technical Provider: david888.com
 */

export const webMcpTools = [
  {
    name: 'navigate-channel',
    description: 'Navigate to any public Telegram channel by handle (@username), bare username, or t.me URL to read its posts and timeline.',
    inputSchema: {
      type: 'object',
      properties: {
        channel: {
          type: 'string',
          description: 'Telegram username, @handle, or t.me link (e.g. "oliservice", "@NewlearnerChannel", "https://t.me/technews_tw")'
        }
      },
      required: ['channel']
    },
    async execute({ channel }) {
      if (!channel) return { ok: false, error: 'Channel input required' }
      const target = normalizeTelegramTarget(channel)
      if (!target.ok) {
        return { ok: false, code: target.code, error: 'Invalid or unsupported channel link' }
      }
      const targetUrl = `/${target.handle}/`
      window.location.assign(targetUrl)
      return { ok: true, handle: target.handle, url: targetUrl }
    }
  },
  {
    name: 'search-articles',
    description: 'Search posts, messages, and tags across the current Telegram channel or website.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Keywords, hashtags, or search terms'
        }
      },
      required: ['query']
    },
    async execute({ query }) {
      if (!query) return { ok: false, error: 'Query required' }
      const searchUrl = `/search/${encodeURIComponent(query.trim())}`
      window.location.assign(searchUrl)
      return { ok: true, query, searchUrl }
    }
  },
  {
    name: 'get-random-channel',
    description: 'Get a random high-activity, curated public Telegram channel recommendation from the 888 discovery pool (tech, news, finance, lifestyle) without navigating away.',
    inputSchema: {
      type: 'object',
      properties: {
        exclude: {
          type: 'string',
          description: 'Channel handle to exclude from selection (optional)'
        }
      }
    },
    async execute({ exclude } = {}) {
      try {
        const url = `/random?json=1${exclude ? '&exclude=' + encodeURIComponent(exclude) : ''}`
        const res = await fetch(url)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        return { ok: true, ...data }
      } catch (err) {
        return { ok: false, error: err.message }
      }
    }
  },
  {
    name: 'navigate-random-channel',
    description: 'Immediately navigate the browser to a random curated public Telegram channel from the recommendation pool.',
    inputSchema: {
      type: 'object',
      properties: {
        exclude: {
          type: 'string',
          description: 'Channel handle to exclude (optional)'
        }
      }
    },
    async execute({ exclude } = {}) {
      const url = `/random${exclude ? '?exclude=' + encodeURIComponent(exclude) : ''}`
      window.location.assign(url)
      return { ok: true, navigatingTo: url }
    }
  },
  {
    name: 'switch-language',
    description: 'Switch the user interface language between Traditional Chinese ("zh-Hant") and English ("en").',
    inputSchema: {
      type: 'object',
      properties: {
        language: {
          type: 'string',
          enum: ['zh-Hant', 'en'],
          description: 'Target language: "zh-Hant" or "en"'
        }
      },
      required: ['language']
    },
    async execute({ language }) {
      if (!['zh-Hant', 'en'].includes(language)) {
        return { ok: false, error: 'Invalid language, must be zh-Hant or en' }
      }
      const targetBtn = document.querySelector(`button[data-language="${language}"]`)
      if (targetBtn instanceof HTMLElement) {
        targetBtn.click()
        return { ok: true, language }
      }
      return { ok: false, error: 'Language button not found' }
    }
  },
  {
    name: 'get-current-channel-info',
    description: 'Extract metadata about the currently viewed channel, including title, handle, description, RSS link, and JSON Feed link.',
    inputSchema: {
      type: 'object',
      properties: {}
    },
    async execute() {
      const title = document.title
      const h1 = document.querySelector('h1')?.textContent?.trim() || ''
      const desc = document.querySelector('meta[name="description"]')?.getAttribute('content') || ''
      const rssLink = document.querySelector('link[type="application/rss+xml"]')?.getAttribute('href') || ''
      const jsonFeedLink = document.querySelector('link[type="application/feed+json"]')?.getAttribute('href') || ''
      const pathname = window.location.pathname
      const handleMatch = pathname.match(/^\/([a-zA-Z0-9_]+)\/?/)
      const currentHandle = handleMatch ? handleMatch[1] : ''

      return {
        ok: true,
        handle: currentHandle,
        title,
        heading: h1,
        description: desc,
        currentUrl: window.location.href,
        rssUrl: rssLink ? new URL(rssLink, window.location.origin).href : '',
        jsonFeedUrl: jsonFeedLink ? new URL(jsonFeedLink, window.location.origin).href : '',
        provider: 'david888.com'
      }
    }
  },
  {
    name: 'filter-by-date',
    description: 'View channel posts for a specific date (YYYY-MM-DD) if available in the timeline.',
    inputSchema: {
      type: 'object',
      properties: {
        date: {
          type: 'string',
          description: 'Date in YYYY-MM-DD format (e.g. 2026-09-08)'
        }
      },
      required: ['date']
    },
    async execute({ date }) {
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return { ok: false, error: 'Invalid date format, expected YYYY-MM-DD' }
      }
      const pathname = window.location.pathname
      const handleMatch = pathname.match(/^\/([a-zA-Z0-9_]+)\/?/)
      if (!handleMatch) {
        return { ok: false, error: 'Not currently viewing a channel page' }
      }
      const targetUrl = `/${handleMatch[1]}/date/${date}`
      window.location.assign(targetUrl)
      return { ok: true, navigatingTo: targetUrl }
    }
  },
  {
    name: 'add-channel-recommendation',
    description: 'Dynamically register a user-entered public Telegram channel into the recommendation pool so it can be discovered via random exploration.',
    inputSchema: {
      type: 'object',
      properties: {
        channel: {
          type: 'string',
          description: 'Telegram username or @handle (e.g. "@oliservice", "technews_tw")'
        }
      },
      required: ['channel']
    },
    async execute({ channel }) {
      if (!channel) return { ok: false, error: 'Channel input required' }
      const target = normalizeTelegramTarget(channel)
      if (!target.ok) return { ok: false, error: 'Invalid channel target' }
      try {
        const res = await fetch(`/random?json=1&add=${encodeURIComponent(target.handle)}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        return {
          ok: true,
          handle: target.handle,
          message: `Added @${target.handle} to recommendation pool`,
          totalPoolCount: data.totalPoolCount,
        }
      } catch (err) {
        return { ok: false, error: err.message }
      }
    }
  }
]

export async function initWebMcp() {
  if (typeof window === 'undefined') return

  if (window.__webmcp_initialized) return
  window.__webmcp_initialized = true

  // Expose global inspector and runner for AI agents, extensions, and testing
  window.__webmcp = {
    version: '1.0.0',
    provider: 'david888.com',
    spec: 'https://developer.chrome.com/docs/ai/webmcp',
    tools: webMcpTools,
    async execute(name, args = {}) {
      const tool = webMcpTools.find(t => t.name === name)
      if (!tool) throw new Error(`[WebMCP] Unknown tool: ${name}`)
      return await tool.execute(args)
    }
  }

  // Register with standard WebMCP document.modelContext or navigator.modelContext
  const context = (typeof document !== 'undefined' && document.modelContext) ||
                  (typeof navigator !== 'undefined' && navigator.modelContext)

  if (context && typeof context.registerTool === 'function') {
    for (const tool of webMcpTools) {
      try {
        await context.registerTool({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
          execute: tool.execute
        })
      } catch (err) {
        // Silently tolerate already-registered tools (e.g. declarative HTML form toolname="search-articles")
        if (err?.name === 'InvalidStateError' || err?.message?.toLowerCase().includes('duplicate')) {
          continue
        }
        console.warn(`[WebMCP] Failed to register tool ${tool.name}:`, err)
      }
    }
    console.info('[WebMCP] Registered tools with modelContext (Technical Provider: david888.com)')
  }

  // Dispatch custom event so in-browser agents know WebMCP is ready
  window.dispatchEvent(new CustomEvent('webmcp-ready', {
    detail: { provider: 'david888.com', tools: webMcpTools }
  }))
}

// Auto-initialize when running in browser
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initWebMcp())
  } else {
    initWebMcp()
  }
}
