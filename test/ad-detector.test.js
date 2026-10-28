import assert from 'node:assert/strict'
import test from 'node:test'
import http from 'node:http'
import { detectIsAd } from '../src/lib/ad-detector.js'

test('detectIsAd returns false on empty, short, or invalid inputs without network calls', async () => {
  assert.equal(await detectIsAd(''), false)
  assert.equal(await detectIsAd('   '), false)
  assert.equal(await detectIsAd('hi'), false)
  assert.equal(await detectIsAd(null), false)
  assert.equal(await detectIsAd(undefined), false)
})

test('detectIsAd detects explicit promo tags and patterns instantly without network calls', async () => {
  assert.equal(await detectIsAd('#系统推送 中文TG搜索bot，输入关键词发送'), true)
  assert.equal(await detectIsAd('飞鸟VPN | 一键解锁全球网络 高速专线'), true)
  assert.equal(await detectIsAd('本频道开启 #互推 合作，欢迎联系'), true)
  assert.equal(await detectIsAd('全场 8.8折 优惠，支持 USDT支付'), true)
})

test('detectIsAd correctly uses primary endpoint and parses noul probability', async () => {
  const server = http.createServer((req, res) => {
    let body = ''
    req.on('data', chunk => { body += chunk })
    req.on('end', () => {
      const parsed = JSON.parse(body)
      assert.equal(parsed.model, 'clef-flash')
      assert.ok(parsed.questions.is_ad)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        model: 'clef-flash',
        answers: { is_ad: { type: 'noul', noul: 0.95 } }
      }))
    })
  })

  await new Promise(resolve => server.listen(0, resolve))
  const port = server.address().port

  try {
    const isAd = await detectIsAd('這是測試貼文內容，包含商業推廣與廣告訊息。', {
      primaryUrl: `http://localhost:${port}/v1/systemone`,
      timeoutMs: 2000,
    })
    assert.equal(isAd, true)
  } finally {
    server.close()
  }
})

test('detectIsAd seamlessly falls back to fallback node when primary fails (500/timeout)', async () => {
  let primaryCalled = false
  let fallbackCalled = false

  const primaryServer = http.createServer((req, res) => {
    primaryCalled = true
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Primary server error' }))
  })

  const fallbackServer = http.createServer((req, res) => {
    fallbackCalled = true
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      model: 'clef-flash-q4',
      answers: { is_ad: { type: 'noul', noul: 0.88 } }
    }))
  })

  await new Promise(resolve => primaryServer.listen(0, resolve))
  await new Promise(resolve => fallbackServer.listen(0, resolve))

  const pPort = primaryServer.address().port
  const fPort = fallbackServer.address().port

  try {
    const isAd = await detectIsAd('這是測試備援轉移的推廣廣告訊息。', {
      primaryUrl: `http://localhost:${pPort}/v1/systemone`,
      fallbackUrl: `http://localhost:${fPort}/v1/systemone`,
      timeoutMs: 2000,
    })
    assert.equal(primaryCalled, true)
    assert.equal(fallbackCalled, true)
    assert.equal(isAd, true)
  } finally {
    primaryServer.close()
    fallbackServer.close()
  }
})

test('detectIsAd fails open (returns false, never throws) when both nodes fail', async () => {
  const isAd = await detectIsAd('隨便貼文內容，兩台皆掛掉的測試', {
    primaryUrl: 'http://127.0.0.1:59999/v1/systemone',
    fallbackUrl: 'http://127.0.0.1:59998/v1/systemone',
    timeoutMs: 300,
  })
  assert.equal(isAd, false)
})

test('detectIsAd returns false when noul probability is below 0.70 threshold', async () => {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      model: 'clef-flash',
      answers: { is_ad: { type: 'noul', noul: 0.05 } }
    }))
  })

  await new Promise(resolve => server.listen(0, resolve))
  const port = server.address().port

  try {
    const isAd = await detectIsAd('這是一篇正常的科技新聞報導，不含廣告。', {
      primaryUrl: `http://localhost:${port}/v1/systemone`,
      timeoutMs: 2000,
    })
    assert.equal(isAd, false)
  } finally {
    server.close()
  }
})

test('detectIsAd handles malformed json gracefully by failing open', async () => {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end('invalid json response {{{')
  })

  await new Promise(resolve => server.listen(0, resolve))
  const port = server.address().port

  try {
    const isAd = await detectIsAd('測試異常回應', {
      primaryUrl: `http://localhost:${port}/v1/systemone`,
      fallbackUrl: `http://localhost:${port}/v1/systemone`,
      timeoutMs: 2000,
    })
    assert.equal(isAd, false)
  } finally {
    server.close()
  }
})
