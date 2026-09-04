const TELEGRAM_HOSTS = new Set(['t.me', 'telegram.me', 'telegram.dog'])
const USERNAME_PATTERN = /^[A-Za-z0-9_]{5,32}$/

function failure(code, input) {
  return {
    ok: false,
    code,
    url: ['invite', 'private'].includes(code) ? input : '',
  }
}

export function normalizeTelegramTarget(value) {
  const input = String(value ?? '').trim()
  if (!input) return failure('empty', input)

  let handle = input.replace(/^@/, '')
  const looksLikeTelegramUrl = /^(?:https?:\/\/)?(?:www\.)?(?:t\.me|telegram\.me|telegram\.dog)(?:\/|$)/i.test(handle)

  if (looksLikeTelegramUrl) {
    let parsed
    try {
      parsed = new URL(/^https?:\/\//i.test(handle) ? handle : `https://${handle}`)
    }
    catch {
      return failure('invalid', input)
    }

    if (!TELEGRAM_HOSTS.has(parsed.hostname.toLowerCase().replace(/^www\./, ''))) {
      return failure('invalid', input)
    }

    const segments = parsed.pathname.split('/').filter(Boolean)
    const firstSegment = segments[0]?.toLowerCase()

    if (firstSegment === 'joinchat' || segments[0]?.startsWith('+')) {
      return failure('invite', input)
    }

    if (firstSegment === 'c') {
      return failure('private', input)
    }

    handle = firstSegment === 's' ? segments[1] || '' : segments[0] || ''
  }

  if (!USERNAME_PATTERN.test(handle)) return failure('invalid', input)

  return {
    ok: true,
    handle,
    url: `https://t.me/${handle}`,
  }
}
