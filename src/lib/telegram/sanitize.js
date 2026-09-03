import sanitizeHtml from 'sanitize-html'

export function sanitizeContent(html) {
  if (!html) return ''
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      'img', 'video', 'audio', 'source', 'button', 'input', 'label', 'tg-spoiler', 'small',
    ]),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      '*': ['class', 'style', 'id', 'title', 'aria-*'],
      video: [
        'src', 'width', 'height', 'poster', 'controls', 'preload',
        'playsinline', 'webkit-playsinline', 'autoplay', 'muted', 'loop', 'disablepictureinpicture',
      ],
      audio: ['src', 'controls'],
      img: ['src', 'srcset', 'alt', 'title', 'width', 'height', 'loading', 'class', 'style'],
      button: ['class', 'popovertarget', 'popovertargetaction', 'popover', 'id'],
      input: ['type', 'id', 'class', 'checked'],
      label: ['for', 'class', 'aria-label'],
      a: ['href', 'target', 'rel', 'title', 'class'],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowedSchemesAppliedToAttributes: ['href', 'src'],
  })
}

export function sanitizeDescription(html) {
  if (!html) return ''
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'small']),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      '*': ['class', 'style', 'id', 'title'],
      a: ['href', 'target', 'rel', 'title', 'class'],
      img: ['src', 'alt', 'class'],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowedSchemesAppliedToAttributes: ['href', 'src'],
  })
}

export default {
  sanitizeContent,
  sanitizeDescription,
}
