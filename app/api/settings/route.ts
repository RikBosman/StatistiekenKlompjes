import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const Schema = z.object({
  key: z.string().min(1),
  value: z.union([z.string(), z.number()]),
})

export async function POST(req: Request) {
  try {
    const parsed = Schema.safeParse(await req.json())
    if (!parsed.success) return NextResponse.json({ error: 'Ongeldige invoer' }, { status: 400 })

    const { key, value } = parsed.data
    await prisma.settings.upsert({
      where: { key },
      create: { key, value: String(value) },
      update: { value: String(value) },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
