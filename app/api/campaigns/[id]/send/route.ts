import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendCampaign } from '@/lib/campaigns'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const campaignId = Number(id)

    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } })
    if (!campaign) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })

    // Cap at 200 per request to avoid HTTP timeout; user clicks retry for remaining
    const limit = campaign.dailyLimit > 0 ? Math.min(campaign.dailyLimit, 200) : 200
    const result = await sendCampaign(campaignId, limit)
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
