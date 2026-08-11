import { getMarginData } from '@/lib/analytics'
import { formatCurrency, formatPercent } from '@/lib/utils'
import MarginChart from '@/components/MarginChart'

export const revalidate = 300

export default async function MarginsPage() {
  let data = null
  let error = null

  try {
    data = await getMarginData(6)
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

  const latest = data?.[data.length - 1]

  return (
    <div className="p-8">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-slate-900">Marges & Kosten</h2>
        <p className="text-slate-500 text-sm mt-1">
          Omzet − Inkoopkosten − Verzendkosten − Advertentiekosten = Bruto marge
        </p>
      </div>

      {/* Current month summary */}
      {latest && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          {[
            { label: 'Omzet', value: formatCurrency(latest.revenue), color: 'text-slate-900' },
            { label: 'Inkoopkosten', value: formatCurrency(latest.cogs), color: 'text-amber-600' },
            { label: 'Verzendkosten', value: formatCurrency(latest.shippingCharged), color: 'text-amber-600' },
            { label: 'Advertentiekosten', value: formatCurrency(latest.adSpend), color: 'text-amber-600' },
            {
              label: 'Bruto marge',
              value: `${formatPercent(latest.grossMarginPct)} (${formatCurrency(latest.grossMargin)})`,
              color: latest.grossMargin >= 0 ? 'text-green-600' : 'text-red-600',
            },
          ].map((item) => (
            <div key={item.label} className="bg-white rounded-lg border border-slate-200 p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-1">{item.label}</p>
              <p className={`text-lg font-bold ${item.color}`}>{item.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Chart */}
      {data && data.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200 p-6 mb-8">
          <h3 className="text-slate-700 font-medium mb-4">Maandoverzicht — 6 maanden</h3>
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
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Verzending</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Advertenties</th>
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
                    <td className="px-4 py-3 text-right text-slate-500">{formatCurrency(row.shippingCharged)}</td>
                    <td className="px-4 py-3 text-right text-slate-500">{formatCurrency(row.adSpend)}</td>
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

      {/* Note about data sources */}
      <div className="mt-6 bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-700">
        <strong>Let op:</strong> Verzendkosten = bedrag dat de klant heeft betaald (niet de werkelijke
        verzendkosten). Google Ads-kosten worden getoond als de API is geconfigureerd.
        Inkoopkosten worden geladen via het <code>_wc_cog_cost</code> veld per product.
      </div>
    </div>
  )
}
