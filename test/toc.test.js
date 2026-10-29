import assert from 'node:assert/strict'
import test from 'node:test'
import {
  extractPostExcerpt,
  extractArticleSections,
  injectSectionAnchors,
  getFallbackLandmarks,
  buildTimelineToc,
  stripHtml,
} from '../src/lib/telegram/toc.js'

test('stripHtml strips tags and decodes entities cleanly', () => {
  const input = '<p>Hello <b>World</b>! &amp; &lt;Test&gt; &quot;Quoted&#39;</p>'
  assert.equal(stripHtml(input), 'Hello World! & <Test> "Quoted\'')
  assert.equal(stripHtml(''), '')
  assert.equal(stripHtml(null), '')
})

test('extractPostExcerpt handles various content types and lengths', () => {
  // 1. 普通文字與標題
  const postWithTitle = { id: 101, title: 'Telegram 頻道快訊' }
  assert.equal(extractPostExcerpt(postWithTitle), 'Telegram 頻道快訊')

  // 2. 超長文字截斷至 28 字元並加省略號
  const longText = '這是一篇非常非常非常非常非常非常非常非常非常非常長的一段測試貼文內容'
  const postWithLongText = { id: 102, text: longText }
  const excerpt = extractPostExcerpt(postWithLongText, 28)
  assert.equal(excerpt, `${longText.slice(0, 28)}…`)

  // 3. 純圖片訊息
  const photoOnlyPost = { id: 201, content: '<img src="https://example.com/photo.jpg" />' }
  assert.equal(extractPostExcerpt(photoOnlyPost), '📷 圖片訊息 #201')

  // 4. 圖片附帶說明文字
  const photoWithCaption = {
    id: 202,
    content: '<img src="https://example.com/photo.jpg" /><p>今日活動現場剪影</p>',
  }
  assert.equal(extractPostExcerpt(photoWithCaption), '📷 今日活動現場剪影')

  // 5. 純影音訊息
  const videoOnlyPost = { id: 301, content: '<video src="https://example.com/clip.mp4"></video>' }
  assert.equal(extractPostExcerpt(videoOnlyPost), '🎬 影音訊息 #301')

  // 6. 影音附帶文字
  const videoWithText = {
    id: 302,
    text: '發布會精華片段回顧',
    content: '<video src="clip.mp4"></video>',
  }
  assert.equal(extractPostExcerpt(videoWithText), '🎬 發布會精華片段回顧')

  // 7. 邊界條件：空內容、null、空物件
  assert.equal(extractPostExcerpt(null), '貼文')
  assert.equal(extractPostExcerpt({}), '貼文')
  assert.equal(extractPostExcerpt({ id: 99 }), '貼文 #99')
})

test('extractArticleSections parses h2-h4 and bold headers like The US code, Limits, References', () => {
  // 1. 標準 HTML 標題 h2, h3, h4
  const htmlWithHeadings = `
    <h2>The US code</h2>
    <p>Some legal text here...</p>
    <h3>Limits</h3>
    <p>Boundary limitations explained.</p>
    <h4>References</h4>
    <p>Citation list.</p>
  `
  const sections = extractArticleSections(htmlWithHeadings)
  assert.equal(sections.length, 3)
  assert.equal(sections[0].title, 'The US code')
  assert.equal(sections[0].id, 'sec-the-us-code')
  assert.equal(sections[1].title, 'Limits')
  assert.equal(sections[1].id, 'sec-limits')
  assert.equal(sections[2].title, 'References')
  assert.equal(sections[2].id, 'sec-references')

  // 2. 段落獨立粗體標題 <p><b>...</b></p>
  const htmlWithBoldHeadings = `
    <p><b>Introduction</b></p>
    <p>Welcome to our channel.</p>
    <p><b>The US code</b></p>
    <p>United States Code overview.</p>
    <p><b>Limits</b></p>
    <p>Constraints and regulations.</p>
    <p><b>References</b></p>
    <p>See footnotes.</p>
  `
  const boldSections = extractArticleSections(htmlWithBoldHeadings)
  assert.equal(boldSections.length, 4)
  assert.equal(boldSections[0].title, 'Introduction')
  assert.equal(boldSections[1].title, 'The US code')
  assert.equal(boldSections[2].title, 'Limits')
  assert.equal(boldSections[3].title, 'References')

  // 3. 注入錨點至內容
  const injectedHtml = injectSectionAnchors(htmlWithHeadings, sections)
  assert.match(injectedHtml, /<h2 id="sec-the-us-code" class="article-heading-anchor">/)
  assert.match(injectedHtml, /<h3 id="sec-limits" class="article-heading-anchor">/)
})

