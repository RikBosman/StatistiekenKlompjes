import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const schema = z.object({ customerId: z.number().int() })

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: 'customerId required' }, { status: 400 })

  await prisma.customerListMember.upsert({
    where: { listId_customerId: { listId: Number(params.id), customerId: parsed.data.customerId } },
    create: { listId: Number(params.id), customerId: parsed.data.customerId },
    update: {},
  })

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { customerId } = await req.json()
  await prisma.customerListMember.delete({
    where: { listId_customerId: { listId: Number(params.id), customerId } },
  })
  return NextResponse.json({ ok: true })
}
