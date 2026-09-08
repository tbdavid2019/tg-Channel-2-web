import assert from 'node:assert/strict'
import test from 'node:test'
import { webMcpTools, initWebMcp } from '../src/scripts/webmcp.js'

test('webMcpTools exposes the required tools with valid schemas', () => {
  assert.ok(Array.isArray(webMcpTools))
  assert.ok(webMcpTools.length >= 6, `Expected at least 6 tools, got ${webMcpTools.length}`)

  const toolNames = webMcpTools.map(t => t.name)
  assert.ok(toolNames.includes('navigate-channel'))
  assert.ok(toolNames.includes('search-articles'))
  assert.ok(toolNames.includes('get-random-channel'))
  assert.ok(toolNames.includes('navigate-random-channel'))
  assert.ok(toolNames.includes('switch-language'))
  assert.ok(toolNames.includes('get-current-channel-info'))
  assert.ok(toolNames.includes('filter-by-date'))

  for (const tool of webMcpTools) {
    assert.ok(tool.name, 'Tool should have a name')
    assert.ok(tool.description, `Tool ${tool.name} should have a description`)
    assert.ok(tool.inputSchema, `Tool ${tool.name} should have an inputSchema`)
    assert.equal(typeof tool.execute, 'function', `Tool ${tool.name} should have execute function`)
  }
})

test('navigate-channel tool correctly normalizes valid and invalid targets', async () => {
  const navTool = webMcpTools.find(t => t.name === 'navigate-channel')
  assert.ok(navTool)

  // Empty
  const emptyRes = await navTool.execute({ channel: '' })
  assert.equal(emptyRes.ok, false)

  // Invalid invite
  const inviteRes = await navTool.execute({ channel: 'https://t.me/+AbCdEf' })
  assert.equal(inviteRes.ok, false)
  assert.equal(inviteRes.code, 'invite')

  // Valid handle
  let navigatedUrl = ''
  global.window = {
    location: {
      assign(url) {
        navigatedUrl = url
      }
    }
  }

  const validRes = await navTool.execute({ channel: '@oliservice' })
  assert.equal(validRes.ok, true)
  assert.equal(validRes.handle, 'oliservice')
  assert.equal(navigatedUrl, '/oliservice/')
})

test('filter-by-date tool validates YYYY-MM-DD pattern', async () => {
  const dateTool = webMcpTools.find(t => t.name === 'filter-by-date')
  assert.ok(dateTool)

  const invalidRes = await dateTool.execute({ date: 'not-a-date' })
  assert.equal(invalidRes.ok, false)
})
