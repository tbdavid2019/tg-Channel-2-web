const targetWhitelist = [
  't.me',
  'telegram.org',
  'telegram.me',
  'telegram.dog',
  'cdn-telegram.org',
  'telesco.pe',
  'yandex.ru',
]

function isDisallowedHost(hostname) {
  return (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    /^127\./.test(hostname) ||
    /^10\./.test(hostname) ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^169\.254\./.test(hostname) ||
    hostname === '::1' ||
    hostname === '0.0.0.0'
  )
}

export async function GET({ params, url }) {
  try {
    const rawTarget = params.url.includes('?') ? params.url : params.url + url.search
    const target = new URL(rawTarget)

    if (!['http:', 'https:'].includes(target.protocol)) {
      return new Response('Invalid protocol', { status: 400 })
    }

    const hostname = target.hostname.toLowerCase()
    if (isDisallowedHost(hostname)) {
      return new Response('Forbidden', { status: 403 })
    }

    const isWhitelisted = targetWhitelist.some(
      domain => hostname === domain || hostname.endsWith('.' + domain)
    )

    if (!isWhitelisted) {
      return new Response('Forbidden: domain not permitted', { status: 403 })
    }

    const response = await fetch(target.toString(), {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BroadcastChannelProxy/1.0)',
        'Accept': '*/*',
      },
    })
    return new Response(response.body, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'application/octet-stream',
        'Cache-Control': response.headers.get('Cache-Control') || 'public, max-age=86400',
      },
    })
  }
  catch (error) {
    return new Response(error.message, { status: 500 })
  }
}

