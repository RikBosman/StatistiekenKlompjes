'use client'

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { MarginData } from '@/lib/analytics'

interface Props {
  data: MarginData[]
}

export default function MarginChart({ data }: Props) {
  const chartData = data.map((d) => ({
    month: d.month,
    Omzet: Math.round(d.revenue),
    Inkoop: Math.round(d.cogs),
    Verzending: Math.round(d.shippingCharged),
    'Marge %': Math.round(d.grossMarginPct),
  }))

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={chartData} margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748b' }} />
        <YAxis yAxisId="left" tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`} />
        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(v) => `${v}%`} />
        <Tooltip
          formatter={(value: number, name: string) =>
            name === 'Marge %' ? [`${value}%`, name] : [`€${value.toLocaleString('nl-NL')}`, name]
          }
          contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #e2e8f0' }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar yAxisId="left" dataKey="Omzet" fill="#0e8ee7" radius={[3, 3, 0, 0]} />
        <Bar yAxisId="left" dataKey="Inkoop" fill="#f59e0b" radius={[3, 3, 0, 0]} />
        <Bar yAxisId="left" dataKey="Verzending" fill="#f97316" radius={[3, 3, 0, 0]} />
        <Line yAxisId="right" type="monotone" dataKey="Marge %" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
