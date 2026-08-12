import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendCampaign } from '@/lib/campaigns'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const campaignId = Number(id)

    // Reset failed recipients back to pending so sendCampaign picks them up
    await prisma.campaignRecipient.updateMany({
      where: { campaignId, status: 'failed' },
      data: { status: 'pending', error: null, sentAt: null },
    })

    // Reset campaign status so it can be sent again
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'draft' },
    })

    const result = await sendCampaign(campaignId)
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
