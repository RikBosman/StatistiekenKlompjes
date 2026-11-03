import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendCampaign } from '@/lib/campaigns'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Find campaigns with a daily limit that still have pending recipients
  const campaigns = await prisma.campaign.findMany({
    where: {
      dailyLimit: { gt: 0 },
      status: { in: ['sending', 'draft'] },
      recipients: { some: { status: 'pending' } },
    },
  })

  const results = []

  for (const campaign of campaigns) {
    try {
      const result = await sendCampaign(campaign.id, campaign.dailyLimit)
      results.push({ id: campaign.id, name: campaign.name, ...result })
    } catch (err) {
      results.push({ id: campaign.id, name: campaign.name, error: String(err) })
    }
  }

  return NextResponse.json({ ok: true, processed: results, at: new Date() })
}
