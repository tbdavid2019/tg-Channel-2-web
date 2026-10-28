/**
 * Clef-Flash SystemOne Ad Detection Module
 * Evaluates whether Telegram posts are advertisements, sponsored promotions, or spam.
 * Includes Primary + Fallback dual-node redundancy, 30s timeout, and fail-open resilience.
 */

export const CLEF_PRIMARY_URL = 'https://clef.create360.ai/v1/systemone'
export const CLEF_FALLBACK_URL = 'https://clef.aiurl.tw/v1/systemone'
export const CLEF_TIMEOUT_MS = 30000

/**
 * Evaluates whether a post text is an advertisement using Clef-Flash SystemOne.
 *
 * @param {string} text - The post text content to evaluate
 * @param {object} [options]
 * @param {string} [options.primaryUrl] - Custom primary URL override
 * @param {string} [options.fallbackUrl] - Custom fallback URL override
 * @param {number} [options.timeoutMs] - Timeout in milliseconds (default 30s)
 * @param {number} [options.threshold] - Probability threshold for ad (default 0.70)
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
  const threshold = options.threshold ?? 0.70

  const payload = {
    model: 'clef-flash',
    state: clean.slice(0, 1000),
    questions: {
      is_ad: {
        type: 'noul',
        instructions: '這篇貼文是否為商業推廣、導流廣告、詐騙、招攬會員、代購或買賣推薦？',
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
  CLEF_PRIMARY_URL,
  CLEF_FALLBACK_URL,
  CLEF_TIMEOUT_MS,
}
