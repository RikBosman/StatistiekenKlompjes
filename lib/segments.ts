import { prisma } from './db'
import { subMonths } from 'date-fns'

export type SegmentType =
  | 'logo_buyer'
  | 'inactive_3m'
  | 'top_customers'
  | 'repeat_buyer'
  | 'list'
  | 'emmer_buyer'
  | 'glaswerk_buyer'
  | 'gravering_buyer'
  | 'klompen_logo_buyer'
  | 'tulp_buyer'

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

    const customerIds = Array.from(
      new Set(
        items
          .filter((i) => validOrder(i.order.status) && i.order.customerId !== null)
          .map((i) => i.order.customerId as number)
      )
    )

    if (customerIds.length === 0) return []

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

  // Generic keyword-based product segment helper
  async function keywordSegment(keywords: string[]): Promise<SegmentCustomer[]> {
    const items = await prisma.orderItem.findMany({
      where: { OR: keywords.map((k) => ({ name: { contains: k } })) },
      select: { order: { select: { status: true, customerId: true, date: true } } },
    })
    const customerIds = Array.from(
      new Set(
        items
          .filter((i) => validOrder(i.order.status) && i.order.customerId !== null)
          .map((i) => i.order.customerId as number)
      )
    )
    if (customerIds.length === 0) return []
    const customers = await prisma.customer.findMany({
      where: { id: { in: customerIds } },
      include: {
        orders: { orderBy: { date: 'desc' }, take: 1, select: { date: true, status: true } },
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

  if (segmentType === 'emmer_buyer') {
    return keywordSegment(['emmer'])
  }

  if (segmentType === 'glaswerk_buyer') {
    return keywordSegment([
      'aperol glas',
      'bier glas',
      'bierglas',
      'speciaalbier glas',
      'speciaalbier',
      'bierpul',
      'champagneglas',
      'champagne glas',
    ])
  }

  if (segmentType === 'gravering_buyer') {
    return keywordSegment(['gravering'])
  }

  if (segmentType === 'klompen_logo_buyer') {
    // Must contain 'klompen' AND ('logo' OR 'tekst') — broad fetch then JS filter
    const items = await prisma.orderItem.findMany({
      where: { name: { contains: 'klompen' } },
      select: { name: true, orderId: true },
    })
    const matchingOrderIds = Array.from(
      new Set(
        items
          .filter((i) => i.name.toLowerCase().includes('logo') || i.name.toLowerCase().includes('tekst'))
          .map((i) => i.orderId)
      )
    )
    if (matchingOrderIds.length === 0) return []
    const orders = await prisma.order.findMany({
      where: { id: { in: matchingOrderIds } },
      select: { status: true, customerId: true },
    })
    const customerIds = Array.from(
      new Set(
        orders
          .filter((o) => validOrder(o.status) && o.customerId !== null)
          .map((o) => o.customerId as number)
      )
    )
    if (customerIds.length === 0) return []
    const customers = await prisma.customer.findMany({
      where: { id: { in: customerIds } },
      include: {
        orders: { orderBy: { date: 'desc' }, take: 1, select: { date: true, status: true } },
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

  if (segmentType === 'tulp_buyer') {
    return keywordSegment(['tulp'])
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
    emmer_buyer: 'Emmer kopers',
    glaswerk_buyer: 'Glaswerk kopers',
    gravering_buyer: 'Gravering kopers',
    klompen_logo_buyer: 'Klompen met logo/tekst kopers',
    tulp_buyer: 'Tulpen kopers',
  }
  return labels[type]
}
