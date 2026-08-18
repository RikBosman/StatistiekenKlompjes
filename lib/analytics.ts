import { prisma } from './db'
import { startOfMonth, subMonths, endOfMonth, subDays, startOfYear, differenceInMonths } from 'date-fns'

async function getSetting(key: string, fallback: number): Promise<number> {
  const s = await prisma.settings.findUnique({ where: { key } })
  return s ? parseFloat(s.value) : fallback
}

async function getAdsDailyRate(): Promise<number> {
  return getSetting('ads_daily_rate', 0)
}

function calcAdSpendForRange(dailyRate: number, since: Date, until: Date): number {
  const days = Math.max(0, (until.getTime() - since.getTime()) / 86_400_000)
  return dailyRate * days
}

export type ProductStatus = 'new_rising' | 'steady' | 'declining' | 'new_slow' | 'underperforming'

const LETTERBOX_COST = parseFloat(process.env.LETTERBOX_SHIPPING_COST ?? '4.20')
const PARCEL_COST = parseFloat(process.env.PARCEL_SHIPPING_COST ?? '6.85')
const DEFAULT_SHIPPING_COST = parseFloat(process.env.DEFAULT_SHIPPING_COST ?? process.env.LETTERBOX_SHIPPING_COST ?? '4.20')

const LETTERBOX_PACKAGING_COST = parseFloat(process.env.LETTERBOX_PACKAGING_COST ?? '0.30')
const PARCEL_PACKAGING_COST = parseFloat(process.env.PARCEL_PACKAGING_COST ?? '0.80')

function calcPackagingCost(method: string | null | undefined): number {
  if (!method) return LETTERBOX_PACKAGING_COST
  return method.toLowerCase().includes('brievenbus') ? LETTERBOX_PACKAGING_COST : PARCEL_PACKAGING_COST
}

