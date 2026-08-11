import { prisma } from './db'
import { subMonths } from 'date-fns'

export type SegmentType = 'logo_buyer' | 'inactive_3m' | 'top_customers' | 'repeat_buyer' | 'list'

export interface SegmentCustomer {
  id: number
  email: string
  firstName: string
  lastName: string
  totalRevenue?: number
  lastOrderDate?: Date
  orderCount?: number
}

export async function getSegmentCustomers(
  segmentType: SegmentType,
  listId?: number
): Promise<SegmentCustomer[]> {
  if (segmentType === 'logo_buyer') {
    const customers = await prisma.customer.findMany({
      where: { tags: { contains: 'logo_buyer' } },
      select: { id: true, email: true, firstName: true, lastName: true },
    })
    return customers
  }

  if (segmentType === 'inactive_3m') {
    const cutoff = subMonths(new Date(), 3)
    const customers = await prisma.customer.findMany({
      where: {
        orders: {
          none: {
            date: { gte: cutoff },
            status: { notIn: ['cancelled', 'refunded'] },
          },
        },
      },
      include: {
        orders: {
          where: { status: { notIn: ['cancelled', 'refunded'] } },
          orderBy: { date: 'desc' },
          take: 1,
          select: { date: true },
        },
      },
    })
    return customers
      .filter((c) => c.orders.length > 0)
      .map((c) => ({
        id: c.id,
        email: c.email,
        firstName: c.firstName,
        lastName: c.lastName,
        lastOrderDate: c.orders[0]?.date,
      }))
  }

  if (segmentType === 'top_customers') {
    const customers = await prisma.customer.findMany({
      include: {
        orders: {
          where: { status: { notIn: ['cancelled', 'refunded'] } },
          select: { total: true },
        },
      },
    })
    return customers
      .map((c) => ({
        id: c.id,
        email: c.email,
        firstName: c.firstName,
        lastName: c.lastName,
        totalRevenue: c.orders.reduce((s, o) => s + o.total, 0),
        orderCount: c.orders.length,
      }))
      .filter((c) => c.totalRevenue > 0)
      .sort((a, b) => (b.totalRevenue ?? 0) - (a.totalRevenue ?? 0))
      .slice(0, 500)
  }

  if (segmentType === 'repeat_buyer') {
    const customers = await prisma.customer.findMany({
      include: {
        orders: {
          where: { status: { notIn: ['cancelled', 'refunded'] } },
          select: { total: true, date: true },
        },
      },
    })
    return customers
      .filter((c) => c.orders.length >= 2)
      .map((c) => ({
        id: c.id,
        email: c.email,
        firstName: c.firstName,
        lastName: c.lastName,
        orderCount: c.orders.length,
        totalRevenue: c.orders.reduce((s, o) => s + o.total, 0),
        lastOrderDate: c.orders.sort((a, b) => b.date.getTime() - a.date.getTime())[0]?.date,
      }))
      .sort((a, b) => (b.orderCount ?? 0) - (a.orderCount ?? 0))
  }

  if (segmentType === 'list' && listId) {
    const members = await prisma.customerListMember.findMany({
      where: { listId },
      include: { customer: true },
    })
    return members.map((m) => ({
      id: m.customer.id,
      email: m.customer.email,
      firstName: m.customer.firstName,
      lastName: m.customer.lastName,
    }))
  }

  return []
}

export function segmentLabel(type: SegmentType): string {
  const labels: Record<SegmentType, string> = {
    logo_buyer: 'Logo / tekst kopers',
    inactive_3m: 'Slapende klanten (3m+)',
    top_customers: 'Top klanten (op omzet)',
    repeat_buyer: 'Vaste klanten (2+ bestellingen)',
    list: 'Handmatige lijst',
  }
  return labels[type]
}
