import { NextRequest, NextResponse } from 'next/server'

const ALLOWED_IPS = new Set(['77.173.211.65', '2a02:a465:c59c:1:5517:dc3:6e06:8920'])
// IPv6 prefix match for home connections (ISP prefix stays stable even if suffix rotates)
const ALLOWED_IPV6_PREFIXES = ['2a02:a465:c59c:']
const COOKIE_NAME = 'auth_token'

// Paths that are fully public — no IP check, no auth
const PUBLIC_PREFIXES = ['/uitschrijven', '/api/unsubscribe', '/api/cron/', '/api/img-proxy']

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? '127.0.0.1'
}

// Compute HMAC-SHA256 using Web Crypto (Edge Runtime compatible)
async function computeToken(password: string): Promise<string> {
  const secret = process.env.CRON_SECRET ?? 'auth-secret'
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(password))
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

const blockedHtml = `<!DOCTYPE html>
<html lang="nl"><head><meta charset="utf-8"><title>Toegang geweigerd</title></head>
<body style="margin:0;font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f8fafc;">
  <div style="text-align:center;padding:48px 40px;background:#fff;border-radius:12px;border:1px solid #e2e8f0;box-shadow:0 1px 6px rgba(0,0,0,.06);">
    <p style="font-size:48px;margin:0 0 16px">🔒</p>
    <h1 style="margin:0 0 8px;color:#111827;font-size:20px;">Toegang geweigerd</h1>
    <p style="margin:0;color:#6b7280;font-size:14px;">Dit dashboard is niet toegankelijk vanaf jouw IP-adres.</p>
  </div>
</body></html>`

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Always allow public paths
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // IP check — block anything not from the allowed IP
  const ip = clientIp(req)
  const ipAllowed = ALLOWED_IPS.has(ip) || ALLOWED_IPV6_PREFIXES.some(p => ip.startsWith(p))
  if (!ipAllowed) {
    const html = blockedHtml.replace('vanaf jouw IP-adres.', `vanaf jouw IP-adres (<code>${ip}</code>).`)
    return new Response(html, {
      status: 403,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  // IP is OK — login page and auth API are accessible without a session
  if (pathname === '/login' || pathname.startsWith('/api/auth/')) {
    return NextResponse.next()
  }

  // Everything else requires a valid auth cookie
  const password = process.env.DASHBOARD_PASSWORD ?? ''
  const expected = await computeToken(password)
  const token = req.cookies.get(COOKIE_NAME)?.value

  if (!token || token !== expected) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
}
