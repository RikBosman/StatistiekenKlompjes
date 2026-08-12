import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const fd = await req.formData()
  const customerId = Number(fd.get('customerId'))

  if (!customerId) return NextResponse.json({ error: 'customerId required' }, { status: 400 })

  await prisma.customerListMember.deleteMany({
    where: { listId: Number(id), customerId },
  })

  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? 'localhost:3000'
  const proto = req.headers.get('x-forwarded-proto') ?? 'http'
  return NextResponse.redirect(`${proto}://${host}/dashboard/email/lists/${id}`)
}
