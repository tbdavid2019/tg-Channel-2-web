import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

const testDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'telegram-reader-boundary-'))
process.env.DB_PATH = path.join(testDataDir, 'posts.json')
process.env.TIMEZONE = 'Asia/Taipei'

const {
  savePost,
  savePosts,
  getPostIdsByDate,
  getPostsBetween,
  getDatesByMonth,
  getDatesWithPosts,
  getAdjacentDates,
} = await import('../src/lib/db/index.js?boundary-test')

test('savePost assigns local calendar date when UTC crosses midnight into next day', () => {
  // 18:30:00 UTC on 2026-09-08 is 02:30:00 AM on 2026-09-09 in Taipei (UTC+8)
  const post = {
    id: 101,
    channel: 'testchannel',
    datetime: '2026-09-08T18:30:00Z',
    title: 'Cross Midnight Post',
  }
  savePost(post, 'testchannel')

  // Verify post is attributed to 2026-09-09 in Taipei
  const sep9Posts = getPostIdsByDate('2026-09-09', 'testchannel', 'Asia/Taipei')
  assert.equal(sep9Posts.length, 1)
  assert.equal(sep9Posts[0].id, 101)

  // Verify post is NOT attributed to 2026-09-08
  const sep8Posts = getPostIdsByDate('2026-09-08', 'testchannel', 'Asia/Taipei')
  assert.equal(sep8Posts.length, 0)
})

test('getPostsBetween implements human closed interval [Start, End + 1 day) including End 23:59:59', () => {
  // Human query: "9/1 ~ 9/9"
  // Start: 2026-09-01 00:00:00
  // End: 2026-09-09 23:59:59.999
  const posts = [
    {
      id: 201,
      channel: 'rangechannel',
      datetime: '2026-08-31T23:59:59+08:00', // Just before 9/1
      title: 'Before Range',
    },
    {
      id: 202,
      channel: 'rangechannel',
      datetime: '2026-09-01T00:00:00+08:00', // Start of 9/1
      title: 'Start of Range',
    },
    {
      id: 203,
      channel: 'rangechannel',
      datetime: '2026-09-05T12:00:00+08:00', // Mid range
      title: 'Mid Range',
    },
    {
      id: 204,
      channel: 'rangechannel',
      datetime: '2026-09-09T23:59:59.999+08:00', // Last millisecond of 9/9
      title: 'End of Range (23:59:59.999)',
    },
    {
      id: 205,
      channel: 'rangechannel',
      datetime: '2026-09-10T00:00:00.000+08:00', // First millisecond of 9/10 (Must be excluded)
      title: 'Next Day Midnight (Excluded)',
    },
  ]
  savePosts(posts, 'rangechannel')

  const results = getPostsBetween('2026-09-01', '2026-09-09', 'rangechannel', 'Asia/Taipei')
  const resultIds = results.map(p => p.id)

  assert.ok(resultIds.includes(202), '2026-09-01 00:00:00 must be included')
  assert.ok(resultIds.includes(203), '2026-09-05 12:00:00 must be included')
  assert.ok(resultIds.includes(204), '2026-09-09 23:59:59.999 must be included')
  assert.ok(!resultIds.includes(201), '2026-08-31 23:59:59 must be excluded')
  assert.ok(!resultIds.includes(205), '2026-09-10 00:00:00 must be excluded')
})

test('getDatesByMonth correctly captures月初 early-morning posts in September', () => {
  // 2026-08-31 18:30:00Z in UTC is 2026-09-01 02:30:00 in Taipei
  const sepPost = {
    id: 301,
    channel: 'monthchannel',
    datetime: '2026-08-31T18:30:00Z',
    title: 'Sep 1 Early Post',
  }
  savePost(sepPost, 'monthchannel')

  const sepDates = getDatesByMonth('2026-09', 'monthchannel', 'Asia/Taipei')
  assert.ok(sepDates.some(d => d.date === '2026-09-01'), 'Must attribute to 2026-09-01 in September month calendar')

  const augDates = getDatesByMonth('2026-08', 'monthchannel', 'Asia/Taipei')
  assert.ok(!augDates.some(d => d.date === '2026-09-01'), 'Must not appear in August')
})

test('getAdjacentDates handles out-of-range dates gracefully without jump to today', () => {
  const result = getAdjacentDates('2020-01-01', 30, 'empty_channel', 'Asia/Taipei')
  assert.equal(result.currentIndex, -1)
  assert.equal(result.prevDate, null)
  assert.equal(result.nextDate, null)
})
