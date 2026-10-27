import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getOverviewStats, getMarginData } from '@/lib/analytics'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const PERIODS = ['7d', '30d', '3m', '6m', 'ytd', '1y'] as const

function marginPeriodFor(period: string) {
  return period === '7d' || period === '30d' ? '6m' : period
}

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const syncLogs = await prisma.syncLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
  })
  const syncLogsJson = JSON.stringify(syncLogs)

  // Compute trend data once (same for all periods)
  const trendData = await getMarginData('1y')
  const trendJson = JSON.stringify(trendData)

  const results: string[] = []

  for (const period of PERIODS) {
    try {
      const [stats, marginData] = await Promise.all([
        getOverviewStats(period),
        getMarginData(marginPeriodFor(period)),
      ])

      await prisma.statsCache.upsert({
        where: { period },
        update: {
          statsJson: JSON.stringify(stats),
          marginJson: JSON.stringify(marginData),
          trendJson,
          syncLogsJson,
        },
        create: {
          period,
          statsJson: JSON.stringify(stats),
          marginJson: JSON.stringify(marginData),
          trendJson,
          syncLogsJson,
        },
      })

      results.push(period)
    } catch (err) {
      console.error(`refresh-stats failed for period ${period}:`, err)
    }
  }

  return NextResponse.json({ ok: true, cached: results, updatedAt: new Date() })
}
