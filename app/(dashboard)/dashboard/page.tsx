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

      {/* KPI row 2: cost breakdown + ROAS + bruto marge */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-4">
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
        <div className={`rounded-xl border p-5 ${stats!.grossMargin >= 0 ? 'bg-white border-slate-200' : 'bg-red-50 border-red-200'}`}>
          <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-3">Bruto marge (€)</p>
          <p className={`text-2xl font-bold ${stats!.grossMargin >= 0 ? 'text-slate-900' : 'text-red-700'}`}>
            {formatCurrency(stats!.grossMargin)}
          </p>
          <p className="text-xs text-slate-400 mt-1">{stats!.grossMarginPct.toFixed(1)}% marge</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-3">Verzend + verpakking</p>
          <p className="text-2xl font-bold text-slate-900">{formatCurrency(stats!.actualShipping + stats!.packagingCost)}</p>
          <p className="text-xs text-slate-400 mt-1">
            Verzending {formatCurrency(stats!.actualShipping)} · verpakking {formatCurrency(stats!.packagingCost)}
          </p>
        </div>
        <div className="bg-orange-50 rounded-xl border border-orange-200 p-5">
          <p className="text-xs text-orange-600 uppercase tracking-wide font-medium mb-3">Google Ads kosten</p>
          <p className="text-2xl font-bold text-orange-700">{formatCurrency(stats!.adSpend)}</p>
          <p className="text-xs text-orange-400 mt-1">
            {stats!.adSpend > 0 ? `Periode totaal` : <a href="/dashboard/ads" className="underline">Dagbudget instellen →</a>}
          </p>
        </div>
        {stats!.roas !== null ? (
          <div className={`rounded-xl border p-5 ${stats!.roas >= 4 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <p className={`text-xs uppercase tracking-wide font-medium mb-3 ${stats!.roas >= 4 ? 'text-green-600' : 'text-red-600'}`}>ROAS</p>
            <p className={`text-2xl font-bold ${stats!.roas >= 4 ? 'text-green-700' : 'text-red-700'}`}>
              {stats!.roas.toFixed(1)}×
            </p>
            <p className={`text-xs mt-1 ${stats!.roas >= 4 ? 'text-green-500' : 'text-red-400'}`}>
              {stats!.roas >= 4 ? `Boven doel (4×)` : `Onder doel (4×)`}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-3">ROAS</p>
            <p className="text-2xl font-bold text-slate-300">—</p>
            <p className="text-xs text-slate-400 mt-1"><a href="/dashboard/ads" className="underline">Dagbudget instellen →</a></p>
          </div>
        )}
      </div>

      {/* KPI row 3: new vs returning customers */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-sky-50 rounded-xl border border-sky-200 p-5 flex items-center gap-5">
          <div>
            <p className="text-xs text-sky-600 uppercase tracking-wide font-medium mb-1">Nieuwe klanten (periode)</p>
            <p className="text-3xl font-bold text-sky-700">{stats!.newCustomerCount}</p>
            <p className="text-xs text-sky-500 mt-1">{formatCurrency(stats!.newCustomerRevenue)} omzet</p>
          </div>
          <div className="flex-1 h-2 bg-sky-100 rounded-full overflow-hidden">
            {(stats!.newCustomerCount + stats!.returningCustomerCount) > 0 && (
              <div
                className="h-full bg-sky-400 rounded-full"
                style={{ width: `${(stats!.newCustomerCount / (stats!.newCustomerCount + stats!.returningCustomerCount)) * 100}%` }}
              />
            )}
          </div>
        </div>
        <div className="bg-violet-50 rounded-xl border border-violet-200 p-5 flex items-center gap-5">
          <div>
            <p className="text-xs text-violet-600 uppercase tracking-wide font-medium mb-1">Terugkerende klanten</p>
            <p className="text-3xl font-bold text-violet-700">{stats!.returningCustomerCount}</p>
            <p className="text-xs text-violet-500 mt-1">{formatCurrency(stats!.returningCustomerRevenue)} omzet</p>
          </div>
          <div className="flex-1 h-2 bg-violet-100 rounded-full overflow-hidden">
            {(stats!.newCustomerCount + stats!.returningCustomerCount) > 0 && (
              <div
                className="h-full bg-violet-400 rounded-full"
                style={{ width: `${(stats!.returningCustomerCount / (stats!.newCustomerCount + stats!.returningCustomerCount)) * 100}%` }}
              />
            )}
          </div>
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
