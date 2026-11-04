import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(req: NextRequest) {
  const { email } = await req.json()
  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'E-mailadres vereist' }, { status: 400 })
  }

  const normalizedEmail = email.trim().toLowerCase()
  // SQLite = is case-sensitive, use raw LOWER() for reliable match
  const customers = await prisma.$queryRaw<Array<{ id: number; firstName: string; lastName: string; email: string }>>`
    SELECT id, firstName, lastName, email FROM customers WHERE LOWER(email) = ${normalizedEmail} LIMIT 1
  `
  const customer = customers[0]
    ? { ...customers[0], _count: { orders: await prisma.order.count({ where: { customerId: customers[0].id } }) } }
    : null

  if (!customer) {
    return NextResponse.json({ error: `Geen klant gevonden: ${email}` }, { status: 404 })
  }

  await prisma.order.updateMany({ where: { customerId: customer.id }, data: { customerId: null } })
  await prisma.campaignRecipient.deleteMany({ where: { customerId: customer.id } })
  await prisma.reminder.deleteMany({ where: { customerId: customer.id } })
  await prisma.customerListMember.deleteMany({ where: { customerId: customer.id } })
  await prisma.customer.delete({ where: { id: customer.id } })

  return NextResponse.json({
    ok: true,
    message: `${customer.firstName} ${customer.lastName} (${email}) volledig verwijderd. ${customer._count.orders} orders bewaard voor statistieken.`,
  })
}
