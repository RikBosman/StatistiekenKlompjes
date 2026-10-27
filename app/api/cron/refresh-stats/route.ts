import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getOverviewStats, getMarginData, getProductPerformance, getCustomerAnalytics } from '@/lib/analytics'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const PERIODS = ['7d', '30d', '3m', '6m', 'ytd', '1y'] as const

function marginPeriodFor(period: string) {
  return period === '7d' || period === '30d' ? '6m' : period
}

async function getLogoCustomerIds(): Promise<number[]> {
  const logoItems = await prisma.orderItem.findMany({
    where: {
      OR: [
        { name: { contains: 'logo' } },
        { name: { contains: 'tekst' } },
        { name: { contains: 'Logo' } },
        { name: { contains: 'Tekst' } },
      ],
    },
    select: { order: { select: { status: true, customerId: true } } },
  })
  return [...new Set(
    logoItems
      .filter(i => i.order.status !== 'cancelled' && i.order.status !== 'refunded' && i.order.customerId !== null)
      .map(i => i.order.customerId as number)
  )]
}

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [syncLogs, trendData, logoCustomerIds] = await Promise.all([
    prisma.syncLog.findMany({ orderBy: { createdAt: 'desc' }, take: 5 }),
    getMarginData('1y'),
    getLogoCustomerIds(),
  ])

  // Fetch full logo customer data once (period-independent) — so the customers page needs no live query
  const logoCustomers = logoCustomerIds.length === 0 ? [] : await prisma.customer.findMany({
    where: { id: { in: logoCustomerIds } },
    include: {
      orders: { orderBy: { date: 'desc' }, take: 1, include: { lineItems: true } },
      reminders: { orderBy: { triggeredAt: 'desc' }, take: 1 },
    },
    orderBy: { id: 'desc' },
  })

  const syncLogsJson = JSON.stringify(syncLogs)
  const trendJson = JSON.stringify(trendData)

  const results: string[] = []
  const details: Record<string, { products: number; topCustomers: number; logoCustomers: number }> = {}

  for (const period of PERIODS) {
    try {
      const [stats, marginData, products, customerAnalytics] = await Promise.all([
        getOverviewStats(period),
        getMarginData(marginPeriodFor(period)),
        getProductPerformance(period),
        getCustomerAnalytics(period),
      ])

      await prisma.statsCache.upsert({
        where: { period },
        update: {
          statsJson: JSON.stringify(stats),
          marginJson: JSON.stringify(marginData),
          trendJson,
          syncLogsJson,
          productsJson: JSON.stringify(products),
          customersJson: JSON.stringify({ analytics: customerAnalytics, logoCustomerIds, logoCustomers }),
        },
        create: {
          period,
          statsJson: JSON.stringify(stats),
          marginJson: JSON.stringify(marginData),
          trendJson,
          syncLogsJson,
          productsJson: JSON.stringify(products),
          customersJson: JSON.stringify({ analytics: customerAnalytics, logoCustomerIds, logoCustomers }),
        },
      })

      results.push(period)
      details[period] = {
        products: products.length,
        topCustomers: customerAnalytics.topCustomers.length,
        logoCustomers: logoCustomers.length,
      }
    } catch (err) {
      console.error(`refresh-stats failed for period ${period}:`, err)
    }
  }

  return NextResponse.json({ ok: true, cached: results, details, updatedAt: new Date() })
}
