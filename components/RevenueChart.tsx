'use client'

import {
  BarChart,
  Bar,
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

export default function RevenueChart({ data }: Props) {
  const chartData = data.map((d) => ({
    month: d.month,
    Omzet: Math.round(d.revenue),
    Marge: Math.round(d.grossMargin),
    Kosten: Math.round(d.cogs + d.shippingCharged + d.adSpend),
  }))

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chartData} margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748b' }} />
        <YAxis tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`} />
        <Tooltip
          formatter={(value: number, name: string) => [`€${value.toLocaleString('nl-NL')}`, name]}
          contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #e2e8f0' }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="Omzet" fill="#0e8ee7" radius={[3, 3, 0, 0]} />
        <Bar dataKey="Kosten" fill="#f59e0b" radius={[3, 3, 0, 0]} />
        <Bar dataKey="Marge" fill="#10b981" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
