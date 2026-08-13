import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const BulkSchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
  spend: z.number().positive(),
  campaign: z.string().min(1).default('Google Ads'),
  campaignId: z.string().min(1).default('google-ads'),
})

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const parsed = BulkSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'Ongeldige invoer' }, { status: 400 })

    const { startDate, endDate, spend, campaign, campaignId } = parsed.data
    const start = new Date(startDate + 'T00:00:00.000Z')
    const end = new Date(endDate + 'T00:00:00.000Z')

    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
      return NextResponse.json({ error: 'Ongeldige datums' }, { status: 400 })
    }

    const days: Date[] = []
    const d = new Date(start)
    while (d <= end) {
      days.push(new Date(d))
      d.setUTCDate(d.getUTCDate() + 1)
    }

    if (days.length > 366) {
      return NextResponse.json({ error: 'Maximaal 1 jaar per keer' }, { status: 400 })
    }

    let saved = 0
    for (const date of days) {
      await prisma.adSpend.upsert({
        where: { date_campaignId: { date, campaignId } },
        create: { date, campaign, campaignId, spend },
        update: { spend, campaign },
      })
      saved++
    }

    return NextResponse.json({ saved })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const { id } = await req.json()
    if (!id) return NextResponse.json({ error: 'id vereist' }, { status: 400 })
    await prisma.adSpend.delete({ where: { id: Number(id) } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
