import { GET } from '../../src/pages/static/[...url]'

export const config = {
  runtime: 'edge',
}

export default function handler(request) {
  const url = request.url?.split('/static/')?.[1]

  if (!url) {
    return new Response('Not Found', { status: 404 })
  }

  // Keep the full URL with query string intact
  return GET({
    request,
    params: {
      url: url,
    },
    url: {
      search: '',
    },
  })
}
