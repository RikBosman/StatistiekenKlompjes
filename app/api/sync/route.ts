import { NextRequest, NextResponse } from 'next/server'
import { syncProducts, syncOrders } from '@/lib/sync'

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [products, orders] = await Promise.all([syncProducts(), syncOrders()])
  return NextResponse.json({ products: products.count, orders: orders.count })
}
