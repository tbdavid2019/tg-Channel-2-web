import { getEnv, ASSET_VERSION } from './lib/env.js'
import {
  getTurnstileConfig,
  shouldBypassTurnstile,
  validateClearanceCookie,
  renderChallengePage,
  TURNSTILE_COOKIE_NAME,
} from './lib/turnstile.js'

export async function onRequest(context, next) {
  const turnstileConfig = getTurnstileConfig(import.meta.env, context)
  context.locals.TURNSTILE_SITE_KEY = turnstileConfig.siteKey

  const pathname = context.url.pathname

  if (turnstileConfig.enabled && !shouldBypassTurnstile(pathname)) {
    const cookieHeader = context.request.headers.get('cookie') || ''
    const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${TURNSTILE_COOKIE_NAME}=([^;]+)`))
    const cookieValue = match ? decodeURIComponent(match[1]) : null
    const userAgent = context.request.headers.get('user-agent') || ''

    const isCleared = cookieValue
      ? await validateClearanceCookie(cookieValue, turnstileConfig.secretKey, userAgent)
      : false

    if (!isCleared) {
      const challengeHtml = renderChallengePage({
        siteKey: turnstileConfig.siteKey,
        brand: '888 Telegram 頻道瀏覽器',
      })
      return new Response(challengeHtml, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'private, no-store, max-age=0, must-revalidate',
        },
      })
    }
  }

  const anyChannel = getEnv(import.meta.env, context, 'ANYCHANNEL') === 'true'
  const defaultChannel = getEnv(import.meta.env, context, 'CHANNEL')
  const channelParam = context.params?.channel

  if (!anyChannel && channelParam && channelParam.toLowerCase() !== defaultChannel?.toLowerCase()) {
    return context.redirect('/', 302)
  }

  context.locals.SITE_URL = `${import.meta.env.SITE ?? ''}${import.meta.env.BASE_URL}`
  context.locals.RSS_URL = `${context.locals.SITE_URL}rss.xml`
  context.locals.RSS_PREFIX = ''

  if (context.url.pathname.startsWith('/search') && context.params.q?.startsWith('#')) {
    const tag = context.params.q.replace('#', '')
    context.locals.RSS_URL = `${context.locals.SITE_URL}rss.xml?tag=${tag}`
    context.locals.RSS_PREFIX = `${tag} | `
  }

  const response = await next()
  const agentDiscoveryLinks = [
    '</llms.txt>; rel="describedby"; type="text/plain"',
    '</docs/agent-guide.md>; rel="describedby"; type="text/markdown"',
    '</.well-known/agent-skills/index.json>; rel="describedby"; type="application/json"',
    '</rss.xml>; rel="alternate"; type="application/rss+xml"',
    '</rss.json>; rel="alternate"; type="application/feed+json"',
  ]

  const faviconLinks = [
    `</favicon.svg?v=${ASSET_VERSION}>; rel="icon"; type="image/svg+xml"`,
    `</favicon-32x32.png?v=${ASSET_VERSION}>; rel="icon"; type="image/png"`,
    `</favicon.ico?v=${ASSET_VERSION}>; rel="shortcut icon"`,
  ]

  if (!response.bodyUsed) {
    response.headers.set('X-Content-Type-Options', 'nosniff')
    response.headers.set('X-Frame-Options', 'SAMEORIGIN')
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

    if (response.headers.get('Content-type')?.includes('text/html')) {
      response.headers.set('Speculation-Rules', '"/rules/prefetch.json"')
      response.headers.set('Link', [...agentDiscoveryLinks, ...faviconLinks].join(', '))
    } else if (context.url.pathname === '/llms.txt') {
      response.headers.set('Link', faviconLinks.join(', '))
    }

    if (/^\/(?:favicon(?:-32x32)?|apple-touch-icon|icon-(?:192|512)|og-image)\.(?:svg|png|ico)$/.test(context.url.pathname)) {
      if (context.url.searchParams.has('v')) {
        response.headers.set('Cache-Control', 'public, max-age=31536000, immutable')
      } else {
        response.headers.set('Cache-Control', 'public, max-age=0, must-revalidate')
      }
    } else if (!response.headers.has('Cache-Control')) {
      response.headers.set('Cache-Control', 'public, max-age=300, s-maxage=300')
    }
  }
  return response
}
