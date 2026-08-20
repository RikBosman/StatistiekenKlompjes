import { NextResponse } from 'next/server'
import { syncOrders } from '@/lib/sync'

// Protected by middleware (IP + auth cookie) — no extra secret needed
export async function POST(req: Request) {
  try {
    let afterDate: string | undefined
    try {
      const body = await req.json()
      if (typeof body?.days === 'number' && body.days > 0) {
        const d = new Date()
        d.setDate(d.getDate() - body.days)
        afterDate = d.toISOString()
      }
    } catch {
      // No body or invalid JSON — use incremental default
    }
    const result = await syncOrders(afterDate)
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
