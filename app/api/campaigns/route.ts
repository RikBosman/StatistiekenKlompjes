import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { prepareCampaign } from '@/lib/campaigns'
import { z } from 'zod'
import type { SegmentType } from '@/lib/segments'

const SEGMENT_TYPES: [SegmentType, ...SegmentType[]] = [
  'logo_buyer', 'repeat_buyer', 'inactive_3m', 'top_customers', 'list',
  'emmer_buyer', 'glaswerk_buyer', 'gravering_buyer', 'klompen_logo_buyer', 'tulp_buyer',
  'cross_emmer_glaswerk', 'cross_glaswerk_emmer', 'cross_logo_gravering', 'cross_gravering_logo',
]

const schema = z.object({
  name: z.string().min(1),
  templateId: z.number().int(),
  segmentType: z.enum(SEGMENT_TYPES),
  listId: z.number().int().nullable().optional(),
})

export async function GET() {
  const campaigns = await prisma.campaign.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      template: { select: { name: true } },
      _count: { select: { recipients: true } },
    },
  })
  return NextResponse.json(campaigns)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const campaign = await prisma.campaign.create({
    data: {
      name: parsed.data.name,
      templateId: parsed.data.templateId,
      segmentType: parsed.data.segmentType,
      listId: parsed.data.listId ?? null,
    },
  })

  await prepareCampaign(campaign.id)

  return NextResponse.json(campaign, { status: 201 })
}
