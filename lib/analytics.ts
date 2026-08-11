import { prisma } from './db'
import { startOfMonth, subMonths, endOfMonth, subDays, startOfYear, differenceInMonths } from 'date-fns'

export type ProductStatus = 'new_rising' | 'steady' | 'declining' | 'new_slow' | 'underperforming'

const LETTERBOX_COST = parseFloat(process.env.LETTERBOX_SHIPPING_COST ?? '4.20')
const PARCEL_COST = parseFloat(process.env.PARCEL_SHIPPING_COST ?? '6.85')
// Default rate for orders without a known shipping method (assume cheapest = letterbox)
const DEFAULT_SHIPPING_COST = parseFloat(process.env.DEFAULT_SHIPPING_COST ?? process.env.LETTERBOX_SHIPPING_COST ?? '4.20')

export function periodToRange(period = '30d'): { since: Date; months: number; label: string } {
  const now = new Date()
  switch (period) {
    case '7d':  return { since: subDays(now, 7),    months: 1,  label: 'Laatste 7 dagen' }
    case '3m':  return { since: subMonths(now, 3),  months: 3,  label: 'Laatste 3 maanden' }
    case '6m':  return { since: subMonths(now, 6),  months: 6,  label: 'Laatste 6 maanden' }
    case 'ytd': return { since: startOfYear(now),   months: Math.max(1, differenceInMonths(now, startOfYear(now)) + 1), label: 'Dit jaar' }
    case '1y':  return { since: subMonths(now, 12), months: 12, label: 'Laatste 12 maanden' }
    default:    return { since: subDays(now, 30),   months: 1,  label: 'Laatste 30 dagen' }
  }
}

function calcActualShipping(method: string | null | undefined): number {
  if (!method) return DEFAULT_SHIPPING_COST // use default rate when method unknown
  const m = method.toLowerCase()
  return m.includes('brievenbus') ? LETTERBOX_COST : PARCEL_COST
}

// Build COGS lookup maps (by product id and by sku) from all products
async function buildCogsLookup() {
  const products = await prisma.product.findMany({
    where: { cogs: { not: null } },
    select: { id: true, sku: true, cogs: true },
  })
  const byId = new Map<number, number>()
  const bySku = new Map<string, number>()
  for (const p of products) {
    if (p.cogs) {
      byId.set(p.id, p.cogs)
      if (p.sku) bySku.set(p.sku, p.cogs)
    }
  }
  return { byId, bySku }
}

function lookupCogs(
  byId: Map<number, number>,
  bySku: Map<string, number>,
  productId: number | null,
  sku: string | null,
): number {
  if (productId !== null) {
    const v = byId.get(productId)
    if (v !== undefined) return v
  }
  if (sku) {
    const v = bySku.get(sku)
    if (v !== undefined) return v
  }
  return 0
}

// ─────────────────────────────────────────────────────────────────────────────
// Product Performance
// ─────────────────────────────────────────────────────────────────────────────

export interface MonthlyData {
  month: string
  units: number
  revenue: number
}

export interface ProductPerformance {
  id: number
  name: string
  sku: string | null
  cogs: number | null
  firstOrderDate: Date | null
  createdAt: Date
  isNew: boolean
  status: ProductStatus
  monthlySales: MonthlyData[]
  forecastNextMonth: number
  totalUnitsPeriod: number
  totalRevenuePeriod: number
  grossProfit: number
  profitMarginPct: number
  // kept for backward compat with existing page code
  totalUnitsLast30: number
  totalRevenueLast30: number
}

