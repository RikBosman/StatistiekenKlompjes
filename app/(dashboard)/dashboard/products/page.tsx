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
  underperforming: 'bg-slate-100 text-slate-500',
}

export default async function ProductsPage({ searchParams }: { searchParams: { filter?: string; q?: string } }) {
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
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center">
          <p className="text-slate-500">Geen producten gevonden. Voer eerst een sync uit.</p>
        </div>
      </div>
    )
  }

  const activeFilter = searchParams.filter ?? 'all'
  const query = (searchParams.q ?? '').toLowerCase()

  const filtered = products.filter((p) => {
    const matchesFilter = activeFilter === 'all' || p.status === activeFilter
    const matchesQuery = !query || p.name.toLowerCase().includes(query) || (p.sku ?? '').toLowerCase().includes(query)
    return matchesFilter && matchesQuery
  })

  const sorted = [...filtered].sort((a, b) => {
    const order: Record<ProductStatus, number> = {
      new_rising: 0, steady: 1, declining: 2, new_slow: 3, underperforming: 4,
    }
    if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status]
    return b.totalRevenueLast30 - a.totalRevenueLast30
  })

  const counts = products.reduce((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const totalRevenue30d = products.reduce((s, p) => s + p.totalRevenueLast30, 0)
  const totalUnits30d = products.reduce((s, p) => s + p.totalUnitsLast30, 0)
  const activeProducts = products.filter((p) => p.totalUnitsLast30 > 0).length

  const filterItems = [
    { key: 'all', label: `Alle (${products.length})` },
    { key: 'new_rising', label: `Stijgend (${counts['new_rising'] ?? 0})` },
    { key: 'steady', label: `Stabiel (${counts['steady'] ?? 0})` },
    { key: 'declining', label: `Dalend (${counts['declining'] ?? 0})` },
    { key: 'underperforming', label: `Onderpresterend (${counts['underperforming'] ?? 0})` },
  ]

  return (
    <div className="p-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900">Producten</h2>
        <p className="text-slate-500 text-sm mt-1">Performance & forecast — laatste 6 maanden</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-2">Omzet (30d)</p>
          <p className="text-2xl font-bold text-slate-900">{formatCurrency(totalRevenue30d)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-2">Verkopen (30d)</p>
          <p className="text-2xl font-bold text-slate-900">{totalUnits30d} stuks</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-2">Actieve producten</p>
          <p className="text-2xl font-bold text-slate-900">{activeProducts} <span className="text-sm font-normal text-slate-400">van {products.length}</span></p>
        </div>
      </div>

      {/* Filters + search */}
      <div className="bg-white rounded-xl border border-slate-200 mb-0.5">
        <div className="p-4 border-b border-slate-100 flex flex-wrap items-center gap-3">
          <form className="flex-1 min-w-48">
            <input
              type="text"
              name="q"
              defaultValue={query}
              placeholder="Zoek op naam of SKU..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </form>
          <div className="flex gap-1 flex-wrap">
            {filterItems.map((f) => (
              <a
                key={f.key}
                href={`?filter=${f.key}${query ? `&q=${query}` : ''}`}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeFilter === f.key
                    ? 'bg-brand-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {f.label}
              </a>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-6 py-3 font-medium text-slate-500">Product</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">Status</th>
                <th className="text-right px-4 py-3 font-medium text-slate-500">Verkopen 30d</th>
                <th className="text-right px-4 py-3 font-medium text-slate-500">Omzet 30d</th>
                <th className="text-center px-4 py-3 font-medium text-slate-500">Trend (6m)</th>
                <th className="text-right px-4 py-3 font-medium text-slate-500">Forecast</th>
                <th className="text-right px-4 py-3 font-medium text-slate-500">Inkoop</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-400 text-sm">
                    Geen producten gevonden voor deze filter.
                  </td>
                </tr>
              ) : sorted.map((p) => (
                <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-3">
                    <p className="font-medium text-slate-900 truncate max-w-xs">{p.name}</p>
                    {p.sku && <p className="text-xs text-slate-400 font-mono">{p.sku}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[p.status]}`}>
                      {statusLabel[p.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700 tabular-nums">{p.totalUnitsLast30}</td>
                  <td className="px-4 py-3 text-right text-slate-700 tabular-nums font-medium">{formatCurrency(p.totalRevenueLast30)}</td>
                  <td className="px-4 py-3 flex justify-center">
                    <TrendSparkline
                      data={p.monthlySales}
                      color={
                        p.status === 'new_rising' || p.status === 'steady' ? '#10b981'
                        : p.status === 'declining' || p.status === 'underperforming' ? '#ef4444'
                        : '#f59e0b'
                      }
                    />
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-brand-700 tabular-nums">
                    {p.forecastNextMonth > 0 ? `${p.forecastNextMonth} st.` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-400 tabular-nums">
                    {p.cogs != null ? formatCurrency(p.cogs) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-xs text-slate-400 mt-2 px-1">{sorted.length} van {products.length} producten</p>
    </div>
  )
}
