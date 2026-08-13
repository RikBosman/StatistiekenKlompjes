import { getProductPerformance, periodToRange, type ProductStatus } from '@/lib/analytics'
import { formatCurrency } from '@/lib/utils'
import TrendSparkline from '@/components/TrendSparkline'
import PeriodPicker from '@/components/PeriodPicker'

export const revalidate = 300

const statusLabel: Record<ProductStatus, string> = {
  new_rising:     'Nieuw & stijgend',
  steady:         'Stabiel',
  declining:      'Dalend',
  new_slow:       'Nieuw & traag',
  underperforming:'Onderpresterend',
}

const statusColor: Record<ProductStatus, string> = {
  new_rising:     'bg-green-100 text-green-700',
  steady:         'bg-blue-100 text-blue-700',
  declining:      'bg-red-100 text-red-700',
  new_slow:       'bg-amber-100 text-amber-700',
  underperforming:'bg-slate-100 text-slate-500',
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; q?: string; period?: string; sort?: string }>
}) {
  const { period = '30d', filter, q, sort } = await searchParams
  const { label: periodLabel } = periodToRange(period)

  let products = null
  let error = null

  try {
    products = await getProductPerformance(period)
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

  const activeFilter = filter ?? 'all'
  const activeSort = sort ?? 'status'
  const query = (q ?? '').toLowerCase()

  // Extra search params to preserve when switching period
  const extraParams = [
    activeFilter !== 'all' ? `&filter=${activeFilter}` : '',
    query ? `&q=${query}` : '',
    activeSort !== 'status' ? `&sort=${activeSort}` : '',
  ].join('')

  const filtered = products.filter((p) => {
    const matchesFilter = activeFilter === 'all' || p.status === activeFilter
    const matchesQuery = !query || p.name.toLowerCase().includes(query) || (p.sku ?? '').toLowerCase().includes(query)
    return matchesFilter && matchesQuery
  })

  let sorted: typeof filtered
  if (activeSort === 'revenue') {
    sorted = [...filtered].sort((a, b) => b.totalRevenuePeriod - a.totalRevenuePeriod).slice(0, 20)
  } else if (activeSort === 'units') {
    sorted = [...filtered].sort((a, b) => b.totalUnitsPeriod - a.totalUnitsPeriod).slice(0, 20)
  } else {
    const statusOrder: Record<ProductStatus, number> = {
      new_rising: 0, steady: 1, declining: 2, new_slow: 3, underperforming: 4,
    }
    sorted = [...filtered].sort((a, b) => {
      if (statusOrder[a.status] !== statusOrder[b.status]) return statusOrder[a.status] - statusOrder[b.status]
      return b.totalRevenuePeriod - a.totalRevenuePeriod
    })
  }

  const counts = products.reduce((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const totalRevenue  = products.reduce((s, p) => s + p.totalRevenuePeriod, 0)
  const totalUnits    = products.reduce((s, p) => s + p.totalUnitsPeriod, 0)
  const totalProfit   = products.reduce((s, p) => s + p.grossProfit, 0)
  const activeCount   = products.filter((p) => p.totalUnitsPeriod > 0).length

  const filterItems = [
    { key: 'all',             label: `Alle (${products.length})` },
    { key: 'new_rising',      label: `Stijgend (${counts['new_rising'] ?? 0})` },
    { key: 'steady',          label: `Stabiel (${counts['steady'] ?? 0})` },
    { key: 'declining',       label: `Dalend (${counts['declining'] ?? 0})` },
    { key: 'underperforming', label: `Onderpresterend (${counts['underperforming'] ?? 0})` },
  ]

  return (
    <div className="p-8">
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Producten</h2>
          <p className="text-slate-500 text-sm mt-1">{periodLabel} — trend op basis van 6 maanden</p>
        </div>
        <PeriodPicker active={period} extraParams={extraParams} />
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-2">Omzet ({period})</p>
          <p className="text-2xl font-bold text-slate-900">{formatCurrency(totalRevenue)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-2">Bruto winst ({period})</p>
          <p className={`text-2xl font-bold ${totalProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>{formatCurrency(totalProfit)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-2">Verkopen ({period})</p>
          <p className="text-2xl font-bold text-slate-900">{totalUnits} stuks</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-2">Actieve producten</p>
          <p className="text-2xl font-bold text-slate-900">
            {activeCount} <span className="text-sm font-normal text-slate-400">van {products.length}</span>
          </p>
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
                href={`?filter=${f.key}&period=${period}${query ? `&q=${query}` : ''}${activeSort !== 'status' ? `&sort=${activeSort}` : ''}`}
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
          <div className="flex gap-1 border-l border-slate-200 pl-3">
            {[
              { key: 'status', label: 'Status' },
              { key: 'revenue', label: 'Top 20 omzet' },
              { key: 'units', label: 'Top 20 stuks' },
            ].map((s) => (
              <a
                key={s.key}
                href={`?sort=${s.key}&period=${period}&filter=${activeFilter}${query ? `&q=${query}` : ''}`}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeSort === s.key
                    ? 'bg-slate-800 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {s.label}
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
                <th className="text-left px-4 py-3 font-medium text-slate-500">Leverancier</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">Status</th>
                <th className="text-right px-4 py-3 font-medium text-slate-500">Verkopen ({period})</th>
                <th className="text-right px-4 py-3 font-medium text-slate-500">Omzet ({period})</th>
                <th className="text-center px-4 py-3 font-medium text-slate-500">Trend (6m)</th>
                <th className="text-right px-4 py-3 font-medium text-slate-500">Bruto winst</th>
                <th className="text-right px-4 py-3 font-medium text-slate-500">Marge</th>
                <th className="text-right px-4 py-3 font-medium text-slate-500">Forecast (volgend mnd)</th>
                <th className="text-right px-4 py-3 font-medium text-slate-500">Inkoop/stuk</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-8 text-center text-slate-400 text-sm">
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
                    <div className="flex flex-wrap gap-1">
                      {p.tags.length > 0
                        ? p.tags.map((t) => (
                            <span key={t} className="px-2 py-0.5 bg-violet-50 text-violet-700 border border-violet-200 rounded text-xs font-medium whitespace-nowrap">{t}</span>
                          ))
                        : <span className="text-slate-300 text-xs">—</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[p.status]}`}>
                      {statusLabel[p.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700 tabular-nums">{p.totalUnitsPeriod}</td>
                  <td className="px-4 py-3 text-right text-slate-700 tabular-nums font-medium">{formatCurrency(p.totalRevenuePeriod)}</td>
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
                  <td className="px-4 py-3 text-right tabular-nums">
                    {p.cogs != null && p.totalUnitsPeriod > 0 ? (
                      <span className={p.grossProfit >= 0 ? 'text-green-700 font-medium' : 'text-red-700 font-medium'}>
                        {formatCurrency(p.grossProfit)}
                      </span>
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-sm">
                    {p.cogs != null && p.totalRevenuePeriod > 0 ? (
                      <span className={p.profitMarginPct >= 0 ? 'text-green-700' : 'text-red-700'}>
                        {p.profitMarginPct.toFixed(0)}%
                      </span>
                    ) : <span className="text-slate-300">—</span>}
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
