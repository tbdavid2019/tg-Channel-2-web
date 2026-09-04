import { getEnv } from './lib/env'

export async function onRequest(context, next) {
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

  if (!response.bodyUsed) {
    response.headers.set('X-Content-Type-Options', 'nosniff')
    response.headers.set('X-Frame-Options', 'SAMEORIGIN')
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

    if (response.headers.get('Content-type')?.includes('text/html')) {
      response.headers.set('Speculation-Rules', '"/rules/prefetch.json"')
      response.headers.set('Link', agentDiscoveryLinks.join(', '))
    }

    if (/^\/(?:favicon(?:-32x32)?|apple-touch-icon|icon-(?:192|512)|og-image)\.(?:svg|png|ico)$/.test(context.url.pathname)) {
      response.headers.set('Cache-Control', 'public, max-age=31536000, immutable')
    } else if (!response.headers.has('Cache-Control')) {
      response.headers.set('Cache-Control', 'public, max-age=300, s-maxage=300')
    }
  }
  return response
}
