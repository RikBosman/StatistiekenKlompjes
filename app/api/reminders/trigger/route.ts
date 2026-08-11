import { NextRequest, NextResponse } from 'next/server'
import { processReminders } from '@/lib/reminders'

export async function POST(_req: NextRequest) {
  const result = await processReminders()
  return NextResponse.redirect(new URL('/dashboard/customers', _req.url))
}
