import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? 'localhost:3000'
  const proto = req.headers.get('x-forwarded-proto') ?? 'http'
  const res = NextResponse.redirect(`${proto}://${host}/login`)
  res.cookies.delete('auth_token')
  return res
}
