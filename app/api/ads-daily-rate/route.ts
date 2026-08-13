import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const Schema = z.object({ rate: z.number().nonnegative() })

export async function POST(req: Request) {
  try {
    const parsed = Schema.safeParse(await req.json())
    if (!parsed.success) return NextResponse.json({ error: 'Ongeldig bedrag' }, { status: 400 })

    await prisma.settings.upsert({
      where: { key: 'ads_daily_rate' },
      create: { key: 'ads_daily_rate', value: String(parsed.data.rate) },
      update: { value: String(parsed.data.rate) },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function GET() {
  const setting = await prisma.settings.findUnique({ where: { key: 'ads_daily_rate' } })
  return NextResponse.json({ rate: setting ? parseFloat(setting.value) : 0 })
}
