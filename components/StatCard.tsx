interface Props {
  label: string
  value: string
  sub?: string
  highlight?: boolean
}

export default function StatCard({ label, value, sub, highlight }: Props) {
  return (
    <div className={`rounded-lg border p-5 ${highlight ? 'bg-brand-50 border-brand-200' : 'bg-white border-slate-200'}`}>
      <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-1">{label}</p>
      <p className={`text-2xl font-bold ${highlight ? 'text-brand-700' : 'text-slate-900'}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  )
}
