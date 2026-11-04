import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(req: NextRequest) {
  const { email } = await req.json()
  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'E-mailadres vereist' }, { status: 400 })
  }

  const customer = await prisma.customer.findFirst({
    where: { email: email.trim().toLowerCase() },
    include: { _count: { select: { orders: true } } },
  })

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
