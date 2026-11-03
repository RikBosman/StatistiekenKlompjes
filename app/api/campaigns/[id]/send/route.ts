import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendCampaign } from '@/lib/campaigns'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const campaignId = Number(id)

    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } })
    if (!campaign) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })

    // For batched campaigns, only send first batch now; cron handles the rest
    const limit = campaign.dailyLimit > 0 ? campaign.dailyLimit : undefined
    const result = await sendCampaign(campaignId, limit)
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
