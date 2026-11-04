import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

const BLOCKED_DOMAINS = ['@verkopen.bol.com']

export async function POST() {
  const results: Record<string, number> = {}

  for (const domain of BLOCKED_DOMAINS) {
    // Remove campaign recipients with blocked domain
    const deleted = await prisma.campaignRecipient.deleteMany({
      where: { email: { endsWith: domain } },
    })
    results[domain] = deleted.count
  }

  return NextResponse.json({ ok: true, deleted: results })
}
