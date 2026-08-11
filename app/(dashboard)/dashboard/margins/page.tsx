import { getMarginData, periodToRange } from '@/lib/analytics'
import { formatCurrency, formatPercent } from '@/lib/utils'
import MarginChart from '@/components/MarginChart'
import PeriodPicker from '@/components/PeriodPicker'

export const revalidate = 300

export default async function MarginsPage({
  searchParams,
}: {
  searchParams: { period?: string }
}) {
  const period = searchParams.period ?? '6m'
  const { label: periodLabel } = periodToRange(period)

  let data = null
  let error = null

  try {
    data = await getMarginData(period)
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

  // Summary = sum of all months in period (not just latest month)
  const summary = data?.reduce(
    (acc, row) => ({
      revenue: acc.revenue + row.revenue,
      cogs: acc.cogs + row.cogs,
      actualShipping: acc.actualShipping + row.actualShipping,
      shippingCharged: acc.shippingCharged + row.shippingCharged,
      grossMargin: acc.grossMargin + row.grossMargin,
    }),
    { revenue: 0, cogs: 0, actualShipping: 0, shippingCharged: 0, grossMargin: 0 },
  )
  const summaryMarginPct = summary && summary.revenue > 0
    ? (summary.grossMargin / summary.revenue) * 100
    : 0

  return (
    <div className="p-8">
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Marges & Kosten</h2>
          <p className="text-slate-500 text-sm mt-1">{periodLabel} — Omzet − Inkoop − Werkelijke verzending = Bruto marge</p>
        </div>
        <PeriodPicker active={period} />
      </div>

      {/* Period summary */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          {[
            { label: 'Omzet',               value: formatCurrency(summary.revenue),         color: 'text-slate-900' },
            { label: 'Inkoopkosten',         value: formatCurrency(summary.cogs),            color: 'text-amber-600' },
            { label: 'Verzending (werkelijk)',value: formatCurrency(summary.actualShipping),  color: 'text-amber-600',
              sub: `Klant betaalde ${formatCurrency(summary.shippingCharged)}` },
            { label: 'Bruto marge',
              value: `${summaryMarginPct.toFixed(1)}% (${formatCurrency(summary.grossMargin)})`,
              color: summary.grossMargin >= 0 ? 'text-green-600' : 'text-red-600' },
            { label: 'Verzend-dekking',
              value: summary.actualShipping > 0
                ? `${((summary.shippingCharged / summary.actualShipping) * 100).toFixed(0)}%`
                : '—',
              color: summary.shippingCharged >= summary.actualShipping ? 'text-green-600' : 'text-amber-600',
              sub: 'Klant vs werkelijke kosten' },
          ].map((item) => (
            <div key={item.label} className="bg-white rounded-lg border border-slate-200 p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-1">{item.label}</p>
              <p className={`text-lg font-bold ${item.color}`}>{item.value}</p>
              {'sub' in item && item.sub && <p className="text-xs text-slate-400 mt-0.5">{item.sub}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Chart */}
      {data && data.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200 p-6 mb-8">
          <h3 className="text-slate-700 font-medium mb-4">Maandoverzicht — {periodLabel}</h3>
          <MarginChart data={data} />
        </div>
      )}

      {/* Table */}
      {data && data.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Maand</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Omzet</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Inkoop</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Verzending (werkelijk)</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Klant betaalde</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Bruto marge</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">%</th>
                </tr>
              </thead>
              <tbody>
                {[...data].reverse().map((row) => (
                  <tr key={row.month} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-700">{row.month}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{formatCurrency(row.revenue)}</td>
                    <td className="px-4 py-3 text-right text-slate-500">{formatCurrency(row.cogs)}</td>
                    <td className="px-4 py-3 text-right text-slate-500">{formatCurrency(row.actualShipping)}</td>
                    <td className="px-4 py-3 text-right text-slate-400 text-xs">{formatCurrency(row.shippingCharged)}</td>
                    <td className={`px-4 py-3 text-right font-medium ${row.grossMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(row.grossMargin)}
                    </td>
                    <td className={`px-4 py-3 text-right font-medium ${row.grossMarginPct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatPercent(row.grossMarginPct)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Shipping cost note */}
      <div className="mt-6 bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-700">
        <strong>Verzendtarieven:</strong> Brievenbuspakket {' '}
        <strong>€{parseFloat(process.env.LETTERBOX_SHIPPING_COST ?? '4.20').toFixed(2)}</strong>
        {' '}— Pakket{' '}
        <strong>€{parseFloat(process.env.PARCEL_SHIPPING_COST ?? '6.85').toFixed(2)}</strong>.
        {' '}Methode wordt opgeslagen bij nieuwe sync. Stel <code>LETTERBOX_SHIPPING_COST</code> en <code>PARCEL_SHIPPING_COST</code> in via .env om de tarieven aan te passen.
      </div>
    </div>
  )
}
