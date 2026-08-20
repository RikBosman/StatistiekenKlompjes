import { NextResponse } from 'next/server'
import { syncOrders } from '@/lib/sync'

// Protected by middleware (IP + auth cookie) — no extra secret needed
export async function POST() {
  try {
    const result = await syncOrders()
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
