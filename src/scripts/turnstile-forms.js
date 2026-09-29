const protectedFormSelector = 'form[data-turnstile-action]'

function setStatus(form, message = '', isError = false) {
  const status = form.querySelector('.turnstile-status')
  if (!status) return
  status.textContent = message
  status.hidden = !message
  status.classList.toggle('is-error', isError)
}

function renderWidgets() {
  if (!window.turnstile) return

  for (const container of document.querySelectorAll('[data-turnstile-widget]')) {
    if (container.dataset.turnstileWidgetId || container.getClientRects().length === 0) continue

    const form = container.closest(protectedFormSelector)
    const widgetId = window.turnstile.render(container, {
      sitekey: container.dataset.sitekey,
      action: container.dataset.action,
      size: container.dataset.size || 'normal',
      theme: 'auto',
      callback(token) {
        if (form) {
          form.dataset.turnstileToken = token
          setStatus(form)
        }
      },
      'expired-callback'() {
        if (form) {
          delete form.dataset.turnstileToken
          setStatus(form, '安全驗證已過期，請重新完成驗證。', true)
        }
      },
      'error-callback'() {
        if (form) setStatus(form, '安全驗證載入失敗，請檢查網路後重試。', true)
      },
    })

    container.dataset.turnstileWidgetId = widgetId
  }
}

function loadTurnstile() {
  if (!document.querySelector('[data-turnstile-widget]')) return

  if (window.turnstile) {
    window.turnstile.ready(renderWidgets)
    return
  }

  window.onTurnstileApiReady = renderWidgets
  const script = document.createElement('script')
  script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onTurnstileApiReady'
  script.async = true
  script.defer = true
  document.head.append(script)
}

loadTurnstile()

document.addEventListener('focusin', (event) => {
  if (event.target instanceof Element && event.target.closest(protectedFormSelector)) {
    renderWidgets()
  }
})

document.addEventListener('change', (event) => {
  if (event.target instanceof HTMLInputElement && event.target.matches('.search-icon') && event.target.checked) {
    requestAnimationFrame(renderWidgets)
  }
})

document.addEventListener('submit', async (event) => {
  const form = event.target
  if (!(form instanceof HTMLFormElement) || !form.matches(protectedFormSelector)) return
  if (form.dataset.turnstileVerified === 'true') return

  const widget = form.querySelector('[data-turnstile-widget]')
  const widgetId = widget?.dataset.turnstileWidgetId
  if (!window.turnstile || !widgetId) {
    renderWidgets()
    return
  }

  event.preventDefault()
  event.stopImmediatePropagation()
  if (form.dataset.turnstilePending === 'true') return

  const token = form.dataset.turnstileToken
  if (!token) {
    setStatus(form, '請先完成表單中的安全驗證。', true)
    return
  }

  form.dataset.turnstilePending = 'true'
  setStatus(form, '驗證中…')

  try {
    const response = await fetch('/api/turnstile-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, action: form.dataset.turnstileAction }),
    })
    const result = await response.json()
    if (!response.ok || result.success !== true) throw new Error('verification-failed')

    delete form.dataset.turnstilePending
    form.dataset.turnstileVerified = 'true'
    delete form.dataset.turnstileToken
    setStatus(form)
    form.requestSubmit(event.submitter || undefined)
  } catch {
    delete form.dataset.turnstilePending
    delete form.dataset.turnstileToken
    window.turnstile.reset(widgetId)
    setStatus(form, '驗證未完成，請重新完成驗證後再送出。', true)
  }
}, true)
