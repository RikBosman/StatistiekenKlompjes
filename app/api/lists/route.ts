import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const lists = await prisma.customerList.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { members: true } } },
  })
  return NextResponse.json(lists)
}

export async function POST(req: NextRequest) {
  const data = await req.formData().catch(() => null)
  const name = data?.get('name')?.toString() ?? (await req.json().catch(() => null))?.name

  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })

  const list = await prisma.customerList.create({ data: { name } })

  // Redirect back to email page — use forwarded host when behind a reverse proxy
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? 'localhost:3000'
  const proto = req.headers.get('x-forwarded-proto') ?? 'http'
  return NextResponse.redirect(`${proto}://${host}/dashboard/email`)
}
