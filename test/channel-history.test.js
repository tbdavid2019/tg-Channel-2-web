import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

const testDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'telegram-reader-history-'))
process.env.DB_PATH = path.join(testDataDir, 'posts.json')
const { getRecentChannels, recordChannelVisit } = await import('../src/lib/db/index.js?history-test')

test('records public channel visits and ranks the top ten', () => {
  recordChannelVisit({ handle: 'oliservice', title: 'Oli Service' })
  recordChannelVisit({ handle: 'oliservice', title: 'Oli Service' })
  recordChannelVisit({ handle: 'telegramnews', title: 'Telegram News' })
  recordChannelVisit({ handle: 'not valid', title: 'Ignored' })

  assert.deepEqual(getRecentChannels().map(channel => [channel.handle, channel.count]), [
    ['oliservice', 2],
    ['telegramnews', 1],
  ])
})

test('limits the result to ten channels', () => {
  for (let index = 0; index < 12; index += 1) {
    recordChannelVisit({ handle: `channel${index}`, title: `Channel ${index}` })
  }

  assert.equal(getRecentChannels().length, 10)
})

test('expires visits older than seven days', () => {
  const databasePath = process.env.DB_PATH
  const database = JSON.parse(fs.readFileSync(databasePath, 'utf8'))
  database.channelHistory.push({
    handle: 'expiredchannel',
    title: 'Expired Channel',
    avatar: '',
    visits: [Date.now() - (1000 * 60 * 60 * 24 * 8)],
  })
  fs.writeFileSync(databasePath, JSON.stringify(database), 'utf8')

  assert.equal(getRecentChannels().some(channel => channel.handle === 'expiredchannel'), false)
})
