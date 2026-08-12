import { NextResponse } from 'next/server'
import { syncOrders } from '@/lib/sync'

// Protected by middleware (IP + cookie) — no additional auth needed
export async function POST() {
  // Sync all orders from the beginning of time to pick up all guest customers
  const result = await syncOrders('2026-01-01T00:00:00')
  return NextResponse.json(result)
}
