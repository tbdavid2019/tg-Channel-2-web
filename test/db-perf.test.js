import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

const testDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'telegram-reader-perf-'))
const customDbPath = path.join(testDataDir, 'posts.json')
process.env.DB_PATH = customDbPath

// Seed test DB with scanner probe channels and realistic posts
const initialData = {
  posts: [
    { id: 101, channel: 'validchannel', datetime: '2026-10-25T10:00:00Z', date: '2026-10-25', isAd: false },
    { id: 102, channel: 'validchannel', datetime: '2026-10-26T12:00:00Z', date: '2026-10-26', isAd: false },
    { id: 103, channel: 'validchannel', datetime: '2026-10-27T08:00:00Z', date: '2026-10-27', isAd: false },
    { id: 999, channel: 'credentials', datetime: '2026-10-25T01:00:00Z', date: '2026-10-25' },
    { id: 998, channel: 'kubeconfig', datetime: '2026-10-25T01:00:00Z', date: '2026-10-25' },
    { id: 997, channel: 'undefined', datetime: '2026-10-25T01:00:00Z', date: '2026-10-25' },
    { id: 996, channel: 'actuator', datetime: '2026-10-25T01:00:00Z', date: '2026-10-25' },
  ],
  channelHistory: []
}
fs.writeFileSync(customDbPath, JSON.stringify(initialData, null, 2), 'utf-8')

const db = await import('../src/lib/db/index.js?perf-test')

test('automated DB hygiene discards scanner probe channels on read', () => {
  const dates = db.getDatesWithPosts('credentials')
  assert.equal(dates.length, 0, 'Scanner probe channel should be pruned')

  const totalProbes = db.getTotalPostCount('kubeconfig')
  assert.equal(totalProbes, 0, 'Kubeconfig probe should have 0 posts')

  const validCount = db.getTotalPostCount('validchannel')
  assert.equal(validCount, 3, 'Valid channel posts should be retained')
})

test('O(1) indexed lookups return accurate channel-scoped dates', () => {
  const datesOct = db.getDatesByMonth('2026-10', 'validchannel')
  assert.deepEqual(datesOct, [
    { date: '2026-10-25', count: 1 },
    { date: '2026-10-26', count: 1 },
    { date: '2026-10-27', count: 1 },
  ])

  const postsBetween = db.getPostsBetween('2026-10-25', '2026-10-26', 'validchannel')
  assert.equal(postsBetween.length, 2)
  assert.equal(postsBetween[0].id, 101)
  assert.equal(postsBetween[1].id, 102)

  const datePosts = db.getPostIdsByDate('2026-10-27', 'validchannel')
  assert.equal(datePosts.length, 1)
  assert.equal(datePosts[0].id, 103)
})

test('savePosts does not cause duplicate writes when posts are already up-to-date', () => {
  const postsToSave = [
    { id: 101, datetime: '2026-10-25T10:00:00Z', isAd: false },
    { id: 102, datetime: '2026-10-26T12:00:00Z', isAd: false },
    { id: 103, datetime: '2026-10-27T08:00:00Z', isAd: false },
  ]

  const statBefore = fs.statSync(customDbPath)
  db.savePosts(postsToSave, 'validchannel')
  const statAfter = fs.statSync(customDbPath)

  assert.equal(statBefore.mtimeMs, statAfter.mtimeMs, 'mtime should not change when posts are already indexed and unmodified')
})