export function periodToRange(period = '30d'): { since: Date; until: Date; months: number; label: string } {
  const now = new Date()

  // Specific month: "2026-07"
  if (/^\d{4}-\d{2}$/.test(period)) {
    const [year, month] = period.split('-').map(Number)
    const monthDate = new Date(year, month - 1, 1)
    const label = monthDate.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })
    return { since: startOfMonth(monthDate), until: endOfMonth(monthDate), months: 1, label }
  }

  switch (period) {
    case '7d':  return { since: subDays(now, 7),    until: now, months: 1,  label: 'Laatste 7 dagen' }
    case '3m':  return { since: subMonths(now, 3),  until: now, months: 3,  label: 'Laatste 3 maanden' }
    case '6m':  return { since: subMonths(now, 6),  until: now, months: 6,  label: 'Laatste 6 maanden' }
    case 'ytd': return { since: startOfYear(now), until: now, months: Math.max(1, differenceInMonths(now, startOfYear(now)) + 1), label: 'Dit jaar' }
    case '1y':  return { since: subMonths(now, 12), until: now, months: 12, label: 'Laatste 12 maanden' }
    default:    return { since: subDays(now, 30),   until: now, months: 1,  label: 'Laatste 30 dagen' }
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
  tags: string[]
  firstOrderDate: Date | null
  createdAt: Date
  isNew: boolean
  status: ProductStatus
  stockStatus: string
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

    let tags: string[] = []
    try { tags = JSON.parse(p.tags || '[]') } catch {}

    return {
      id: p.id,
      name: p.name,
      sku: p.sku,
      cogs: p.cogs,
      tags,
      firstOrderDate: p.firstOrderDate,
      createdAt: p.createdAt,
      isNew,
      status,
      stockStatus: p.stockStatus,
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
  // Omzet
  totalRevenue: number
  revenueExclBtw: number
  totalOrders: number
  avgOrderValue: number
  // Google Ads
  adSpend: number
  googleCostPerOrder: number
  roas: number | null
  // Marges
  cogs: number
  productMarginPct: number
  shippingCharged: number
  actualShipping: number
  packagingCost: number
  netShippingCost: number
  paymentCost: number
  // Contributiemarge
  contributionMargin: number
  contributionMarginPerOrder: number
  contributionMarginPerAdEuro: number | null
  // Klanten
  totalCustomers: number
  logoTekstCustomers: number
  newCustomerRevenue: number
  returningCustomerRevenue: number
  newCustomerCount: number
  returningCustomerCount: number
  // Trends
  revenueTrend: number
  ordersTrend: number
  avgOrderTrend: number
  periodLabel: string
  // legacy
  grossMargin: number
  grossMarginPct: number
  totalRevenue30d: number
  totalOrders30d: number
  avgOrderValue30d: number
}

export async function getOverviewStats(period = '30d'): Promise<OverviewStats> {
  const { since, until, label } = periodToRange(period)
  const periodLength = until.getTime() - since.getTime()
  const prevSince = new Date(since.getTime() - periodLength)
  const prevUntil = since

  const { byId: cogsById, bySku: cogsBySku } = await buildCogsLookup()

  const [orders, ordersPrev, totalCustomers, logoTekstCustomers, adsDailyRate, btwRate, paymentCostPerOrder] = await Promise.all([
    prisma.order.findMany({
      where: { date: { gte: since, lte: until }, status: { notIn: ['cancelled', 'refunded'] } },
      include: { lineItems: true },
    }),
    prisma.order.findMany({
      where: { date: { gte: prevSince, lte: prevUntil }, status: { notIn: ['cancelled', 'refunded'] } },
      select: { total: true },
    }),
    prisma.customer.count(),
    prisma.customer.count({
      where: {
        orders: {
          some: {
            status: { notIn: ['cancelled', 'refunded'] },
            lineItems: {
              some: {
                OR: [
                  { name: { contains: 'logo' } },
                  { name: { contains: 'tekst' } },
                ],
              },
            },
          },
        },
      },
    }),
    getAdsDailyRate(),
    getSetting('btw_rate', 21),
    getSetting('payment_cost_per_order', 0.50),
  ])

  const totalRevenue = orders.reduce((s, o) => s + o.total, 0)
  const totalOrders = orders.length
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0
  const shippingCharged = orders.reduce((s, o) => s + o.shippingTotal, 0)

  let cogs = 0
  let actualShipping = 0
  let packagingCost = 0
  for (const order of orders) {
    actualShipping += calcActualShipping(order.shippingMethod)
    packagingCost += calcPackagingCost(order.shippingMethod)
    for (const item of order.lineItems) {
      cogs += lookupCogs(cogsById, cogsBySku, item.productId, item.sku) * item.quantity
    }
  }

  const adSpend = calcAdSpendForRange(adsDailyRate, since, until)
  const grossMargin = totalRevenue - cogs - actualShipping - packagingCost - adSpend
  const grossMarginPct = totalRevenue > 0 ? (grossMargin / totalRevenue) * 100 : 0
  const roas = adSpend > 0 ? totalRevenue / adSpend : null

  // Contribution margin KPIs
  const revenueExclBtw = totalRevenue / (1 + btwRate / 100)
  const googleCostPerOrder = totalOrders > 0 ? adSpend / totalOrders : 0
  const productMarginPct = revenueExclBtw > 0 ? ((revenueExclBtw - cogs) / revenueExclBtw) * 100 : 0
  const netShippingCost = actualShipping // carrier cost; shippingCharged is already in revenueExclBtw
  const paymentCost = paymentCostPerOrder * totalOrders
  const contributionMargin = revenueExclBtw - cogs - netShippingCost - packagingCost - paymentCost - adSpend
  const contributionMarginPerOrder = totalOrders > 0 ? contributionMargin / totalOrders : 0
  const contributionMarginPerAdEuro = adSpend > 0 ? contributionMargin / adSpend : null

  // New vs returning: compare each customer's all-time first order date against period start
  const periodCustomerIds = Array.from(
    new Set(orders.map((o) => o.customerId).filter((id): id is number => id !== null))
  )
  let newCustomerRevenue = 0
  let returningCustomerRevenue = 0
  const newCustomerIds = new Set<number>()
  const returningCustomerIds = new Set<number>()
  if (periodCustomerIds.length > 0) {
    const firstOrderRows = await prisma.order.groupBy({
      by: ['customerId'],
      where: { customerId: { in: periodCustomerIds }, status: { notIn: ['cancelled', 'refunded'] } },
      _min: { date: true },
    })
    const firstOrderMap = new Map(
      firstOrderRows
        .filter((r) => r.customerId !== null)
        .map((r) => [r.customerId as number, r._min.date as Date])
    )
    for (const order of orders) {
      if (!order.customerId) continue
      const firstDate = firstOrderMap.get(order.customerId)
      if (firstDate && firstDate >= since) {
        newCustomerRevenue += order.total
        newCustomerIds.add(order.customerId)
      } else {
        returningCustomerRevenue += order.total
        returningCustomerIds.add(order.customerId)
      }
    }
  }

  const prevRevenue = ordersPrev.reduce((s, o) => s + o.total, 0)
  const prevOrders = ordersPrev.length
  const prevAvg = prevOrders > 0 ? prevRevenue / prevOrders : 0
  const pct = (cur: number, prev: number) => prev > 0 ? ((cur - prev) / prev) * 100 : cur > 0 ? 100 : 0

  return {
    totalRevenue,
    revenueExclBtw,
    totalOrders,
    avgOrderValue,
    adSpend,
    googleCostPerOrder,
    roas,
    cogs,
    productMarginPct,
    shippingCharged,
    actualShipping,
    packagingCost,
    netShippingCost,
    paymentCost,
    contributionMargin,
    contributionMarginPerOrder,
    contributionMarginPerAdEuro,
    totalCustomers,
    logoTekstCustomers,
    newCustomerRevenue,
    returningCustomerRevenue,
    newCustomerCount: newCustomerIds.size,
    returningCustomerCount: returningCustomerIds.size,
    revenueTrend: pct(totalRevenue, prevRevenue),
    ordersTrend: pct(totalOrders, prevOrders),
    avgOrderTrend: pct(avgOrderValue, prevAvg),
    periodLabel: label,
    grossMargin,
    grossMarginPct,
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
          where: { date: { gte: since } },
          select: { total: true, date: true, status: true },
          orderBy: { date: 'desc' },
        },
      },
    }),
  ])

  const withOrders = customers
    .map((c) => ({
      ...c,
      orders: c.orders.filter((o) => o.status !== 'cancelled' && o.status !== 'refunded'),
    }))
    .filter((c) => c.orders.length > 0)
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
  const { since, until, months } = periodToRange(period)
  const now = new Date()

  const [{ byId: cogsById, bySku: cogsBySku }, adsDailyRate] = await Promise.all([
    buildCogsLookup(),
    getAdsDailyRate(),
  ])

  const result: MarginData[] = []

  // For a specific month period, show that one month. Otherwise show rolling months up to `until`.
  const isSpecificMonth = /^\d{4}-\d{2}$/.test(period)
  const rangeEnd = isSpecificMonth ? until : now

  for (let i = months - 1; i >= 0; i--) {
    const monthStart = startOfMonth(subMonths(rangeEnd, i))
    const monthEnd = endOfMonth(subMonths(rangeEnd, i))
    if (monthEnd < since) continue

    const mk = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`
    const effectiveStart = monthStart > since ? monthStart : since
    const effectiveEnd = monthEnd < until ? monthEnd : until

    const orders = await prisma.order.findMany({
      where: {
        date: { gte: effectiveStart, lte: effectiveEnd },
        status: { notIn: ['cancelled', 'refunded'] },
      },
      include: { lineItems: true },
    })

    const revenue = orders.reduce((s, o) => s + o.total, 0)
    const shippingCharged = orders.reduce((s, o) => s + o.shippingTotal, 0)
    const adSpend = calcAdSpendForRange(adsDailyRate, effectiveStart, effectiveEnd)

    let cogs = 0
    let actualShipping = 0
    let packagingCost = 0
    for (const order of orders) {
      actualShipping += calcActualShipping(order.shippingMethod)
      packagingCost += calcPackagingCost(order.shippingMethod)
      for (const item of order.lineItems) {
        cogs += lookupCogs(cogsById, cogsBySku, item.productId, item.sku) * item.quantity
      }
    }

    const grossMargin = revenue - cogs - actualShipping - packagingCost - adSpend
    const grossMarginPct = revenue > 0 ? (grossMargin / revenue) * 100 : 0

    result.push({ month: mk, revenue, shippingCharged, actualShipping, cogs, adSpend, grossMargin, grossMarginPct })
  }

  return result
}
