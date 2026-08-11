import { NextRequest, NextResponse } from 'next/server'
import { syncProducts, syncOrders } from '@/lib/sync'

export async function POST(_req: NextRequest) {
  const [products, orders] = await Promise.all([syncProducts(), syncOrders()])
  return NextResponse.redirect(new URL('/dashboard', _req.url))
}
