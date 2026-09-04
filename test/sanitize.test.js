import assert from 'node:assert/strict'
import test from 'node:test'
import { sanitizeContent } from '../src/lib/telegram/sanitize.js'

test('preserves the popover attribute used by image lightboxes', () => {
  const html = '<button class="modal" id="modal-1" popovertarget="modal-1" popovertargetaction="hide" popover><img class="modal-img" src="https://example.com/image.jpg"></button>'

  const sanitized = sanitizeContent(html)

  assert.match(sanitized, /\spopover="auto"(?=\s|>)/)
})
