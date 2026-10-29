import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone.js'
import utc from 'dayjs/plugin/utc.js'

dayjs.extend(utc)
dayjs.extend(timezone)

/**
 * 去除 HTML 標籤與特殊實體符號，輸出整潔文字
 * 區分 block 標籤（替換為空格）與 inline 標籤（替換為空字串）
 * @param {string} html 
 * @returns {string}
 */
export function stripHtml(html) {
  if (!html || typeof html !== 'string') return ''
  return html
    .replace(/<(?:p|div|br|h[1-6]|li|section|article|header|footer)[^>]*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * 截取貼文摘要短標題，若包含圖片標注 📷，影片標注 🎬
 * @param {object} post 貼文物件
 * @param {number} maxLen 最大字元長度（預設 28）
 * @returns {string} 截取後的標題文字
 */
export function extractPostExcerpt(post, maxLen = 28) {
  if (!post || typeof post !== 'object') return '貼文'

  const contentStr = typeof post.content === 'string' ? post.content : ''
  const hasVideo = contentStr.includes('<video') ||
                   contentStr.includes('video_player') ||
                   post.media_type === 'video'
  const hasImage = !hasVideo && (
                   contentStr.includes('<img') ||
                   post.media_type === 'photo'
  )
  const mediaPrefix = hasVideo ? '🎬 ' : (hasImage ? '📷 ' : '')

  let rawText = ''
  if (post.title && typeof post.title === 'string' && post.title.trim().length > 0) {
    rawText = post.title
  } else if (post.text && typeof post.text === 'string' && post.text.trim().length > 0) {
    const lines = post.text.split('\n').map(l => l.trim()).filter(Boolean)
    rawText = lines[0] || ''
  } else if (contentStr.length > 0) {
    rawText = contentStr
  }

  const cleanText = stripHtml(rawText)

  if (cleanText.length > 0) {
    const startsWithMedia = cleanText.startsWith('🎬') || cleanText.startsWith('📷')
    const prefix = startsWithMedia ? '' : mediaPrefix

    let truncated = cleanText
    if (truncated.length > maxLen) {
      truncated = `${truncated.slice(0, maxLen)}…`
    }
    return `${prefix}${truncated}`
  }

  // 無文字內容時的 fallback
  if (hasVideo) {
    return post.id ? `🎬 影音訊息 #${post.id}` : '🎬 影音訊息'
  }
  if (hasImage) {
    return post.id ? `📷 圖片訊息 #${post.id}` : '📷 圖片訊息'
  }
  return post.id ? `貼文 #${post.id}` : '貼文'
}

/**
 * 取得文章備用 Landmark 區塊（正文、附件、標籤、留言等）
 * @param {object} options 
 * @returns {Array<{ id: string, title: string, isLandmark: boolean }>}
 */
export function getFallbackLandmarks(options = {}) {
  const landmarks = [
    { id: options.postId ? `post-${options.postId}` : 'post-content', title: '正文內容', isLandmark: true },
  ]
  if (options.hasMedia) {
    landmarks.push({ id: 'post-media', title: '多媒體附件', isLandmark: true })
  }
  if (options.hasTags) {
    const count = typeof options.tagsCount === 'number' && options.tagsCount > 0 ? ` (${options.tagsCount})` : ''
    landmarks.push({ id: 'post-tags', title: `文章標籤${count}`, isLandmark: true })
  }
  if (options.hasComments) {
    landmarks.push({ id: 'post-comments', title: '頻道留言', isLandmark: true })
  }
  return landmarks
}

/**
 * 在單篇內容中解析 <h2>, <h3>, <h4> 或 <b>標題</b>（如 【...】 或加粗小標）
 * 若無小標，回傳備用 landmark 清單
 * @param {string} content 文章 HTML 字串
 * @param {object} options 可選參數（hasMedia, hasTags, tagsCount, hasComments 等）
 * @returns {Array<{ id: string, title: string, level: number, tag?: string, raw?: string, isLandmark?: boolean }>}
 */
export function extractArticleSections(content, options = {}) {
  if (!content || typeof content !== 'string') {
    return getFallbackLandmarks(options)
  }

  const sections = []
  const seenIds = new Set()

  const makeId = (title, index) => {
    let slug = title
      .toLowerCase()
      .replace(/[^\w\u4e00-\u9fa5]+/g, '-')
      .replace(/^-+|-+$/g, '')
    if (!slug) slug = `sec-${index + 1}`
    else slug = `sec-${slug}`

    let uniqueId = slug
    let counter = 2
    while (seenIds.has(uniqueId) || uniqueId === 'post-content' || uniqueId === 'post-tags') {
      uniqueId = `${slug}-${counter++}`
    }
    seenIds.add(uniqueId)
    return uniqueId
  }

  // 1. 尋找標準 HTML 標題 <h2>, <h3>, <h4>
  const headingRegex = /<h([2-4])([^>]*)>([\s\S]*?)<\/h\1>/gi
  let match

  while ((match = headingRegex.exec(content)) !== null) {
    const level = parseInt(match[1], 10)
    const attrs = match[2] || ''
    const innerHtml = match[3] || ''
    const title = stripHtml(innerHtml)

    if (title.length >= 2 && title.length <= 60) {
      const idMatch = attrs.match(/\bid=["']([^"']+)["']/i)
      const existingId = idMatch ? idMatch[1] : null
      const id = existingId || makeId(title, sections.length)

      sections.push({
        id,
        title,
        level,
        tag: `h${level}`,
        raw: match[0],
      })
    }
  }

  // 2. 若無 h2-h4，尋找獨立段落的粗體小標 <p><b>標題</b></p> 或 <div><b>標題</b></div>
  if (sections.length === 0) {
    const blockBoldRegex = /<(?:p|div)[^>]*>\s*<(?:b|strong)([^>]*)>([\s\S]*?)<\/(?:b|strong)>\s*<\/(?:p|div)>/gi
    while ((match = blockBoldRegex.exec(content)) !== null) {
      const attrs = match[1] || ''
      const innerHtml = match[2] || ''
      const title = stripHtml(innerHtml)

      // 檢查是否適合當章節標題：長度 2~45 字元，結尾非逗號/頓號/分號等
      if (title.length >= 2 && title.length <= 45 && !/[，,；;。、]$/.test(title)) {
        const idMatch = attrs.match(/\bid=["']([^"']+)["']/i)
        const existingId = idMatch ? idMatch[1] : null
        const id = existingId || makeId(title, sections.length)

        sections.push({
          id,
          title,
          level: 3,
          tag: 'b-block',
          raw: match[0],
        })
      }
    }
  }

  // 3. 若仍無，尋找以換行分隔的 <b>小標</b> 或 包含 【小標】
  if (sections.length === 0) {
    const inlineBoldRegex = /(?:^|<br\s*\/?>|\n)\s*<(?:b|strong)([^>]*)>([\s\S]*?)<\/(?:b|strong)>\s*(?=<br\s*\/?>|\n|$)/gi
    while ((match = inlineBoldRegex.exec(content)) !== null) {
      const attrs = match[1] || ''
      const innerHtml = match[2] || ''
      const title = stripHtml(innerHtml)

      if (title.length >= 2 && title.length <= 45 && !/[，,；;。、]$/.test(title)) {
        const idMatch = attrs.match(/\bid=["']([^"']+)["']/i)
        const existingId = idMatch ? idMatch[1] : null
        const id = existingId || makeId(title, sections.length)

        sections.push({
          id,
          title,
          level: 3,
          tag: 'b-inline',
          raw: match[0],
        })
      }
    }
  }

  // 4. 若解析到章節標題，回傳 sections
  if (sections.length > 0) {
    return sections
  }

  // 5. 若無小標，回傳備用 landmarks
  return getFallbackLandmarks(options)
}

/**
 * 將解析出的章節 ID 注入到 HTML 對應標籤中，供錨點跳轉
 * @param {string} content 文章 HTML 字串
 * @param {Array<object>} sections 章節清單
 * @returns {string} 注入錨點後的 HTML 字串
 */
export function injectSectionAnchors(content, sections) {
  if (!content || typeof content !== 'string' || !Array.isArray(sections) || sections.length === 0) {
    return content
  }

  let result = content

  for (const sec of sections) {
    if (sec.isLandmark || !sec.id || !sec.raw) continue

    // 若原本已有該 ID 則跳過
    if (sec.raw.includes(`id="${sec.id}"`) || sec.raw.includes(`id='${sec.id}'`)) {
      continue
    }

    let replacement = sec.raw
    if (/^<h[2-4]/i.test(sec.raw)) {
      replacement = sec.raw.replace(/^(<h[2-4])([^>]*>)/i, `$1 id="${sec.id}" class="article-heading-anchor"$2`)
    } else if (/^<(?:p|div)/i.test(sec.raw)) {
      replacement = sec.raw.replace(/^(<(?:p|div))([^>]*>)/i, `$1 id="${sec.id}" class="article-heading-anchor"$2`)
    } else if (/<(?:b|strong)/i.test(sec.raw)) {
      replacement = sec.raw.replace(/(<(?:b|strong))([^>]*>)/i, `$1 id="${sec.id}" class="article-heading-anchor"$2`)
    }

    if (replacement !== sec.raw && result.includes(sec.raw)) {
      result = result.replace(sec.raw, replacement)
    }
  }

  // 注入 post-media 錨點（若存在多媒體 landmark 且尚未注入）
  const hasMediaSection = sections.some((s) => s.id === 'post-media')
  if (hasMediaSection && !result.includes('id="post-media"')) {
    // 嚴格在最外層多媒體容器或標籤前注入，避免破壞 HTML 標籤內屬性結構
    const mediaContainerPattern = /(<(?:div|figure)[^>]*class="[^"]*(?:image-list-container|media-container)[^"]*"[^>]*>|<button[^>]*class="[^"]*image-preview-button[^"]*"[^>]*>|<(?:img|video|audio)\b[^>]*>)/i
    if (mediaContainerPattern.test(result)) {
      result = result.replace(mediaContainerPattern, '<span id="post-media" class="article-heading-anchor"></span>$1')
    }
  }

  return result
}

/**
 * 為列表頁建立目錄項目清單
 * @param {Array<object>} posts 貼文陣列
 * @param {string} tz 時區字串（預設 'UTC'）
 * @returns {Array<object>} 目錄清單
 */
export function buildTimelineToc(posts = [], tz = 'UTC') {
  if (!Array.isArray(posts)) return []

  return posts.map((post, idx) => {
    const excerpt = extractPostExcerpt(post, 28)
    let fullTitle = ''
    if (post.title && typeof post.title === 'string' && post.title.trim().length > 0) {
      fullTitle = stripHtml(post.title)
    } else if (post.text && typeof post.text === 'string' && post.text.trim().length > 0) {
      fullTitle = stripHtml(post.text.slice(0, 100))
    } else {
      fullTitle = excerpt
    }

    const dt = post.datetime ? dayjs(post.datetime).tz(tz) : null
    const time = dt && dt.isValid() ? dt.format('HH:mm') : ''
    const isAd = Boolean(post.isAd)
    const title = isAd ? `🛡️ ${excerpt}` : excerpt
    const displayFull = isAd ? `🛡️ [已過濾推廣] ${fullTitle}` : (fullTitle || excerpt)

    return {
      id: `toc-item-${post.id ?? idx + 1}`,
      targetId: `post-${post.id ?? idx + 1}`,
      postId: post.id ?? idx + 1,
      title,
      fullTitle: displayFull,
      time,
      datetime: post.datetime || '',
      isAd,
    }
  })
}

export default {
  stripHtml,
  extractPostExcerpt,
  extractArticleSections,
  injectSectionAnchors,
  getFallbackLandmarks,
  buildTimelineToc,
}
