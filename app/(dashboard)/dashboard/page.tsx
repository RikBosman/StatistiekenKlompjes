import { prisma } from '@/lib/db'
import { getOverviewStats, getMarginData } from '@/lib/analytics'
import { formatCurrency } from '@/lib/utils'
import StatCard from '@/components/StatCard'
import RevenueChart from '@/components/RevenueChart'
import SyncStatus from '@/components/SyncStatus'

export const revalidate = 300 // refresh every 5 minutes

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
          <a
            href="/dashboard/settings"
            className="text-amber-800 underline text-sm"
          >
            Ga naar instellingen
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Overzicht</h2>
          <p className="text-slate-500 text-sm mt-1">Laatste 30 dagen</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Omzet (30d)"
          value={formatCurrency(stats!.totalRevenue30d)}
          sub={`${stats!.totalOrders30d} bestellingen`}
        />
        <StatCard
          label="Gem. bestelwaarde"
          value={formatCurrency(stats!.avgOrderValue30d)}
        />
        <StatCard
          label="Klanten totaal"
          value={String(stats!.totalCustomers)}
          sub={`${stats!.logoTekstCustomers} logo/tekst kopers`}
        />
        <StatCard
          label="Marge (laatste maand)"
          value={
            marginData && marginData.length > 0
              ? `${marginData[marginData.length - 1].grossMarginPct.toFixed(1)}%`
              : '—'
          }
          sub={
            marginData && marginData.length > 0
              ? formatCurrency(marginData[marginData.length - 1].grossMargin)
              : undefined
          }
        />
      </div>

      {/* Revenue chart */}
      {marginData && marginData.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200 p-6 mb-8">
          <h3 className="text-slate-700 font-medium mb-4">Omzet vs Marge — laatste 6 maanden</h3>
          <RevenueChart data={marginData} />
        </div>
      )}

      {/* Sync status */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h3 className="text-slate-700 font-medium mb-4">Sync log</h3>
        <SyncStatus logs={syncLogs || []} />
      </div>
    </div>
  )
}
