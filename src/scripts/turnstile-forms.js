const protectedFormSelector = 'form[data-turnstile-action]'
const TURNSTILE_COOKIE_NAME = 'tg_turnstile_cleared'

let globalWidgetId = null
let currentToken = null
let pendingResolver = null

function hasClearance() {
  try {
    if (sessionStorage.getItem(TURNSTILE_COOKIE_NAME) === '1') return true
    const cookies = document.cookie ? document.cookie.split(';') : []
    return cookies.some(c => c.trim().startsWith(`${TURNSTILE_COOKIE_NAME}=`))
  } catch {
    return false
  }
}

function markClearance() {
  try {
    sessionStorage.setItem(TURNSTILE_COOKIE_NAME, '1')
  } catch {}
}

function loadTurnstileScript() {
  if (window.turnstile || document.getElementById('cf-turnstile-script')) return
  const script = document.createElement('script')
  script.id = 'cf-turnstile-script'
  script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
  script.async = true
  script.defer = true
  document.head.append(script)
}

function getGlobalContainer() {
  let container = document.getElementById('cf-turnstile-global')
  if (!container) {
    container = document.createElement('div')
    container.id = 'cf-turnstile-global'
    container.style.cssText = 'display:none;position:fixed;bottom:16px;right:16px;z-index:99999;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,0.15);'
    document.body.append(container)
  }
  return container
}

function acquireTurnstileToken(action = 'channel_search') {
  if (hasClearance()) return Promise.resolve('')

  loadTurnstileScript()
  const container = getGlobalContainer()

  return new Promise((resolve) => {
    pendingResolver = resolve

    const checkReady = () => {
      if (!window.turnstile) {
        setTimeout(checkReady, 50)
        return
      }

      // Show container smoothly
      container.style.display = 'block'

      if (globalWidgetId !== null) {
        try {
          window.turnstile.reset(globalWidgetId)
        } catch {
          globalWidgetId = null
        }
      }

      if (globalWidgetId === null) {
        const siteKey = container.dataset.sitekey || '0x4AAAAAAEvqf7unH6MrhIv2'
        try {
          globalWidgetId = window.turnstile.render(container, {
            sitekey: siteKey,
            action,
            size: 'flexible',
            theme: 'auto',
            callback(token) {
              currentToken = token
              container.style.display = 'none'
              if (pendingResolver) {
                const cb = pendingResolver
                pendingResolver = null
                cb(token)
              }
            },
            'expired-callback'() {
              currentToken = null
            },
            'error-callback'() {
              container.style.display = 'none'
              if (pendingResolver) {
                const cb = pendingResolver
                pendingResolver = null
                cb('')
              }
            },
          })
        } catch {
          container.style.display = 'none'
          if (pendingResolver) {
            const cb = pendingResolver
            pendingResolver = null
            cb('')
          }
        }
      }
    }

    checkReady()
  })
}

// Preload Turnstile script quietly in background so it's warm when needed
if (typeof window !== 'undefined') {
  if (!hasClearance()) {
    setTimeout(loadTurnstileScript, 1000)
  }
}

// Intercept form submissions
document.addEventListener('submit', async (event) => {
  const form = event.target
  if (!(form instanceof HTMLFormElement) || !form.matches(protectedFormSelector)) return
  if (form.dataset.turnstileVerified === 'true') return

  // 1. Fast Path: If already cleared by cookie/session, submit immediately with 0 delay!
  if (hasClearance()) {
    form.dataset.turnstileVerified = 'true'
    return
  }

  // 2. Slow Path: Needs verification
  event.preventDefault()
  event.stopImmediatePropagation()

  const submitBtn = form.querySelector('button[type="submit"]')
  const originalBtnText = submitBtn?.textContent || ''
  if (submitBtn) {
    submitBtn.disabled = true
    submitBtn.dataset.originalText = originalBtnText
    submitBtn.textContent = '驗證中…'
  }

  const action = form.dataset.turnstileAction || 'channel_search'

  try {
    const token = await acquireTurnstileToken(action)
    if (!token) {
      // Degraded / fail-open fallback: let request proceed so user is never stuck
      form.dataset.turnstileVerified = 'true'
      form.requestSubmit()
      return
    }

    // Verify token with backend
    const response = await fetch('/api/turnstile-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, action }),
    })

    const result = await response.json()
    if (response.ok && result.success) {
      markClearance()
    }
  } catch (err) {
    console.warn('[Turnstile] Verification error, proceeding with fallback:', err)
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false
      submitBtn.textContent = submitBtn.dataset.originalText || originalBtnText
    }
    form.dataset.turnstileVerified = 'true'
    form.requestSubmit()
  }
}, true)
