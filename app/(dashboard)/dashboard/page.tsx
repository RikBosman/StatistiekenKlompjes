import { prisma } from '@/lib/db'
import { getOverviewStats, getMarginData } from '@/lib/analytics'
import { formatCurrency } from '@/lib/utils'
import StatCard from '@/components/StatCard'
import RevenueChart from '@/components/RevenueChart'
import SyncStatus from '@/components/SyncStatus'

export const revalidate = 300

export default async function DashboardPage() {
  let stats = null
  let marginData = null
  let syncLogs = null
  let dbConnected = false

  try {
    ;[stats, marginData, syncLogs] = await Promise.all([
      getOverviewStats(),
      getMarginData(6),
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

  const lastMonth = marginData && marginData.length > 0 ? marginData[marginData.length - 1] : null

  return (
    <div className="p-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900">Overzicht</h2>
        <p className="text-slate-500 text-sm mt-1">Laatste 30 dagen — vergelijking met vorige periode</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Omzet (30d)"
          value={formatCurrency(stats!.totalRevenue30d)}
          sub={`${stats!.totalOrders30d} bestellingen`}
          trend={stats!.revenueTrend}
        />
        <StatCard
          label="Bestellingen (30d)"
          value={String(stats!.totalOrders30d)}
          sub="t.o.v. vorige 30 dagen"
          trend={stats!.ordersTrend}
        />
        <StatCard
          label="Gem. orderwaarde"
          value={formatCurrency(stats!.avgOrderValue30d)}
          trend={stats!.avgOrderTrend}
        />
        <StatCard
          label="Marge (vorige maand)"
          value={lastMonth ? `${lastMonth.grossMarginPct.toFixed(1)}%` : '—'}
          sub={lastMonth ? formatCurrency(lastMonth.grossMargin) : undefined}
          highlight={!!lastMonth && lastMonth.grossMarginPct > 30}
        />
      </div>

      {/* Second row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-3">Klanten totaal</p>
          <p className="text-2xl font-bold text-slate-900">{stats!.totalCustomers.toLocaleString('nl-NL')}</p>
          <p className="text-xs text-slate-400 mt-1">{stats!.logoTekstCustomers} logo/tekst kopers</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-3">Inkoop (30d)</p>
          <p className="text-2xl font-bold text-slate-900">
            {lastMonth ? formatCurrency(lastMonth.cogs) : '—'}
          </p>
          <p className="text-xs text-slate-400 mt-1">Inkoopkosten afgelopen maand</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-3">Verzending (30d)</p>
          <p className="text-2xl font-bold text-slate-900">
            {lastMonth ? formatCurrency(lastMonth.shippingCharged) : '—'}
          </p>
          <p className="text-xs text-slate-400 mt-1">Wat klanten betaalden</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-3">Bruto marge (30d)</p>
          <p className="text-2xl font-bold text-slate-900">
            {lastMonth ? formatCurrency(lastMonth.grossMargin) : '—'}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {lastMonth ? `${lastMonth.grossMarginPct.toFixed(1)}% van omzet` : ''}
          </p>
        </div>
      </div>

      {/* Revenue chart */}
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
