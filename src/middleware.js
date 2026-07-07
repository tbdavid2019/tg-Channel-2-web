export async function onRequest(context, next) {
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
    '</docs/agent-guide.md>; rel="describedby"; type="text/markdown"',
    '</.well-known/agent-skills/index.json>; rel="describedby"; type="application/json"',
    '</rss.xml>; rel="alternate"; type="application/rss+xml"',
    '</rss.json>; rel="alternate"; type="application/feed+json"',
  ]

  if (!response.bodyUsed) {
    if (response.headers.get('Content-type') === 'text/html') {
      response.headers.set('Speculation-Rules', '"/rules/prefetch.json"')
      response.headers.set('Link', agentDiscoveryLinks.join(', '))
    }

    if (!response.headers.has('Cache-Control')) {
      response.headers.set('Cache-Control', 'public, max-age=300, s-maxage=300')
    }
  }
  return response
};
