import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const campaignId = Number(id)
  const body = await req.json()

  if (body.templateId !== undefined) {
    const template = await prisma.emailTemplate.findUnique({ where: { id: Number(body.templateId) } })
    if (!template) return NextResponse.json({ error: 'Sjabloon niet gevonden' }, { status: 404 })

    const updated = await prisma.campaign.update({
      where: { id: campaignId },
      data: { templateId: Number(body.templateId) },
    })
    return NextResponse.json(updated)
  }

  return NextResponse.json({ error: 'Geen geldig veld om bij te werken' }, { status: 400 })
}
