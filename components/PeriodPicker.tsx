'use client'

import { useRouter } from 'next/navigation'

const PERIODS = [
  { key: '7d',  label: '7D' },
  { key: '30d', label: '30D' },
  { key: '3m',  label: '3M' },
  { key: '6m',  label: '6M' },
  { key: 'ytd', label: 'Dit jaar' },
  { key: '1y',  label: '1J' },
] as const

// Generate last 18 months as YYYY-MM options
function getMonthOptions() {
  const options: { value: string; label: string }[] = []
  const now = new Date()
  for (let i = 0; i < 18; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })
    options.push({ value, label })
  }
  return options
}

interface Props {
  active: string
  extraParams?: string
}

export default function PeriodPicker({ active, extraParams = '' }: Props) {
  const router = useRouter()
  const monthOptions = getMonthOptions()
  const isMonth = /^\d{4}-\d{2}$/.test(active)

  function navigate(period: string) {
    router.push(`?period=${period}${extraParams}`)
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
        {PERIODS.map((p) => (
          <a
            key={p.key}
            href={`?period=${p.key}${extraParams}`}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
              active === p.key
                ? 'bg-white shadow-sm text-slate-900 font-semibold'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {p.label}
          </a>
        ))}
      </div>
      <select
        value={isMonth ? active : ''}
        onChange={(e) => { if (e.target.value) navigate(e.target.value) }}
        className={`border rounded-lg px-3 py-1.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 ${
          isMonth
            ? 'border-brand-500 bg-white text-slate-900 shadow-sm font-semibold'
            : 'border-slate-200 bg-slate-100 text-slate-500'
        }`}
      >
        <option value="">Maand kiezen…</option>
        {monthOptions.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  )
}
