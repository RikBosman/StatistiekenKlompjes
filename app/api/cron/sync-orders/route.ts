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

  const result = await syncOrders()
  return NextResponse.json(result)
}
