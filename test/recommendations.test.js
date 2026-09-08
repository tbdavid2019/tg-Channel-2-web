import assert from 'node:assert/strict'
import test from 'node:test'
import {
  parseTgNavMarkdown,
  getBundledSeed,
  getRecommendedChannels,
  getRandomChannel,
} from '../src/lib/recommendations/index.js'

test('parseTgNavMarkdown correctly extracts channel handle, title, category and desc', () => {
  const sampleMarkdown = `
# Telegram 导航
## 动漫

* [ACG 资源分享 - 最新新番与壁纸](https://t.me/acg_share)
* [AI 前沿观察 - 人工智能最新动态](https://t.me/ai_frontiers)
* [超级搜群机器人 - 找群神器](https://t.me/super_search_bot)
* [无效链接](https://example.com/foo)
`
  const result = parseTgNavMarkdown(sampleMarkdown)
  assert.equal(result.length, 2, 'Should filter out bots and non-t.me links')
  assert.equal(result[0].handle, 'acg_share')
  assert.equal(result[0].title, 'ACG 资源分享')
  assert.equal(result[0].category, '动漫')
  assert.equal(result[0].description, '最新新番与壁纸')
  assert.equal(result[0].source, 'https://tgnav.com/')

  assert.equal(result[1].handle, 'ai_frontiers')
  assert.equal(result[1].title, 'AI 前沿观察')
  assert.equal(result[1].category, '动漫')
  assert.equal(result[1].description, '人工智能最新动态')
})

test('getBundledSeed returns default channels list with at least 50 items', () => {
  const seed = getBundledSeed()
  assert.ok(Array.isArray(seed))
  assert.ok(seed.length >= 50, `Expected seed count >= 50, got ${seed.length}`)
  const first = seed[0]
  assert.ok(first.handle)
  assert.ok(first.title)
})

test('getRandomChannel returns a valid channel and respects excludeHandle', () => {
  const seed = getBundledSeed()
  const firstHandle = seed[0].handle
  const picked = getRandomChannel(firstHandle)
  assert.ok(picked, 'Should return a channel')
  assert.notEqual(picked.handle.toLowerCase(), firstHandle.toLowerCase(), 'Should not return excluded handle')
})
