import { getEnv } from '../../lib/env.js'

function redirect(location) {
  return new Response(null, {
    status: 303,
    headers: {
      Location: location,
      'Cache-Control': 'no-store',
    },
  })
}

export function GET(context) {
  const query = (context.url.searchParams.get('q') || '').trim()
  if (!query) return redirect('/')

  const googleSearchSite = getEnv(import.meta.env, context, 'GOOGLE_SEARCH_SITE')
  if (googleSearchSite) {
    const searchUrl = new URL('https://www.google.com/search')
    searchUrl.searchParams.set('q', query)
    searchUrl.searchParams.set('as_sitesearch', googleSearchSite)
    return redirect(searchUrl.toString())
  }

  const resultsUrl = new URL('/search/result', context.url)
  resultsUrl.searchParams.set('q', query)
  return redirect(resultsUrl.toString())
}
