import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

function computeToken(password: string): string {
  const secret = process.env.CRON_SECRET ?? 'auth-secret'
  return crypto.createHmac('sha256', secret).update(password).digest('hex')
}

export async function POST(req: NextRequest) {
  const fd = await req.formData()
  const password = fd.get('password')?.toString() ?? ''

  const expected = process.env.DASHBOARD_PASSWORD ?? ''

  if (!password || password !== expected) {
    return NextResponse.redirect(new URL('/login?error=1', req.url))
  }

  const token = computeToken(password)
  const res = NextResponse.redirect(new URL('/dashboard', req.url))
  res.cookies.set('auth_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
  })
  return res
}
