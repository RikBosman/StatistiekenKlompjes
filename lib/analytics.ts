import { prisma } from './db'
import { startOfMonth, subMonths, endOfMonth, differenceInDays } from 'date-fns'

export type ProductStatus = 'new_rising' | 'steady' | 'declining' | 'new_slow' | 'underperforming'

export interface ProductPerformance {
  id: number
  name: string
  sku: string | null
  cogs: number | null
  firstOrderDate: Date | null
  isNew: boolean
  status: ProductStatus
  monthlySales: MonthlyData[]
  forecastNextMonth: number
  totalUnitsLast30: number
  totalRevenueLast30: number
}

export interface MonthlyData {
  month: string // YYYY-MM
  units: number
  revenue: number
}

export async function getProductPerformance(): Promise<ProductPerformance[]> {
  const newWindowDays = parseInt(process.env.NEW_PRODUCT_WINDOW_DAYS || '60', 10)
  const now = new Date()
  const newCutoff = new Date(now.getTime() - newWindowDays * 24 * 60 * 60 * 1000)

  const products = await prisma.product.findMany({
    where: { status: 'publish' },
    include: {
      orderItems: {
        include: { order: true },
        where: {
          order: {
            status: { notIn: ['cancelled', 'refunded'] },
            date: { gte: subMonths(now, 6) },
          },
        },
      },
    },
  })

  return products.map((p) => {
    const isNew = p.firstOrderDate ? p.firstOrderDate >= newCutoff : false

    // Build monthly data for last 6 months
    const monthlySales: MonthlyData[] = []
    for (let i = 5; i >= 0; i--) {
      const monthStart = startOfMonth(subMonths(now, i))
      const monthEnd = endOfMonth(subMonths(now, i))
      const monthKey = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`

      const monthItems = p.orderItems.filter((item) => {
        const d = item.order.date
        return d >= monthStart && d <= monthEnd
      })

      monthlySales.push({
        month: monthKey,
        units: monthItems.reduce((s, i) => s + i.quantity, 0),
        revenue: monthItems.reduce((s, i) => s + i.total, 0),
      })
    }

    // Forecast: weighted average of last 3 months (most recent = highest weight)
    const last3 = monthlySales.slice(-3)
    const weights = [1, 2, 3]
    const weightedSum = last3.reduce((s, m, idx) => s + m.units * weights[idx], 0)
    const weightTotal = weights.slice(0, last3.length).reduce((a, b) => a + b, 0)
    const forecast = weightTotal > 0 ? weightedSum / weightTotal : 0

    // Growth rate (month 5 vs month 4 vs month 3)
    const recent = monthlySales[monthlySales.length - 1].units
    const prev = monthlySales[monthlySales.length - 2].units
    const older = monthlySales[monthlySales.length - 3].units

    const last30items = p.orderItems.filter((item) => {
      return item.order.date >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    })
    const totalUnitsLast30 = last30items.reduce((s, i) => s + i.quantity, 0)
    const totalRevenueLast30 = last30items.reduce((s, i) => s + i.total, 0)

    // Determine status
    let status: ProductStatus
    if (totalUnitsLast30 === 0) {
      status = isNew ? 'new_slow' : 'underperforming'
    } else if (isNew && recent > 0) {
      const growthRecent = prev > 0 ? (recent - prev) / prev : 1
      status = growthRecent >= 0.1 ? 'new_rising' : 'steady'
    } else {
      const growthRecent = prev > 0 ? (recent - prev) / prev : 0
      const growthOlder = older > 0 ? (prev - older) / older : 0
      if (growthRecent > 0.05 || (growthRecent >= 0 && growthOlder > 0)) {
        status = 'steady'
      } else if (growthRecent < -0.15) {
        status = 'declining'
      } else {
        status = 'steady'
      }
    }

    return {
      id: p.id,
      name: p.name,
      sku: p.sku,
      cogs: p.cogs,
      firstOrderDate: p.firstOrderDate,
      isNew,
      status,
      monthlySales,
      forecastNextMonth: Math.round(forecast),
      totalUnitsLast30,
      totalRevenueLast30,
    }
  })
}

export interface OverviewStats {
  totalRevenue30d: number
  totalOrders30d: number
  totalCustomers: number
  logoTekstCustomers: number
  newRisingProducts: number
  underperformingProducts: number
  avgOrderValue30d: number
}

export async function getOverviewStats(): Promise<OverviewStats> {
  const now = new Date()
  const since30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const [orders30d, totalCustomers, logoTekstCustomers] = await Promise.all([
    prisma.order.findMany({
      where: {
        date: { gte: since30d },
        status: { notIn: ['cancelled', 'refunded'] },
      },
      select: { total: true },
    }),
    prisma.customer.count(),
    prisma.customer.count({
      where: { tags: { contains: 'logo_buyer' } },
    }),
  ])

  const totalRevenue30d = orders30d.reduce((s, o) => s + o.total, 0)
  const totalOrders30d = orders30d.length
  const avgOrderValue30d = totalOrders30d > 0 ? totalRevenue30d / totalOrders30d : 0

  return {
    totalRevenue30d,
    totalOrders30d,
    totalCustomers,
    logoTekstCustomers,
    newRisingProducts: 0, // filled by caller
    underperformingProducts: 0,
    avgOrderValue30d,
  }
}

export interface MarginData {
  month: string
  revenue: number
  shippingCharged: number
  cogs: number
  adSpend: number
  grossMargin: number
  grossMarginPct: number
}

export async function getMarginData(months = 6): Promise<MarginData[]> {
  const now = new Date()
  const result: MarginData[] = []

  for (let i = months - 1; i >= 0; i--) {
    const monthStart = startOfMonth(subMonths(now, i))
    const monthEnd = endOfMonth(subMonths(now, i))
    const monthKey = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`

    const [orders, adSpendRows] = await Promise.all([
      prisma.order.findMany({
        where: {
          date: { gte: monthStart, lte: monthEnd },
          status: { notIn: ['cancelled', 'refunded'] },
        },
        include: {
          lineItems: { include: { product: true } },
        },
      }),
      prisma.adSpend.findMany({
        where: { date: { gte: monthStart, lte: monthEnd } },
      }),
    ])

    const revenue = orders.reduce((s, o) => s + o.total, 0)
    const shippingCharged = orders.reduce((s, o) => s + o.shippingTotal, 0)
    const adSpend = adSpendRows.reduce((s, a) => s + a.spend, 0)

    let cogs = 0
    for (const order of orders) {
      for (const item of order.lineItems) {
        if (item.product?.cogs) {
          cogs += item.product.cogs * item.quantity
        }
      }
    }

    const grossMargin = revenue - cogs - shippingCharged - adSpend
    const grossMarginPct = revenue > 0 ? (grossMargin / revenue) * 100 : 0

    result.push({
      month: monthKey,
      revenue,
      shippingCharged,
      cogs,
      adSpend,
      grossMargin,
      grossMarginPct,
    })
  }

  return result
}
