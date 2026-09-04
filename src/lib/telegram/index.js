import * as cheerio from 'cheerio'
import flourite from 'flourite'
import { LRUCache } from 'lru-cache'
import { marked } from 'marked'
import { $fetch } from 'ofetch'
import { getEnv } from '../env'
import { recordChannelVisit } from '../db'
import prism from '../prism'
import { normalizeTelegramTarget } from './normalize'
import { sanitizeContent, sanitizeDescription } from './sanitize'

function escapeAttr(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

const cache = new LRUCache({
  ttl: 1000 * 60 * 10, // 10 minutes - refresh frequently for new posts
  maxSize: 50 * 1024 * 1024, // 50MB
  sizeCalculation: (item) => {
    return JSON.stringify(item).length
  },
})

function getVideoStickers($, item, { staticProxy, index }) {
  return $(item).find('.js-videosticker_video')?.map((_index, video) => {
    const url = $(video)?.attr('src')
    const imgurl = $(video).find('img')?.attr('src')
    return `
    <div style="background-image: none; width: 256px;">
      <video src="${staticProxy + url}" width="100%" height="100%" alt="Video Sticker" preload muted autoplay loop playsinline disablepictureinpicture >
        <img class="sticker" src="${staticProxy + imgurl}" alt="Video Sticker" loading="${index > 15 ? 'eager' : 'lazy'}" />
      </video>
    </div>
    `
  })?.get()?.join('')
}

function getImageStickers($, item, { staticProxy, index }) {
  return $(item).find('.tgme_widget_message_sticker')?.map((_index, image) => {
    const url = $(image)?.attr('data-webp')
    return `<img class="sticker" src="${staticProxy + url}" style="width: 256px;" alt="Sticker" loading="${index > 15 ? 'eager' : 'lazy'}" />`
  })?.get()?.join('')
}

function getImages($, item, { staticProxy, id, index, title }) {
  const safeTitle = escapeAttr(title)
  const images = $(item).find('.tgme_widget_message_photo_wrap')?.map((_index, photo) => {
    const url = $(photo).attr('style').match(/url\(["'](.*?)["']/)?.[1]
    const popoverId = `modal-${id}-${_index}`
    return `
      <button class="image-preview-button image-preview-wrap" popovertarget="${popoverId}" popovertargetaction="show">
        <img src="${staticProxy + url}" alt="${safeTitle}" loading="${index > 15 ? 'eager' : 'lazy'}" />
      </button>
      <button class="image-preview-button modal" id="${popoverId}" popovertarget="${popoverId}" popovertargetaction="hide" popover>
        <img class="modal-img" src="${staticProxy + url}" alt="${safeTitle}" loading="lazy" />
      </button>
    `
  })?.get()
  return images.length ? `<div class="image-list-container ${images.length % 2 === 0 ? 'image-list-even' : 'image-list-odd'}">${images?.join('')}</div>` : ''
}

function getVideo($, item, { staticProxy, index }) {
  const video = $(item).find('.tgme_widget_message_video_wrap video')
  video?.attr('src', staticProxy + video?.attr('src'))
    ?.attr('controls', true)
    ?.attr('preload', index > 15 ? 'auto' : 'metadata')
    ?.attr('playsinline', true)
    .attr('webkit-playsinline', true)

  const roundVideo = $(item).find('.tgme_widget_message_roundvideo_wrap video')
  roundVideo?.attr('src', staticProxy + roundVideo?.attr('src'))
    ?.attr('controls', true)
    ?.attr('preload', index > 15 ? 'auto' : 'metadata')
    ?.attr('playsinline', true)
    .attr('webkit-playsinline', true)
  return $.html(video) + $.html(roundVideo)
}

function getAudio($, item, { staticProxy }) {
  const audio = $(item).find('.tgme_widget_message_voice')
  audio?.attr('src', staticProxy + audio?.attr('src'))
    ?.attr('controls', true)
  return $.html(audio)
}

function getLinkPreview($, item, { staticProxy, index }) {
  const link = $(item).find('.tgme_widget_message_link_preview')
  const title = $(item).find('.link_preview_title')?.text() || $(item).find('.link_preview_site_name')?.text()
  const description = $(item).find('.link_preview_description')?.text()
  const safeTitle = escapeAttr(title)
  const safeDescription = escapeAttr(description)

  link?.attr('target', '_blank').attr('rel', 'noopener').attr('title', safeDescription)

  const image = $(item).find('.link_preview_image')
  const src = image?.attr('style')?.match(/url\(["'](.*?)["']/i)?.[1]
  const imageSrc = src ? staticProxy + src : ''
  image?.replaceWith(`<img class="link_preview_image" alt="${safeTitle}" src="${imageSrc}" loading="${index > 15 ? 'eager' : 'lazy'}" />`)
  return $.html(link)
}

function getReply($, item, { channel }) {
  const reply = $(item).find('.tgme_widget_message_reply')
  reply?.wrapInner('<small></small>')?.wrapInner('<blockquote></blockquote>')

  const href = reply?.attr('href')
  if (href) {
    const url = new URL(href)
    reply?.attr('href', `${url.pathname}`.replace(new RegExp(`/${channel}/`, 'i'), '/posts/'))
  }

  return $.html(reply)
}

function modifyHTMLContent($, content, { index } = {}) {
  $(content).find('.emoji')?.removeAttr('style')
  $(content).find('a')?.each((_index, a) => {
    $(a)?.attr('title', $(a)?.text())?.removeAttr('onclick')
  })
  // Transform Telegram expandable quotes
  $(content).find('blockquote[expandable]')?.each((_index, bq) => {
    const innerHTML = $(bq).html()
    const id = `expand-${index}-${_index}`
    const expandable = `<div class="tg-expandable">
      <input type="checkbox" id="${id}" class="tg-expandable__checkbox">
      <div class="tg-expandable__content">${innerHTML}</div>
      <label for="${id}" class="tg-expandable__toggle" aria-label="Expand/Collapse"></label>
    </div>`
    $(bq).replaceWith(expandable)
  })
  $(content).find('tg-spoiler')?.each((_index, spoiler) => {
    const id = `spoiler-${index}-${_index}`
    $(spoiler)?.attr('id', id)?.wrap('<label class="spoiler-button"></label>')?.before(`<input type="checkbox" />`)
  })
  $(content).find('pre').each((_index, pre) => {
    try {
      $(pre).find('br')?.replaceWith('\n')

      const code = $(pre).text()
      const language = flourite(code, { shiki: true, noUnknown: true })?.language || 'text'
      const highlightedCode = prism.highlight(code, prism.languages[language], language)
      $(pre).html(`<code class="language-${language}">${highlightedCode}</code>`)
    }
    catch (error) {
      console.error(error)
    }
  })
  return content
}

function getPost($, item, { channel, staticProxy, index = 0 }) {
  item = item ? $(item).find('.tgme_widget_message') : $('.tgme_widget_message')
  const content = $(item).find('.js-message_reply_text')?.length > 0
    ? modifyHTMLContent($, $(item).find('.tgme_widget_message_text.js-message_text'), { index })
    : modifyHTMLContent($, $(item).find('.tgme_widget_message_text'), { index })
  const title = content?.text()?.match(/^.*?(?=[。\n]|http\S)/g)?.[0] ?? content?.text() ?? ''
  const id = $(item).attr('data-post')?.replace(new RegExp(`${channel}/`, 'i'), '')

  const tags = $(content).find('a[href^="?q="]')?.each((_index, a) => {
    $(a)?.attr('href', `/search/result?q=${encodeURIComponent($(a)?.text()?.replace(/^#/, ''))}`)
  })?.map((_index, a) => $(a)?.text()?.replace('#', ''))?.get()

  const rawContent = [
    getReply($, item, { channel }),
    getImages($, item, { staticProxy, id, index, title }),
    getVideo($, item, { staticProxy, id, index, title }),
    getAudio($, item, { staticProxy, id, index, title }),
    content?.html() ? marked.parse(content.html().replace(/<br\s*\/?>/gi, '\n'), { breaks: true }) : '',
    getImageStickers($, item, { staticProxy, index }),
    getVideoStickers($, item, { staticProxy, index }),
    // $(item).find('.tgme_widget_message_sticker_wrap')?.html(),
    $(item).find('.tgme_widget_message_poll')?.html(),
    $.html($(item).find('.tgme_widget_message_document_wrap')),
    $.html($(item).find('.tgme_widget_message_video_player.not_supported')),
    $.html($(item).find('.tgme_widget_message_location_wrap')),
    getLinkPreview($, item, { staticProxy, index }),
  ].filter(Boolean).join('').replace(/(url\(["'])((https?:)?\/\/)/g, (match, p1, p2, _p3) => {
    if (p2 === '//') {
      p2 = 'https://'
    }
    if (p2?.startsWith('t.me')) {
      return false
    }
    return `${p1}${staticProxy}${p2}`
  })

  return {
    id,
    title,
    type: $(item).attr('class')?.includes('service_message') ? 'service' : 'text',
    datetime: $(item).find('.tgme_widget_message_date time')?.attr('datetime'),
    tags,
    text: content?.text(),
    content: sanitizeContent(rawContent),
  }
}

export async function getChannelInfo(Astro, { before = '', after = '', q = '', type = 'list', id = '', channelName = '' } = {}) {
  // Where t.me can also be telegram.me, telegram.dog
  const host = getEnv(import.meta.env, Astro, 'TELEGRAM_HOST') ?? 't.me'
  const requestedChannel = channelName || getEnv(import.meta.env, Astro, 'CHANNEL') || ''
  const normalizedTarget = normalizeTelegramTarget(requestedChannel)

  if (!normalizedTarget.ok) {
    return {
      handle: requestedChannel,
      posts: [],
      title: '',
      description: '',
      descriptionHTML: '',
      avatar: '',
      errorCode: normalizedTarget.code,
      telegramUrl: normalizedTarget.url,
    }
  }

  const channel = normalizedTarget.handle
  const cacheKey = JSON.stringify({ before, after, q, type, id, channelName: channel })
  const cachedResult = cache.get(cacheKey)

  if (cachedResult) {
    if (cachedResult.handle && cachedResult.title) {
      recordChannelVisit(cachedResult)
    }
    console.info('Match Cache', { before, after, q, type, id, channelName: channel })
    return JSON.parse(JSON.stringify(cachedResult))
  }

  // In ANYCHANNEL mode, don't use proxy - direct CDN access works better
  const anyChannel = getEnv(import.meta.env, Astro, 'ANYCHANNEL')
  const staticProxy = anyChannel ? '' : (getEnv(import.meta.env, Astro, 'STATIC_PROXY') ?? '/static/')

  const url = id ? `https://${host}/${channel}/${id}?embed=1&mode=tme` : `https://${host}/s/${channel}`

  console.info('Fetching', url, { before, after, q, type, id, channelName })
  
  let html
  try {
    html = await $fetch(url, {
      // Use clean headers instead of forwarding browser headers which can cause connection issues
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
      },
      query: {
        before: before || undefined,
        after: after || undefined,
        q: q || undefined,
      },
      retry: 5,
      retryDelay: 2000, // 2 seconds between retries to avoid rate limiting
      timeout: 30000, // 30 second timeout
    })
  } catch (error) {
    console.error('Fetch error:', error.message, { url, before, after, q, type, id })
    // Return empty result instead of throwing - don't cache failures
    return {
      handle: channel,
      posts: [],
      title: '',
      description: '',
      descriptionHTML: '',
      avatar: '',
      errorCode: 'fetch_failed',
      telegramUrl: normalizedTarget.url,
    }
  }

  if (!html) {
    console.error('Empty response received', { url, before, after, q, type, id })
    return {
      handle: channel,
      posts: [],
      title: '',
      description: '',
      descriptionHTML: '',
      avatar: '',
      errorCode: 'empty_response',
      telegramUrl: normalizedTarget.url,
    }
  }

  const $ = cheerio.load(html, {}, false)
  const title = $('.tgme_channel_info_header_title')?.text()?.trim()
  if (id) {
    const post = getPost($, null, { channel, staticProxy })
    cache.set(cacheKey, post)
    return post
  }

  if (!title) {
    const pageTitle = $('title')?.text()?.trim() || ''
    const errorCode = /join (?:group )?chat/i.test(pageTitle) ? 'invite' : 'no_public_preview'
    const unsupported = {
      handle: channel,
      posts: [],
      title: '',
      description: '',
      descriptionHTML: '',
      avatar: '',
      errorCode,
      telegramUrl: normalizedTarget.url,
    }
    cache.set(cacheKey, unsupported)
    return unsupported
  }
  const posts = $('.tgme_channel_history  .tgme_widget_message_wrap')?.map((index, item) => {
    return getPost($, item, { channel, staticProxy, index })
  })?.get()?.reverse().filter(post => ['text'].includes(post.type) && post.id && post.content)

  const channelInfo = {
    handle: channel,
    posts,
    title,
    description: $('.tgme_channel_info_description')?.text(),
    descriptionHTML: sanitizeDescription(modifyHTMLContent($, $('.tgme_channel_info_description'))?.html()),
    avatar: $('.tgme_page_photo_image img')?.attr('src'),
  }

  recordChannelVisit(channelInfo)
  cache.set(cacheKey, channelInfo)
  return channelInfo
}
