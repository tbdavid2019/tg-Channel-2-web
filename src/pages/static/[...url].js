const targetWhitelist = [
  't.me',
  'telegram.org',
  'telegram.me',
  'telegram.dog',
  'cdn-telegram.org',
  'telesco.pe',
  'yandex.ru',
]

export async function GET({ request, params, url }) {
  try {
    // params.url already contains the full URL with query string
    const targetUrl = params.url.includes('?') ? params.url : params.url + url.search
    const target = new URL(targetUrl)
    if (!targetWhitelist.some(domain => target.hostname.endsWith(domain))) {
      return Response.redirect(target.toString(), 302)
    }
    const response = await fetch(target.toString(), request)
    return new Response(response.body, response)
  }
  catch (error) {
    return new Response(error.message, { status: 500 })
  }
}
