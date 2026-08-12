import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const schema = z.union([
  z.object({ customerId: z.number().int() }),
  z.object({ email: z.string().email() }),
])

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // Support both JSON body and form submission
  let body: unknown
  const ct = req.headers.get('content-type') ?? ''
  if (ct.includes('application/x-www-form-urlencoded') || ct.includes('multipart/form-data')) {
    const fd = await req.formData()
    const email = fd.get('email')?.toString()
    body = email ? { email } : {}
  } else {
    body = await req.json().catch(() => ({}))
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'customerId or email required' }, { status: 400 })

  let customerId: number
  if ('email' in parsed.data) {
    const customer = await prisma.customer.findFirst({ where: { email: parsed.data.email } })
    if (!customer) {
      // Redirect back with error if form POST
      const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? 'localhost:3000'
      const proto = req.headers.get('x-forwarded-proto') ?? 'http'
      return NextResponse.redirect(`${proto}://${host}/dashboard/email/lists/${id}?error=not_found`)
    }
    customerId = customer.id
  } else {
    customerId = parsed.data.customerId
  }

  await prisma.customerListMember.upsert({
    where: { listId_customerId: { listId: Number(id), customerId } },
    create: { listId: Number(id), customerId },
    update: {},
  })

  // Redirect back if this came from a form POST
  const ct2 = req.headers.get('content-type') ?? ''
  if (ct2.includes('application/x-www-form-urlencoded') || ct2.includes('multipart/form-data')) {
    const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? 'localhost:3000'
    const proto = req.headers.get('x-forwarded-proto') ?? 'http'
    return NextResponse.redirect(`${proto}://${host}/dashboard/email/lists/${id}`)
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { customerId } = await req.json()
  await prisma.customerListMember.delete({
    where: { listId_customerId: { listId: Number(id), customerId } },
  })
  return NextResponse.json({ ok: true })
}
