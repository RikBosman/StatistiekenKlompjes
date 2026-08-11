import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const schema = z.object({
  id: z.number().optional(),
  name: z.string().min(1),
  subject: z.string().min(1),
  bodyHtml: z.string().min(1),
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

  const { name, subject, bodyHtml, isDefault } = parsed.data
  const template = await prisma.emailTemplate.create({
    data: { name, subject, bodyHtml, isDefault: isDefault ?? false },
  })
  return NextResponse.json(template, { status: 201 })
}

export async function PUT(req: NextRequest) {
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { id, name, subject, bodyHtml, isDefault } = parsed.data
  if (!id) {
    return NextResponse.json({ error: 'id required for PUT' }, { status: 400 })
  }

  const template = await prisma.emailTemplate.update({
    where: { id },
    data: { name, subject, bodyHtml, isDefault: isDefault ?? false },
  })
  return NextResponse.json(template)
}
