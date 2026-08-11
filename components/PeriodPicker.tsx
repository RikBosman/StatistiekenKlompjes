const PERIODS = [
  { key: '7d',  label: '7D' },
  { key: '30d', label: '30D' },
  { key: '3m',  label: '3M' },
  { key: '6m',  label: '6M' },
  { key: 'ytd', label: 'Dit jaar' },
  { key: '1y',  label: '1J' },
] as const

interface Props {
  active: string
  // Extra search params to preserve when switching period (e.g. "&filter=new_rising")
  extraParams?: string
}

export default function PeriodPicker({ active, extraParams = '' }: Props) {
  return (
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
  )
}
