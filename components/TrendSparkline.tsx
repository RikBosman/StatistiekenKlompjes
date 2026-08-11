'use client'

import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts'
import type { MonthlyData } from '@/lib/analytics'

interface Props {
  data: MonthlyData[]
  color?: string
}

export default function TrendSparkline({ data, color = '#0e8ee7' }: Props) {
  const chartData = data.map((d) => ({ month: d.month, units: d.units }))

  return (
    <ResponsiveContainer width={80} height={32}>
      <LineChart data={chartData}>
        <Line
          type="monotone"
          dataKey="units"
          stroke={color}
          strokeWidth={1.5}
          dot={false}
        />
        <Tooltip
          formatter={(v: number) => [v, 'stuks']}
          contentStyle={{ fontSize: 11, padding: '2px 6px' }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
