import { getEnv } from './env.js'

export const DEFAULT_TURNSTILE_SITE_KEY = '0x4AAAAAAEvqf7unH6MrhIv2'
export const TURNSTILE_COOKIE_NAME = 'tg_turnstile_pass'
export const TURNSTILE_COOKIE_MAX_AGE = 86400 // 24 hours in seconds

/**
 * Get Turnstile configuration from environment
 */
export function getTurnstileConfig(env, context) {
  const siteKey = getEnv(env, context, 'TURNSTILE_SITE_KEY') || DEFAULT_TURNSTILE_SITE_KEY
  const secretKey = getEnv(env, context, 'TURNSTILE_SECRET') || getEnv(env, context, 'TURNSTILE_SECRET_KEY')
  const enabledEnv = getEnv(env, context, 'TURNSTILE_ENABLED')

  // Enabled if explicit true or not explicitly disabled and secretKey is provided
  const enabled = enabledEnv !== 'false' && Boolean(secretKey)

  return {
    siteKey,
    secretKey,
    enabled,
  }
}

/**
 * Check if the request path should bypass Turnstile challenge
 */
export function shouldBypassTurnstile(pathname) {
  // Verification endpoint
  if (pathname === '/api/turnstile-verify') {
    return true
  }

  // Machine discovery & feeds
  if (
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml' ||
    pathname.startsWith('/sitemap/') ||
    pathname === '/rss.xml' ||
    pathname === '/rss.json' ||
    pathname === '/llms.txt' ||
    pathname === '/mcp' ||
    pathname.startsWith('/mcp/') ||
    pathname.startsWith('/docs/') ||
    pathname.startsWith('/.well-known/')
  ) {
    return true
  }

  // Internal static assets & scripts
  if (
    pathname.startsWith('/_astro/') ||
    pathname.startsWith('/fonts/') ||
    pathname.startsWith('/static/') ||
    pathname.startsWith('/rules/')
  ) {
    return true
  }

  // File extensions (static media, assets)
  if (/\.(?:svg|png|jpe?g|gif|webp|ico|css|js|mjs|woff2?|ttf|eot|txt|xml|json|map)$/i.test(pathname)) {
    return true
  }

  return false
}

/**
 * Verify Turnstile token with Cloudflare API
 */
export async function verifyTurnstileToken({ secretKey, token, clientIp }) {
  if (!token || typeof token !== 'string' || token.length > 4096) {
    return { success: false, error: 'invalid-token' }
  }

  if (!secretKey) {
    return { success: false, error: 'missing-secret' }
  }

  try {
    const formData = new URLSearchParams()
    formData.append('secret', secretKey)
    formData.append('response', token)
    if (clientIp) {
      formData.append('remoteip', clientIp)
    }

    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData,
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) {
      return { success: false, error: `http-${res.status}` }
    }

    const data = await res.json()
    return {
      success: data.success === true,
      data,
      errorCodes: data['error-codes'],
    }
  } catch (err) {
    return { success: false, error: err?.message || 'network-error' }
  }
}

/**
 * Create a crypto HMAC key using Web Crypto API
 */
async function getCryptoKey(secret) {
  const encoder = new TextEncoder()
  return await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  )
}

/**
 * Create a signed clearance cookie value
 */
export async function createClearanceCookie(secret, userAgent = '') {
  const timestamp = Date.now().toString()
  const uaPart = (userAgent || '').slice(0, 64)
  const message = `${timestamp}:${uaPart}`
  const encoder = new TextEncoder()
  const key = await getCryptoKey(secret)
  const sigBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(message))
  const sigHex = Array.from(new Uint8Array(sigBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  return `${timestamp}.${sigHex}`
}

/**
 * Validate a signed clearance cookie value
 */
export async function validateClearanceCookie(cookieValue, secret, userAgent = '', maxAgeMs = TURNSTILE_COOKIE_MAX_AGE * 1000) {
  if (!cookieValue || typeof cookieValue !== 'string') return false
  const parts = cookieValue.split('.')
  if (parts.length !== 2) return false

  const [timestampStr, sigHex] = parts
  const timestamp = Number.parseInt(timestampStr, 10)
  if (Number.isNaN(timestamp)) return false

  // Check TTL
  const now = Date.now()
  if (now - timestamp > maxAgeMs || timestamp > now + 60000) {
    return false
  }

  try {
    const uaPart = (userAgent || '').slice(0, 64)
    const message = `${timestampStr}:${uaPart}`
    const encoder = new TextEncoder()
    const key = await getCryptoKey(secret)

    const match = sigHex.match(/.{1,2}/g)
    if (!match) return false
    const sigBytes = new Uint8Array(match.map(byte => Number.parseInt(byte, 16)))

    return await crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(message))
  } catch {
    return false
  }
}

