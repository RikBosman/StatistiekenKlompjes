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

function validOrder(status: string): boolean {
  return status !== 'cancelled' && status !== 'refunded'
}

const LOGO_NAMES = ['logo', 'tekst', 'Logo', 'Tekst']
function isLogoItem(name: string): boolean {
  return LOGO_NAMES.some((k) => name.includes(k))
}

export async function getSegmentCustomers(
  segmentType: SegmentType,
  listId?: number
): Promise<SegmentCustomer[]> {
  if (segmentType === 'logo_buyer') {
    // Find logo/tekst order items first, join orders in JS to avoid notIn
    const items = await prisma.orderItem.findMany({
      where: { OR: [{ name: { contains: 'logo' } }, { name: { contains: 'tekst' } }] },
      select: { order: { select: { status: true, customerId: true, date: true } } },
    })

    const customerIds = [
      ...new Set(
        items
          .filter((i) => validOrder(i.order.status) && i.order.customerId !== null)
          .map((i) => i.order.customerId as number)
      ),
    ]

    if (customerIds.length === 0) return []

    // Prisma can batch 'in' queries — safe even with many IDs
    const customers = await prisma.customer.findMany({
      where: { id: { in: customerIds } },
      include: {
        orders: {
          orderBy: { date: 'desc' },
          take: 1,
          select: { date: true, status: true },
        },
      },
    })

    return customers.map((c) => ({
      id: c.id,
      email: c.email,
      firstName: c.firstName,
      lastName: c.lastName,
      lastOrderDate: c.orders[0]?.date,
    }))
  }

  if (segmentType === 'inactive_3m') {
    const cutoff = subMonths(new Date(), 3)
    // Fetch all customers + their orders without negation, filter in JS
    const customers = await prisma.customer.findMany({
      include: {
        orders: { select: { status: true, date: true } },
      },
    })

    return customers
      .map((c) => {
        const valid = c.orders.filter((o) => validOrder(o.status))
        return { ...c, validOrders: valid }
      })
      .filter((c) => c.validOrders.length > 0 && !c.validOrders.some((o) => o.date >= cutoff))
      .map((c) => ({
        id: c.id,
        email: c.email,
        firstName: c.firstName,
        lastName: c.lastName,
        lastOrderDate: c.validOrders.sort((a, b) => b.date.getTime() - a.date.getTime())[0]?.date,
      }))
  }

  if (segmentType === 'top_customers') {
    const customers = await prisma.customer.findMany({
      include: {
        orders: { select: { total: true, status: true } },
      },
    })
    return customers
      .map((c) => {
        const valid = c.orders.filter((o) => validOrder(o.status))
        return {
          id: c.id,
          email: c.email,
          firstName: c.firstName,
          lastName: c.lastName,
          totalRevenue: valid.reduce((s, o) => s + o.total, 0),
          orderCount: valid.length,
        }
      })
      .filter((c) => c.totalRevenue > 0)
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 500)
  }

  if (segmentType === 'repeat_buyer') {
    const customers = await prisma.customer.findMany({
      include: {
        orders: { select: { total: true, status: true, date: true } },
      },
    })
    return customers
      .map((c) => {
        const valid = c.orders
          .filter((o) => validOrder(o.status))
          .sort((a, b) => b.date.getTime() - a.date.getTime())
        return {
          id: c.id,
          email: c.email,
          firstName: c.firstName,
          lastName: c.lastName,
          orderCount: valid.length,
          totalRevenue: valid.reduce((s, o) => s + o.total, 0),
          lastOrderDate: valid[0]?.date,
        }
      })
      .filter((c) => c.orderCount >= 2)
      .sort((a, b) => b.orderCount - a.orderCount)
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
