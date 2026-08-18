import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const Schema = z.object({
  year: z.number().int().min(2020).max(2030),
  month: z.number().int().min(1).max(12),
  amountExclBtw: z.number().positive(),
  filename: z.string().optional(),
})

export async function POST(req: Request) {
  try {
    const parsed = Schema.safeParse(await req.json())
    if (!parsed.success) return NextResponse.json({ error: 'Ongeldige invoer' }, { status: 400 })

    const { year, month, amountExclBtw, filename } = parsed.data
    await prisma.shippingInvoice.upsert({
      where: { year_month: { year, month } },
      create: { year, month, amountExclBtw, filename },
      update: { amountExclBtw, filename },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const { year, month } = await req.json()
    await prisma.shippingInvoice.delete({ where: { year_month: { year: Number(year), month: Number(month) } } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
