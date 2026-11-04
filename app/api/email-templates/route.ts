import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const schema = z.object({
  id: z.number().optional(),
  name: z.string().min(1),
  subject: z.string().min(1),
  bodyHtml: z.string().min(1),
  bodyJson: z.string().optional(),
  isDefault: z.boolean().optional(),
})

export async function GET() {
  const templates = await prisma.emailTemplate.findMany({ orderBy: { updatedAt: 'desc' } })
  return NextResponse.json(templates)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { name, subject, bodyHtml, bodyJson, isDefault } = parsed.data
  const template = await prisma.emailTemplate.create({
    data: { name, subject, bodyHtml, bodyJson: bodyJson ?? '{}', isDefault: isDefault ?? false },
  })
  return NextResponse.json(template, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = Number(searchParams.get('id'))
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const usedBy = await prisma.campaign.count({ where: { templateId: id } })
  if (usedBy > 0) {
    return NextResponse.json(
      { error: `Dit sjabloon wordt gebruikt door ${usedBy} campagne(s) en kan niet worden verwijderd.` },
      { status: 409 }
    )
  }

  await prisma.emailTemplate.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}

export async function PUT(req: NextRequest) {
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { id, name, subject, bodyHtml, bodyJson, isDefault } = parsed.data
  if (!id) {
    return NextResponse.json({ error: 'id required for PUT' }, { status: 400 })
  }

  const template = await prisma.emailTemplate.update({
    where: { id },
    data: { name, subject, bodyHtml, bodyJson: bodyJson ?? '{}', isDefault: isDefault ?? false },
  })
  return NextResponse.json(template)
}