export async function getProductPerformance(period = '30d'): Promise<ProductPerformance[]> {
  const newWindowDays = parseInt(process.env.NEW_PRODUCT_WINDOW_DAYS ?? '60', 10)
  const now = new Date()
  const newCutoff = new Date(now.getTime() - newWindowDays * 24 * 60 * 60 * 1000)
  const trendStart = subMonths(now, 6) // trend sparkline always 6M
  const { since: kpiSince } = periodToRange(period)
  const earliestDate = trendStart < kpiSince ? trendStart : kpiSince

  const [products, allItems] = await Promise.all([
    prisma.product.findMany({ where: { status: 'publish' } }),
    prisma.orderItem.findMany({
      where: {
        order: {
          date: { gte: earliestDate },
          status: { notIn: ['cancelled', 'refunded'] },
        },
      },
      include: { order: { select: { date: true } } },
    }),
  ])

  // Group items by productId AND by SKU (SKU matching catches items with null productId)
  const byProductId = new Map<number, typeof allItems>()
  const bySku = new Map<string, typeof allItems>()
  for (const item of allItems) {
    if (item.productId !== null) {
      const list = byProductId.get(item.productId) ?? []
      list.push(item)
      byProductId.set(item.productId, list)
    }
    if (item.sku) {
      const list = bySku.get(item.sku) ?? []
      list.push(item)
      bySku.set(item.sku, list)
    }
  }

  return products.map((p) => {
    const isNew = p.createdAt >= newCutoff

    // Union: items matched by productId or by SKU (deduplicate by item id)
    const seen = new Set<number>()
    const productItems: typeof allItems = []
    for (const item of byProductId.get(p.id) ?? []) {
      if (!seen.has(item.id)) { seen.add(item.id); productItems.push(item) }
    }
    if (p.sku) {
      for (const item of bySku.get(p.sku) ?? []) {
        if (!seen.has(item.id)) { seen.add(item.id); productItems.push(item) }
      }
    }

    // 6M monthly trend data for sparkline
    const monthlySales: MonthlyData[] = []
    for (let i = 5; i >= 0; i--) {
      const ms = startOfMonth(subMonths(now, i))
      const me = endOfMonth(subMonths(now, i))
      const mk = `${ms.getFullYear()}-${String(ms.getMonth() + 1).padStart(2, '0')}`
      const mi = productItems.filter(it => it.order.date >= ms && it.order.date <= me)
      monthlySales.push({
        month: mk,
        units: mi.reduce((s, i) => s + i.quantity, 0),
        revenue: mi.reduce((s, i) => s + i.total, 0),
      })
    }

    // KPIs for selected period
    const periodItems = productItems.filter(it => it.order.date >= kpiSince)
    const totalUnitsPeriod = periodItems.reduce((s, i) => s + i.quantity, 0)
    const totalRevenuePeriod = periodItems.reduce((s, i) => s + i.total, 0)

    // Status always based on rolling 30d vs 6M trend
    const units30d = productItems.filter(it => it.order.date >= subDays(now, 30)).reduce((s, i) => s + i.quantity, 0)
    const recent = monthlySales[5].units
    const prev   = monthlySales[4].units
    const older  = monthlySales[3].units

    let status: ProductStatus
    if (units30d === 0) {
      status = isNew ? 'new_slow' : 'underperforming'
    } else if (isNew && recent > 0) {
      const g = prev > 0 ? (recent - prev) / prev : 1
      status = g >= 0.1 ? 'new_rising' : 'steady'
    } else {
      const gr = prev > 0 ? (recent - prev) / prev : 0
      const go = older > 0 ? (prev - older) / older : 0
      if (gr > 0.05 || (gr >= 0 && go > 0)) status = 'steady'
      else if (gr < -0.15) status = 'declining'
      else status = 'steady'
    }

    // Forecast: for new products use daily rate since creation; for established use weighted 3M average
    const daysSinceCreation = Math.max(1, (now.getTime() - p.createdAt.getTime()) / (1000 * 60 * 60 * 24))
    const totalUnitsAllData = productItems.reduce((s, i) => s + i.quantity, 0)
    let forecast: number
    if (daysSinceCreation < 90) {
      // New product: daily rate since creation projected to 30 days
      forecast = (totalUnitsAllData / daysSinceCreation) * 30
    } else {
      // Established product: weighted recent 3 months (recent months weighted higher)
      const last3 = monthlySales.slice(-3)
      const weights = [1, 2, 3]
      const weightedSum = last3.reduce((s, m, idx) => s + m.units * weights[idx], 0)
      const weightTotal = weights.slice(0, last3.length).reduce((a, b) => a + b, 0)
      forecast = weightTotal > 0 ? weightedSum / weightTotal : 0
    }

    // Gross profit for the selected period
    const cogsTotal = (p.cogs ?? 0) * totalUnitsPeriod
    const grossProfit = totalRevenuePeriod - cogsTotal
    const profitMarginPct = totalRevenuePeriod > 0 ? (grossProfit / totalRevenuePeriod) * 100 : 0

    return {
      id: p.id,
      name: p.name,
      sku: p.sku,
      cogs: p.cogs,
      firstOrderDate: p.firstOrderDate,
      createdAt: p.createdAt,
      isNew,
      status,
      monthlySales,
      forecastNextMonth: Math.round(forecast),
      totalUnitsPeriod,
      totalRevenuePeriod,
      grossProfit,
      profitMarginPct,
      totalUnitsLast30: totalUnitsPeriod,
      totalRevenueLast30: totalRevenuePeriod,
    }
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Overview Stats
// ─────────────────────────────────────────────────────────────────────────────

export interface OverviewStats {
  totalRevenue: number
  totalOrders: number
  totalCustomers: number
  logoTekstCustomers: number
  avgOrderValue: number
  cogs: number
  shippingCharged: number
  actualShipping: number
  grossMargin: number
  grossMarginPct: number
  revenueTrend: number
  ordersTrend: number
  avgOrderTrend: number
  periodLabel: string
  // legacy aliases
  totalRevenue30d: number
  totalOrders30d: number
  avgOrderValue30d: number
}

export async function getOverviewStats(period = '30d'): Promise<OverviewStats> {
  const now = new Date()
  const { since, label } = periodToRange(period)
  const periodLength = now.getTime() - since.getTime()
  const prevSince = new Date(since.getTime() - periodLength)

  const { byId: cogsById, bySku: cogsBySku } = await buildCogsLookup()

  const [orders, ordersPrev, totalCustomers, logoTekstCustomers] = await Promise.all([
    prisma.order.findMany({
      where: { date: { gte: since }, status: { notIn: ['cancelled', 'refunded'] } },
      include: { lineItems: true },
    }),
    prisma.order.findMany({
      where: { date: { gte: prevSince, lt: since }, status: { notIn: ['cancelled', 'refunded'] } },
      select: { total: true },
    }),
    prisma.customer.count(),
    prisma.customer.count({ where: { tags: { contains: 'logo_buyer' } } }),
  ])

  const totalRevenue = orders.reduce((s, o) => s + o.total, 0)
  const totalOrders = orders.length
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0
  const shippingCharged = orders.reduce((s, o) => s + o.shippingTotal, 0)

  let cogs = 0
  let actualShipping = 0
  for (const order of orders) {
    actualShipping += calcActualShipping(order.shippingMethod)
    for (const item of order.lineItems) {
      cogs += lookupCogs(cogsById, cogsBySku, item.productId, item.sku) * item.quantity
    }
  }

  const grossMargin = totalRevenue - cogs - actualShipping
  const grossMarginPct = totalRevenue > 0 ? (grossMargin / totalRevenue) * 100 : 0

  const prevRevenue = ordersPrev.reduce((s, o) => s + o.total, 0)
  const prevOrders = ordersPrev.length
  const prevAvg = prevOrders > 0 ? prevRevenue / prevOrders : 0
  const pct = (cur: number, prev: number) => prev > 0 ? ((cur - prev) / prev) * 100 : cur > 0 ? 100 : 0

  return {
    totalRevenue,
    totalOrders,
    totalCustomers,
    logoTekstCustomers,
    avgOrderValue,
    cogs,
    shippingCharged,
    actualShipping,
    grossMargin,
    grossMarginPct,
    revenueTrend: pct(totalRevenue, prevRevenue),
    ordersTrend: pct(totalOrders, prevOrders),
    avgOrderTrend: pct(avgOrderValue, prevAvg),
    periodLabel: label,
    totalRevenue30d: totalRevenue,
    totalOrders30d: totalOrders,
    avgOrderValue30d: avgOrderValue,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Customer Analytics
// ─────────────────────────────────────────────────────────────────────────────

export interface CustomerAnalytics {
  totalCustomers: number        // all-time total
  activeCustomers: number       // had order(s) in selected period
  repeatCustomers: number       // 2+ orders in selected period
  repeatRate: number            // repeatCustomers / activeCustomers
  avgOrderValue: number         // avg revenue per active customer in period
  topCustomers: Array<{
    id: number
    name: string
    email: string
    totalRevenue: number
    orderCount: number
    lastOrder: Date | null
  }>
  revenueByMonth: Array<{ month: string; newCustomers: number; returning: number }>
}

export async function getCustomerAnalytics(period = '30d'): Promise<CustomerAnalytics> {
  const { since } = periodToRange(period)

  const [totalCustomers, customers] = await Promise.all([
    prisma.customer.count(),
    prisma.customer.findMany({
      include: {
        orders: {
          where: {
            status: { notIn: ['cancelled', 'refunded'] },
            date: { gte: since },
          },
          select: { total: true, date: true },
          orderBy: { date: 'desc' },
        },
      },
    }),
  ])

  const withOrders = customers.filter((c) => c.orders.length > 0)
  const repeatCustomers = withOrders.filter((c) => c.orders.length > 1).length
  const totalRevenue = withOrders.reduce((s, c) => s + c.orders.reduce((ss, o) => ss + o.total, 0), 0)
  const avgOrderValue = withOrders.length > 0 ? totalRevenue / withOrders.length : 0

  const topCustomers = withOrders
    .map((c) => ({
      id: c.id,
      name: `${c.firstName} ${c.lastName}`.trim(),
      email: c.email,
      totalRevenue: c.orders.reduce((s, o) => s + o.total, 0),
      orderCount: c.orders.length,
      lastOrder: c.orders[0]?.date ?? null,
    }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, 20)

  return {
    totalCustomers,
    activeCustomers: withOrders.length,
    repeatCustomers,
    repeatRate: withOrders.length > 0 ? (repeatCustomers / withOrders.length) * 100 : 0,
    avgOrderValue,
    topCustomers,
    revenueByMonth: [],
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Margin Data
// ─────────────────────────────────────────────────────────────────────────────

export interface MarginData {
  month: string
  revenue: number
  shippingCharged: number
  actualShipping: number
  cogs: number
  adSpend: number
  grossMargin: number
  grossMarginPct: number
}

export async function getMarginData(period = '6m'): Promise<MarginData[]> {
  const { since, months } = periodToRange(period)
  const now = new Date()

  const { byId: cogsById, bySku: cogsBySku } = await buildCogsLookup()

  const result: MarginData[] = []

  for (let i = months - 1; i >= 0; i--) {
    const monthStart = startOfMonth(subMonths(now, i))
    const monthEnd = endOfMonth(subMonths(now, i))
    if (monthEnd < since) continue

    const mk = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`
    const effectiveStart = monthStart > since ? monthStart : since

    const [orders, adSpendRows] = await Promise.all([
      prisma.order.findMany({
        where: {
          date: { gte: effectiveStart, lte: monthEnd },
          status: { notIn: ['cancelled', 'refunded'] },
        },
        include: { lineItems: true },
      }),
      prisma.adSpend.findMany({ where: { date: { gte: monthStart, lte: monthEnd } } }),
    ])

    const revenue = orders.reduce((s, o) => s + o.total, 0)
    const shippingCharged = orders.reduce((s, o) => s + o.shippingTotal, 0)
    const adSpend = adSpendRows.reduce((s, a) => s + a.spend, 0)

    let cogs = 0
    let actualShipping = 0
    for (const order of orders) {
      actualShipping += calcActualShipping(order.shippingMethod)
      for (const item of order.lineItems) {
        cogs += lookupCogs(cogsById, cogsBySku, item.productId, item.sku) * item.quantity
      }
    }

    const grossMargin = revenue - cogs - actualShipping - adSpend
    const grossMarginPct = revenue > 0 ? (grossMargin / revenue) * 100 : 0

    result.push({ month: mk, revenue, shippingCharged, actualShipping, cogs, adSpend, grossMargin, grossMarginPct })
  }

  return result
}
