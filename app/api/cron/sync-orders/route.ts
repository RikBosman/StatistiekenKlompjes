import { NextRequest, NextResponse } from 'next/server'
import { syncOrders } from '@/lib/sync'

function authorized(req: NextRequest) {
  const auth = req.headers.get('authorization')
  return auth === `Bearer ${process.env.CRON_SECRET}`
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const after = searchParams.get('after') ?? undefined
  const before = searchParams.get('before') ?? undefined

  const result = await syncOrders(after, before)
  return NextResponse.json(result)
}
