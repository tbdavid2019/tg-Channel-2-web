import {
  getTurnstileConfig,
  verifyTurnstileToken,
  createClearanceCookie,
  TURNSTILE_COOKIE_NAME,
  TURNSTILE_COOKIE_MAX_AGE,
} from '../../lib/turnstile.js'

const allowedActions = new Set(['site_access', 'channel_search', 'article_search'])

function getRequestHostname(request) {
  const origin = request.headers.get('origin')
  if (origin) {
    try {
      return new URL(origin).hostname.toLowerCase()
    } catch {
      return ''
    }
  }

  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0].trim()
  const host = forwardedHost || request.headers.get('host') || new URL(request.url).hostname
  try {
    return new URL(host.includes('://') ? host : `https://${host}`).hostname.toLowerCase()
  } catch {
    return ''
  }
}

export async function POST(context) {
  const { request } = context
  const { secretKey, enabled } = getTurnstileConfig(import.meta.env, context)

  if (!enabled || !secretKey) {
    return Response.json({ success: true, bypassed: true })
  }

  let body
  try {
    const contentType = request.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      body = await request.json()
    } else {
      const formData = await request.formData()
      body = {
        token: formData.get('cf-turnstile-response') || formData.get('token'),
      }
    }
  } catch {
    return Response.json({ success: false, error: 'invalid-request-body' }, { status: 400 })
  }

  const token = body?.token
  if (!token || typeof token !== 'string') {
    return Response.json({ success: false, error: 'missing-token' }, { status: 400 })
  }
  const action = typeof body?.action === 'string' ? body.action : 'site_access'
  if (!allowedActions.has(action)) {
    return Response.json({ success: false, error: 'invalid-action' }, { status: 400 })
  }

  // Determine client IP
  const clientIp =
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    context.clientAddress ||
    ''

  const userAgent = request.headers.get('user-agent') || ''

  const result = await verifyTurnstileToken({
    secretKey,
    token,
    clientIp,
  })

  if (!result.success) {
    return Response.json(
      { success: false, error: result.error || 'verification-failed', details: result.errorCodes },
      { status: 403 }
    )
  }

  const verifiedAction = result.data?.action
  const verifiedHostname = String(result.data?.hostname || '').toLowerCase()
  if (verifiedAction !== action || verifiedHostname !== getRequestHostname(request)) {
    return Response.json({ success: false, error: 'verification-context-mismatch' }, { status: 403 })
  }

  // Create signed clearance cookie
  const cookieValue = await createClearanceCookie(secretKey, userAgent)
  const isSecure = request.url.startsWith('https:') || request.headers.get('x-forwarded-proto') === 'https'

  const cookieHeader = [
    `${TURNSTILE_COOKIE_NAME}=${cookieValue}`,
    'Path=/',
    `Max-Age=${TURNSTILE_COOKIE_MAX_AGE}`,
    'HttpOnly',
    'SameSite=Lax',
    ...(isSecure ? ['Secure'] : []),
  ].join('; ')

  return Response.json(
    { success: true },
    {
      status: 200,
      headers: {
        'Set-Cookie': cookieHeader,
      },
    }
  )
}
