import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

const BLOCKED_DOMAINS = ['@verkopen.bol.com', '@bol.com']

export async function GET() {
  return doCleanup()
}

async function doCleanup() {
  const results: Record<string, number> = {}

  for (const domain of BLOCKED_DOMAINS) {
    const deleted = await prisma.campaignRecipient.deleteMany({
      where: { email: { endsWith: domain } },
    })
    results[domain] = deleted.count
  }

  return NextResponse.json({ ok: true, deleted: results })
}

export async function POST() {
  return doCleanup()
}
