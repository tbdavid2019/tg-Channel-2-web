import { getRandomChannel, getRecommendedChannels } from '../lib/recommendations'
import { getEnv } from '../lib/env'

export async function GET(Astro) {
  const { redirect, url, request } = Astro
  const isJson =
    url.searchParams.get('format') === 'json' ||
    url.searchParams.get('json') === '1' ||
    request.headers.get('accept')?.includes('application/json')
  const exclude = url.searchParams.get('exclude') || ''
  const randomChannel = getRandomChannel(exclude)

  if (isJson) {
    return Response.json({
      ok: true,
      channel: randomChannel,
      totalPoolCount: getRecommendedChannels().length,
    })
  }

  const anyChannel = getEnv(import.meta.env, Astro, 'ANYCHANNEL') === 'true'
  const readerBase = getEnv(import.meta.env, Astro, 'READER_URL') || 'https://telegram.david888.com'

  const targetUrl = anyChannel
    ? `/${randomChannel.handle}/`
    : `${readerBase.replace(/\/+$/, '')}/${randomChannel.handle}/`

  return redirect(targetUrl, 302)
}