test('extractArticleSections returns fallback landmarks when no subheadings exist', () => {
  const plainHtml = '<p>這是一篇沒有任何小標題的普通簡訊文章，純粹介紹一些事情。</p>'
  const fallback = extractArticleSections(plainHtml, {
    hasMedia: true,
    hasTags: true,
    tagsCount: 3,
    hasComments: true,
    postId: 888,
  })

  assert.equal(fallback.length, 4)
  assert.equal(fallback[0].id, 'post-888')
  assert.equal(fallback[0].title, '正文內容')
  assert.equal(fallback[1].id, 'post-media')
  assert.equal(fallback[1].title, '多媒體附件')
  assert.equal(fallback[2].id, 'post-tags')
  assert.equal(fallback[2].title, '文章標籤 (3)')
  assert.equal(fallback[3].id, 'post-comments')
  assert.equal(fallback[3].title, '頻道留言')
})

test('injectSectionAnchors correctly injects post-media anchor before media elements', () => {
  const mediaHtml = '<p>正文說明</p><img src="test.jpg" class="image-preview" /><p>結語</p>'
  const sections = [
    { id: 'post-media', title: '多媒體附件', isLandmark: true },
  ]
  const result = injectSectionAnchors(mediaHtml, sections)
  assert.ok(result.includes('<span id="post-media" class="article-heading-anchor"></span><img src="test.jpg"'))
})

test('injectSectionAnchors preserves button markup and does not inject into tag attributes', () => {
  const photoWrapHtml = '<div class="image-list-container image-list-odd"><button class="image-preview-button image-preview-wrap" popovertarget="modal-4253-0" popovertargetaction="show"><img src="test.jpg" /></button></div>'
  const sections = [
    { id: 'post-media', title: '多媒體附件', isLandmark: true },
  ]
  const result = injectSectionAnchors(photoWrapHtml, sections)
  assert.ok(!result.includes('<button <span'), 'Must not inject span inside button tag attributes')
  assert.ok(result.includes('<span id="post-media" class="article-heading-anchor"></span><div class="image-list-container'), 'Span must precede the outer media container')
  assert.ok(result.includes('class="image-preview-button image-preview-wrap"'))
})

test('buildTimelineToc generates structured navigation items for posts list', () => {
  const posts = [
    {
      id: 501,
      title: '最新功能發布',
      datetime: '2026-10-28T09:30:00Z',
    },
    {
      id: 502,
      content: '<img src="sample.jpg" /><p>活動海報公布</p>',
      datetime: '2026-10-28T08:15:00Z',
    },
    {
      id: 503,
      content: '<video src="demo.mp4"></video>',
      datetime: '2026-10-28T07:00:00Z',
    },
  ]

  const toc = buildTimelineToc(posts, 'Asia/Taipei')
  assert.equal(toc.length, 3)
  assert.equal(toc[0].id, 'toc-item-501')
  assert.equal(toc[0].targetId, 'post-501')
  assert.equal(toc[0].title, '最新功能發布')
  assert.equal(toc[0].time, '17:30') // UTC 09:30 in Asia/Taipei (+8) is 17:30

  assert.equal(toc[1].targetId, 'post-502')
  assert.equal(toc[1].title, '📷 活動海報公布')
  assert.equal(toc[1].time, '16:15')

  assert.equal(toc[2].targetId, 'post-503')
  assert.equal(toc[2].title, '🎬 影音訊息 #503')
  assert.equal(toc[2].time, '15:00')

  // 測試 contains isAd 的貼文在 TOC 中標註盾牌與推廣字樣
  const postsWithAd = [
    { id: 991, title: '正常頻道更新', datetime: '2026-10-28T09:00:00Z', isAd: false },
    { id: 992, title: '飞鸟VPN 特惠方案', datetime: '2026-10-28T08:00:00Z', isAd: true },
  ]
  const tocWithAd = buildTimelineToc(postsWithAd, 'UTC')
  assert.equal(tocWithAd[0].title, '正常頻道更新')
  assert.equal(tocWithAd[1].title, '🛡️ 飞鸟VPN 特惠方案')
  assert.equal(tocWithAd[1].isAd, true)
})
