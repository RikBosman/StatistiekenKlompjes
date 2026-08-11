import { getProductPerformance, type ProductStatus } from '@/lib/analytics'
import { formatCurrency } from '@/lib/utils'
import TrendSparkline from '@/components/TrendSparkline'

export const revalidate = 300

const statusLabel: Record<ProductStatus, string> = {
  new_rising: 'Nieuw & stijgend',
  steady: 'Stabiel',
  declining: 'Dalend',
  new_slow: 'Nieuw & traag',
  underperforming: 'Onderpresterend',
}

const statusColor: Record<ProductStatus, string> = {
  new_rising: 'bg-green-100 text-green-700',
  steady: 'bg-blue-100 text-blue-700',
  declining: 'bg-red-100 text-red-700',
  new_slow: 'bg-amber-100 text-amber-700',
  underperforming: 'bg-slate-100 text-slate-600',
}

export default async function ProductsPage() {
  let products = null
  let error = null

  try {
    products = await getProductPerformance()
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

  if (!products || products.length === 0) {
    return (
      <div className="p-8">
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-8 text-center">
          <p className="text-slate-500">Geen producten gevonden. Voer eerst een sync uit.</p>
        </div>
      </div>
    )
  }

  // Sort: new_rising first, then by revenue desc
  const sorted = [...products].sort((a, b) => {
    const order: Record<ProductStatus, number> = {
      new_rising: 0,
      steady: 1,
      declining: 2,
      new_slow: 3,
      underperforming: 4,
    }
    if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status]
    return b.totalRevenueLast30 - a.totalRevenueLast30
  })

  const counts = products.reduce(
    (acc, p) => {
      acc[p.status] = (acc[p.status] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  return (
    <div className="p-8">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-slate-900">Producten</h2>
        <p className="text-slate-500 text-sm mt-1">Performance & forecast op basis van laatste 6 maanden</p>
      </div>

      {/* Summary chips */}
      <div className="flex flex-wrap gap-2 mb-6">
        {(Object.entries(counts) as [ProductStatus, number][]).map(([status, count]) => (
          <span
            key={status}
            className={`px-3 py-1 rounded-full text-xs font-medium ${statusColor[status]}`}
          >
            {statusLabel[status]}: {count}
          </span>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-4 py-3 font-medium text-slate-600">Product</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Verkoop 30d</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Omzet 30d</th>
                <th className="text-center px-4 py-3 font-medium text-slate-600">Trend (6m)</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Forecast</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Inkoopprijs</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p, idx) => (
                <tr
                  key={p.id}
                  className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${
                    idx % 2 === 0 ? '' : 'bg-slate-50/50'
                  }`}
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900 truncate max-w-xs">{p.name}</p>
                    {p.sku && <p className="text-xs text-slate-400">{p.sku}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[p.status]}`}
                    >
                      {statusLabel[p.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700">{p.totalUnitsLast30}</td>
                  <td className="px-4 py-3 text-right text-slate-700">
                    {formatCurrency(p.totalRevenueLast30)}
                  </td>
                  <td className="px-4 py-3 flex justify-center">
                    <TrendSparkline
                      data={p.monthlySales}
                      color={
                        p.status === 'new_rising' || p.status === 'steady'
                          ? '#10b981'
                          : p.status === 'declining' || p.status === 'underperforming'
                          ? '#ef4444'
                          : '#f59e0b'
                      }
                    />
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-brand-700">
                    {p.forecastNextMonth > 0 ? `${p.forecastNextMonth} st.` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-500">
                    {p.cogs != null ? formatCurrency(p.cogs) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
