import { webMcpTools } from '../scripts/webmcp.js'

const corsHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'no-cache',
}

function getFormattedTools() {
  return webMcpTools.map(t => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  }))
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  })
}

export async function GET() {
  const tools = getFormattedTools()
  return new Response(
    JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      result: {
        serverInfo: {
          name: 'tg-channel-web',
          version: '1.0.0',
          provider: 'david888.com',
          spec: 'https://modelcontextprotocol.io',
        },
        tools,
      },
    }, null, 2),
    { status: 200, headers: corsHeaders }
  )
}

export async function POST(context) {
  let body = {}
  try {
    const text = await context.request.text()
    if (text) {
      body = JSON.parse(text)
    }
  } catch {
    return new Response(
      JSON.stringify({
        jsonrpc: '2.0',
        id: null,
        error: { code: -32700, message: 'Parse error' },
      }),
      { status: 400, headers: corsHeaders }
    )
  }

  const reqId = body?.id ?? 1
  const method = body?.method || ''
  const tools = getFormattedTools()

  if (method === 'initialize') {
    return new Response(
      JSON.stringify({
        jsonrpc: '2.0',
        id: reqId,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {},
          },
          serverInfo: {
            name: 'tg-channel-web',
            version: '1.0.0',
            provider: 'david888.com',
          },
        },
      }),
      { status: 200, headers: corsHeaders }
    )
  }

  if (method === 'tools/list') {
    return new Response(
      JSON.stringify({
        jsonrpc: '2.0',
        id: reqId,
        result: {
          tools,
        },
      }),
      { status: 200, headers: corsHeaders }
    )
  }

  if (method === 'ping') {
    return new Response(
      JSON.stringify({
        jsonrpc: '2.0',
        id: reqId,
        result: {},
      }),
      { status: 200, headers: corsHeaders }
    )
  }

  return new Response(
    JSON.stringify({
      jsonrpc: '2.0',
      id: reqId,
      result: {
        status: 'ok',
        server: 'david888.com tg-channel MCP',
        tools,
      },
    }),
    { status: 200, headers: corsHeaders }
  )
}