/**
 * Render the branded Turnstile Challenge HTML page
 */
export function renderChallengePage({ siteKey, brand = '888 Telegram 頻道瀏覽器' }) {
  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>安全驗證 ｜ ${brand}</title>
  <meta name="robots" content="noindex, nofollow">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
  <style>
    :root {
      --bg: #f8fafc;
      --card-bg: #ffffff;
      --text-main: #0f172a;
      --text-muted: #64748b;
      --border: #e2e8f0;
      --primary: #2563eb;
      --shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #0b0f17;
        --card-bg: #151d2c;
        --text-main: #f1f5f9;
        --text-muted: #94a3b8;
        --border: #1e293b;
        --primary: #3b82f6;
        --shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
      }
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background-color: var(--bg);
      color: var(--text-main);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
    }
    .card {
      background-color: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 1rem;
      padding: 2.25rem 2rem;
      max-width: 440px;
      width: 100%;
      text-align: center;
      box-shadow: var(--shadow);
    }
    .icon-wrap {
      width: 54px;
      height: 54px;
      background: rgba(37, 99, 235, 0.1);
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 1.25rem;
      color: var(--primary);
    }
    .icon-wrap svg {
      width: 28px;
      height: 28px;
    }
    h1 {
      font-size: 1.35rem;
      font-weight: 700;
      margin-bottom: 0.5rem;
      letter-spacing: -0.02em;
    }
    p {
      color: var(--text-muted);
      font-size: 0.925rem;
      line-height: 1.5;
      margin-bottom: 1.5rem;
    }
    .widget-container {
      display: flex;
      justify-content: center;
      margin: 1.25rem 0;
      min-height: 65px;
    }
    .status {
      font-size: 0.85rem;
      color: var(--text-muted);
      margin-top: 0.5rem;
      transition: all 0.2s;
    }
    .status.error {
      color: #ef4444;
    }
    .footer-note {
      margin-top: 1.75rem;
      font-size: 0.775rem;
      color: var(--text-muted);
      opacity: 0.75;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon-wrap">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
      </svg>
    </div>
    <h1>安全檢查 ｜ Security Check</h1>
    <p>正在確認您的瀏覽器連線環境，通過驗證後將自動前往內容。</p>
    
    <div class="widget-container">
      <div
        class="cf-turnstile"
        data-sitekey="${siteKey}"
        data-callback="onTurnstileSuccess"
        data-error-callback="onTurnstileError"
        data-action="site_access"
        data-theme="auto"
      ></div>
    </div>
    
    <div id="status-msg" class="status">驗證進行中...</div>
    <div class="footer-note">${brand} · 防護系統由 Cloudflare Turnstile 提供</div>
  </div>

  <script>
    async function onTurnstileSuccess(token) {
      const statusEl = document.getElementById('status-msg');
      statusEl.innerText = '驗證成功，正在進入頁面...';
      try {
        const res = await fetch('/api/turnstile-verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        });
        const data = await res.json();
        if (data.success) {
          window.location.reload();
        } else {
          statusEl.innerText = '安全檢驗未通過，請重新整理頁面。';
          statusEl.classList.add('error');
        }
      } catch (err) {
        statusEl.innerText = '連線失敗，請檢查網路連線後重試。';
        statusEl.classList.add('error');
      }
    }

    function onTurnstileError() {
      const statusEl = document.getElementById('status-msg');
      statusEl.innerText = '驗證載入失敗，請重試或允許第三方 JavaScript。';
      statusEl.classList.add('error');
    }
  </script>
</body>
</html>`
}
