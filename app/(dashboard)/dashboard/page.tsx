import { prisma } from '@/lib/db'
import { getOverviewStats, getMarginData } from '@/lib/analytics'
import { formatCurrency } from '@/lib/utils'
import StatCard from '@/components/StatCard'
import RevenueChart from '@/components/RevenueChart'
import SyncStatus from '@/components/SyncStatus'
import PeriodPicker from '@/components/PeriodPicker'

export const revalidate = 300

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>
}) {
  const { period = '30d' } = await searchParams

  let stats = null
  let marginData = null
  let syncLogs = null
  let dbConnected = false

  try {
    ;[stats, marginData, syncLogs] = await Promise.all([
      getOverviewStats(period),
      getMarginData(period === '7d' || period === '30d' ? '6m' : period),
      prisma.syncLog.findMany({ orderBy: { createdAt: 'desc' }, take: 5 }),
    ])
    dbConnected = true
  } catch {
    // DB not seeded yet or env not configured
  }

  if (!dbConnected) {
    return (
      <div className="p-8">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 max-w-lg">
          <h2 className="text-amber-800 font-semibold mb-2">Configuratie vereist</h2>
          <p className="text-amber-700 text-sm mb-4">
            Stel de omgevingsvariabelen in en voer <code className="bg-amber-100 px-1 rounded">npm run db:push</code> uit om de database te initialiseren.
          </p>
          <a href="/dashboard/settings" className="text-amber-800 underline text-sm">
            Ga naar instellingen
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Overzicht</h2>
          <p className="text-slate-500 text-sm mt-1">{stats!.periodLabel} — vergelijking met vorige periode</p>
        </div>
        <PeriodPicker active={period} />
      </div>

      {/* KPI row 1: revenue metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <StatCard
          label={`Omzet (${period})`}
          value={formatCurrency(stats!.totalRevenue)}
          sub={`${stats!.totalOrders} bestellingen`}
          trend={stats!.revenueTrend}
        />
        <StatCard
          label={`Bestellingen (${period})`}
          value={String(stats!.totalOrders)}
          sub="t.o.v. vorige periode"
          trend={stats!.ordersTrend}
        />
        <StatCard
          label="Gem. orderwaarde"
          value={formatCurrency(stats!.avgOrderValue)}
          trend={stats!.avgOrderTrend}
        />
        <StatCard
          label="Bruto marge"
          value={`${stats!.grossMarginPct.toFixed(1)}%`}
          sub={formatCurrency(stats!.grossMargin)}
          highlight={stats!.grossMarginPct > 30}
        />
      </div>

      {/* KPI row 2: cost breakdown */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-3">Klanten totaal</p>
          <p className="text-2xl font-bold text-slate-900">{stats!.totalCustomers.toLocaleString('nl-NL')}</p>
          <p className="text-xs text-slate-400 mt-1">{stats!.logoTekstCustomers} logo/tekst kopers</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-3">Inkoopkosten</p>
          <p className="text-2xl font-bold text-slate-900">{formatCurrency(stats!.cogs)}</p>
          <p className="text-xs text-slate-400 mt-1">Product COGS</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-3">Verzendkosten (werkelijk)</p>
          <p className="text-2xl font-bold text-slate-900">{formatCurrency(stats!.actualShipping)}</p>
          <p className="text-xs text-slate-400 mt-1">
            Klant betaalde {formatCurrency(stats!.shippingCharged)}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-3">Bruto marge (€)</p>
          <p className={`text-2xl font-bold ${stats!.grossMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(stats!.grossMargin)}
          </p>
          <p className="text-xs text-slate-400 mt-1">Omzet − inkoop − verzending</p>
        </div>
      </div>

      {/* Revenue/margin chart */}
      {marginData && marginData.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <h3 className="text-slate-800 font-semibold mb-1">Omzet vs Bruto marge</h3>
          <p className="text-slate-400 text-xs mb-4">Laatste 6 maanden</p>
          <RevenueChart data={marginData} />
        </div>
      )}

      {/* Sync log */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-slate-800 font-semibold mb-4">Sync log</h3>
        <SyncStatus logs={syncLogs || []} />
      </div>
    </div>
  )
}
