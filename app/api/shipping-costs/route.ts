import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const SaveSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  amount: z.number().nonnegative(),
})

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const parsed = SaveSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'Ongeldige invoer' }, { status: 400 })

    const { month, amount } = parsed.data
    const key = `shipping_actual_${month}`

    await prisma.settings.upsert({
      where: { key },
      create: { key, value: String(amount) },
      update: { value: String(amount) },
    })

    return NextResponse.json({ ok: true, month, amount })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const { month } = await req.json()
    await prisma.settings.delete({ where: { key: `shipping_actual_${month}` } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: true }) // ignore if not found
  }
}

export async function GET() {
  const settings = await prisma.settings.findMany({
    where: { key: { startsWith: 'shipping_actual_' } },
    orderBy: { key: 'desc' },
  })
  const data = settings.map((s) => ({
    month: s.key.replace('shipping_actual_', ''),
    amount: parseFloat(s.value),
  }))
  return NextResponse.json(data)
}
