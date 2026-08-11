interface Props {
  label: string
  value: string
  sub?: string
  highlight?: boolean
  trend?: number // percentage change vs previous period
}

export default function StatCard({ label, value, sub, highlight, trend }: Props) {
  const trendColor = trend === undefined ? '' : trend >= 0 ? 'text-emerald-600' : 'text-red-500'
  const trendBg = trend === undefined ? '' : trend >= 0 ? 'bg-emerald-50' : 'bg-red-50'
  const trendArrow = trend === undefined ? '' : trend >= 0 ? '↑' : '↓'

  return (
    <div className={`rounded-xl border p-5 ${highlight ? 'bg-brand-50 border-brand-200' : 'bg-white border-slate-200'}`}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">{label}</p>
        {trend !== undefined && (
          <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-md ${trendColor} ${trendBg}`}>
            {trendArrow} {Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>
      <p className={`text-2xl font-bold ${highlight ? 'text-brand-700' : 'text-slate-900'}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  )
}
