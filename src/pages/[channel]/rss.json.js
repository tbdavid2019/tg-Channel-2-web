import { getChannelInfo } from '../../lib/telegram'

export async function GET(Astro) {
  const { channel: channelName } = Astro.params
  
  // Update SITE_URL for this channel
  Astro.locals.SITE_URL = `${Astro.url.origin}/${channelName}/`
  
  const tag = Astro.url.searchParams.get('tag')
  const channel = await getChannelInfo(Astro, {
    channelName,
    q: tag ? `#${tag}` : '',
  })
  const posts = channel.posts || []

  const json = {
    version: 'https://jsonfeed.org/version/1.1',
    title: `${tag ? `${tag} | ` : ''}${channel.title}`,
    home_page_url: Astro.locals.SITE_URL,
    feed_url: `${Astro.locals.SITE_URL}rss.json`,
    description: channel.description,
    icon: channel.avatar,
    authors: [
      {
        name: channel.title,
        url: Astro.locals.SITE_URL,
      },
    ],
    language: 'zh-tw',
    items: posts.map(item => ({
      id: item.id,
      url: `${Astro.locals.SITE_URL}posts/${item.id}`,
      title: item.title,
      content_html: item.content,
      summary: item.text,
      date_published: new Date(item.datetime).toISOString(),
      tags: item.tags,
    })),
  }

  return new Response(JSON.stringify(json, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
