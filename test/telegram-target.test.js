import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeTelegramTarget } from '../src/lib/telegram/normalize.js'

test('normalizes public Telegram channel inputs to a username', () => {
  const inputs = [
    '@daybuy',
    'daybuy',
    'https://t.me/daybuy',
    't.me/s/daybuy',
    'https://telegram.me/daybuy/123',
  ]

  for (const input of inputs) {
    assert.deepEqual(normalizeTelegramTarget(input), {
      ok: true,
      handle: 'daybuy',
      url: 'https://t.me/daybuy',
    })
  }
})

test('classifies Telegram links that cannot expose public history', () => {
  assert.equal(normalizeTelegramTarget('https://t.me/+rq848Z09nehlOTgx').code, 'invite')
  assert.equal(normalizeTelegramTarget('https://t.me/joinchat/Gxp1thdP5FPRkmL2ftI5IA').code, 'invite')
  assert.equal(normalizeTelegramTarget('https://t.me/c/123456/1').code, 'private')
  assert.deepEqual(normalizeTelegramTarget('not a Telegram username'), {
    ok: false,
    code: 'invalid',
    url: '',
  })
})
