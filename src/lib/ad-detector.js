/**
 * Clef-Flash SystemOne Ad Detection Module
 * Evaluates whether Telegram posts are advertisements, sponsored promotions, or spam.
 * Includes Primary + Fallback dual-node redundancy, 30s timeout, and fail-open resilience.
 */

export const CLEF_PRIMARY_URL = 'https://clef.create360.ai/v1/systemone'
export const CLEF_FALLBACK_URL = 'https://clef.aiurl.tw/v1/systemone'
export const CLEF_TIMEOUT_MS = 30000

/**
 * Fast synchronous heuristic classifier for known promo tags, open-source tool sharing,
 * and first-party channel shopping / discount updates.
 * Returns true (definitely ad), false (definitely organic content / tool sharing), or null (requires Clef evaluation).
 *
 * @param {string} text
 * @param {string} [channel] - Optional channel handle for first-party ownership validation
 * @returns {boolean|null}
 */
export function fastHeuristicCheck(text, channel = '') {
  if (!text || typeof text !== 'string') return null

  // 1. Explicit commercial / cross-promotion triggers (instant true)
  const promoPattern = /(?:#[\w\u4e00-\u9fa5]*(?:广告|廣告|商業推廣|商业推广|系统推送|互推|引流|群组推荐|频道互推|赞助|贊助)|(?:互推|引流)[：:]\s*@|飞鸟VPN|红杏云|趣连VPN|一键解锁|高速专线|多端同时在线|专业加密隧道|USDT支付|首充|特惠套餐|8\.8折|小众机场测评|二手机场|看片卡顿|平台受限|线路不稳|不花钱也能用得爽|企业级加密传输)/i
  if (promoPattern.test(text)) {
    return true
  }

  // 2. High-confidence non-ad tool / open-source resource sharing (instant false)
  // Tool and software sharing (e.g. starting with ▎) without commercial triggers is not an ad
  const isToolSharing = /^▎/m.test(text) && /(?:开源|GitHub|离线运行|多平台的|免激活|免费开源|Python 开发|安卓应用|Windows|软件|工具|应用|游戏|播放器|转换器|壁纸|教程|学习|修改版|融合版)/i.test(text)
  if (isToolSharing) {
    return false
  }

  // 3. First-party organic content & shopping / discount channel news without spam triggers (instant false)
  const cleanChan = (channel || '').toLowerCase().replace(/^@/, '').trim()
  if (cleanChan) {
    // If text mentions channel's own domain or brand (e.g. daybuy.tw for daybuy, david888.com for oliservice)
    if (cleanChan.length >= 3 && text.toLowerCase().includes(cleanChan)) {
      return false
    }

    // Specific to shopping deal / store news channels (e.g. daybuy / Costco deals)
    if (cleanChan === 'daybuy' || /(?:好市多|costco|新品情報|優惠情報|特展情報)/i.test(text)) {
      return false
    }
  } else if (/(?:好市多|costco|新品情報|優惠情報|特展情報)/i.test(text)) {
    return false
  }

  return null
}

/**
 * Evaluates whether a post text is an advertisement using Clef-Flash SystemOne.
 *
 * @param {string} text - The post text content to evaluate
 * @param {object} [options]
 * @param {string} [options.channel] - Channel handle for contextual understanding
 * @param {string} [options.primaryUrl] - Custom primary URL override
 * @param {string} [options.fallbackUrl] - Custom fallback URL override
 * @param {number} [options.timeoutMs] - Timeout in milliseconds (default 30s)
 * @param {number} [options.threshold] - Probability threshold for ad (default 0.75)
 * @returns {Promise<boolean>} - true if classified as ad, false otherwise
 */
export async function detectIsAd(text, options = {}) {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return false
  }

  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length < 5) return false

  const primaryUrl = options.primaryUrl || process.env.CLEF_PRIMARY_URL || CLEF_PRIMARY_URL
  const fallbackUrl = options.fallbackUrl || process.env.CLEF_FALLBACK_URL || CLEF_FALLBACK_URL
  const timeoutMs = options.timeoutMs || CLEF_TIMEOUT_MS
  const threshold = options.threshold ?? 0.75
  const channel = options.channel || ''

  // 0. Instant heuristic detection for explicit promo tags, tool sharing, and store news
  if (!options.skipHeuristics) {
    const heuristic = fastHeuristicCheck(text, channel)
    if (heuristic !== null) {
      return heuristic
    }
  }

  const channelHeader = channel ? `Channel: @${channel.replace(/^@/, '')}\n` : ''
  const payload = {
    model: 'clef-flash',
    state: `${channelHeader}Post: ${clean}`.slice(0, 1000),
    questions: {
      is_ad: {
        type: 'noul',
        instructions:
          'Determine if this Telegram post is an intrusive third-party commercial ad, paid sponsor, bot promotion, VPN/proxy service, casino/gambling, crypto shilling, or external cross-promotion (#互推/#系统推送/#引流). The channel author sharing their own organic content, news, store discounts, deal roundups, product arrivals, or own website links is NOT an ad. Is it an intrusive third-party advertisement or spam promotion?',
      },
    },
  }

  // 1. Primary: Clef-Flash GPU Node
  try {
    const res = await fetch(primaryUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    })

    if (res.ok) {
      const data = await res.json()
      const noul = data.answers?.is_ad?.noul
      if (typeof noul === 'number') {
        return noul >= threshold
      }
    }
  } catch (err) {
    console.warn(`[AdDetector] Primary node (${primaryUrl}) failed or timed out: ${err.message}. Trying fallback node...`)
  }

  // 2. Fallback: Clef-Flash-Q4 Node
  try {
    const res = await fetch(fallbackUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    })

    if (res.ok) {
      const data = await res.json()
      const noul = data.answers?.is_ad?.noul
      if (typeof noul === 'number') {
        return noul >= threshold
      }
    }
  } catch (err) {
    console.warn(`[AdDetector] Fallback node (${fallbackUrl}) failed or timed out: ${err.message}.`)
  }

  // 3. Fail-open fallback: Never block or break reading
  return false
}

export default {
  detectIsAd,
  fastHeuristicCheck,
  CLEF_PRIMARY_URL,
  CLEF_FALLBACK_URL,
  CLEF_TIMEOUT_MS,
}
