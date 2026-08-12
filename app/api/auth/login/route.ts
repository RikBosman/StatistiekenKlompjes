import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

function computeToken(password: string): string {
  const secret = process.env.CRON_SECRET ?? 'auth-secret'
  return crypto.createHmac('sha256', secret).update(password).digest('hex')
}

function baseUrl(req: NextRequest): string {
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? 'localhost:3000'
  const proto = req.headers.get('x-forwarded-proto') ?? 'http'
  return `${proto}://${host}`
}

export async function POST(req: NextRequest) {
  const fd = await req.formData()
  const password = fd.get('password')?.toString() ?? ''

  const expected = process.env.DASHBOARD_PASSWORD ?? ''

  if (!password || password !== expected) {
    return NextResponse.redirect(`${baseUrl(req)}/login?error=1`)
  }

  const token = computeToken(password)
  const res = NextResponse.redirect(`${baseUrl(req)}/dashboard`)
  res.cookies.set('auth_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
  })
  return res
}
