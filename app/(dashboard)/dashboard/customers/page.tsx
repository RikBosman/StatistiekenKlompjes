import { prisma } from '@/lib/db'
import { getCustomerAnalytics, periodToRange } from '@/lib/analytics'
import { formatCurrency, formatDate } from '@/lib/utils'
import PeriodPicker from '@/components/PeriodPicker'

export const revalidate = 300

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: { period?: string }
}) {
  const period = searchParams.period ?? '30d'
  const { label: periodLabel } = periodToRange(period)

  let analytics = null
  let logoCustomers = null
  let error = null

  try {
    ;[analytics, logoCustomers] = await Promise.all([
      getCustomerAnalytics(period),
      prisma.customer.findMany({
        where: { tags: { contains: 'logo_buyer' } },
        include: {
          orders: {
            where: {
              status: { notIn: ['cancelled', 'refunded'] },
              lineItems: {
                some: {
                  OR: [
                    { name: { contains: 'logo' } },
                    { name: { contains: 'tekst' } },
                    { name: { contains: 'Logo' } },
                    { name: { contains: 'Tekst' } },
                  ],
                },
              },
            },
            orderBy: { date: 'desc' },
            take: 1,
            include: {
              lineItems: {
                where: {
                  OR: [
                    { name: { contains: 'logo' } },
                    { name: { contains: 'tekst' } },
                    { name: { contains: 'Logo' } },
                    { name: { contains: 'Tekst' } },
                  ],
                },
              },
            },
          },
          reminders: {
            orderBy: { triggeredAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { id: 'desc' },
      }),
    ])
  } catch (err) {
    error = err instanceof Error ? err.message : 'Onbekende fout'
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      </div>
    )
  }

  const now = new Date()
  const threeMonthsAgo = new Date(now.setMonth(now.getMonth() - 3))

  return (
    <div className="p-8">
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Klanten</h2>
          <p className="text-slate-500 text-sm mt-1">{periodLabel} — top klanten en segmentatie</p>
        </div>
        <PeriodPicker active={period} />
      </div>

      {/* KPI row */}
      {analytics && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-3">Totaal klanten</p>
            <p className="text-2xl font-bold text-slate-900">{analytics.totalCustomers.toLocaleString('nl-NL')}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-3">Herhalingsaankoop</p>
            <p className="text-2xl font-bold text-slate-900">{analytics.repeatRate.toFixed(1)}%</p>
            <p className="text-xs text-slate-400 mt-1">{analytics.repeatCustomers} klanten ≥ 2 orders</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-3">Gem. klantwaarde (LTV)</p>
            <p className="text-2xl font-bold text-slate-900">{formatCurrency(analytics.avgLTV)}</p>
            <p className="text-xs text-slate-400 mt-1">Gemiddelde omzet per klant</p>
          </div>
          <div className="bg-brand-50 rounded-xl border border-brand-200 p-5">
            <p className="text-xs text-brand-600 uppercase tracking-wide font-medium mb-3">Logo/tekst kopers</p>
            <p className="text-2xl font-bold text-brand-700">{logoCustomers?.length ?? 0}</p>
            <p className="text-xs text-brand-400 mt-1">Gesegmenteerd voor e-mail</p>
          </div>
        </div>
      )}

      {/* Top customers */}
      {analytics && analytics.topCustomers.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 mb-8">
          <div className="p-6 border-b border-slate-100">
            <h3 className="font-semibold text-slate-900">Top 20 klanten op omzet</h3>
            <p className="text-slate-400 text-sm mt-0.5">{periodLabel}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-6 py-3 font-medium text-slate-500">#</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Klant</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">E-mail</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-500">Orders</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-500">Totale omzet</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Laatste order</th>
                </tr>
              </thead>
              <tbody>
                {analytics.topCustomers.map((c, i) => (
                  <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-6 py-3 text-slate-400 font-mono text-xs">{i + 1}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{c.name || '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{c.email}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{c.orderCount}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatCurrency(c.totalRevenue)}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{c.lastOrder ? formatDate(c.lastOrder) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Logo/tekst customers */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-slate-900">Logo / tekst kopers</h3>
            <p className="text-slate-400 text-sm mt-0.5">{logoCustomers?.length || 0} klanten — herinneringen na 3 maanden</p>
          </div>
          <a
            href="/dashboard/email"
            className="px-4 py-2 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700 transition-colors"
          >
            E-mail campagne sturen →
          </a>
        </div>
        {(!logoCustomers || logoCustomers.length === 0) ? (
          <div className="p-8 text-center text-slate-400 text-sm">
            Geen logo/tekst klanten gevonden. Synchroniseer eerst bestellingen.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-6 py-3 font-medium text-slate-500">Klant</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">E-mail</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Laatste logo/tekst bestelling</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Producten</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Herinnering</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Status</th>
                </tr>
              </thead>
              <tbody>
                {logoCustomers.map((customer) => {
                  const lastOrder = customer.orders[0]
                  const lastReminder = customer.reminders[0]
                  const isDue = lastOrder && new Date(lastOrder.date) < threeMonthsAgo
                  return (
                    <tr key={customer.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="px-6 py-3 font-medium text-slate-900">
                        {customer.firstName} {customer.lastName}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{customer.email}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{lastOrder ? formatDate(lastOrder.date) : '—'}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs max-w-xs truncate">
                        {lastOrder?.lineItems.map((i) => i.name).join(', ') || '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs">{lastReminder?.sentAt ? formatDate(lastReminder.sentAt) : '—'}</td>
                      <td className="px-4 py-3">
                        {lastReminder?.status === 'sent' ? (
                          <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700 font-medium">Verstuurd</span>
                        ) : isDue ? (
                          <span className="px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700 font-medium">Te versturen</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-500">Nog niet</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
