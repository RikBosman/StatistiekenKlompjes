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

  // Redirect back to email page after form POST
  return NextResponse.redirect(new URL('/dashboard/email', req.url))
}
