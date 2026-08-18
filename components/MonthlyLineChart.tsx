'use client'

import { useState, useMemo } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import type { MarginData } from '@/lib/analytics'

interface Props {
  data: MarginData[]
}

interface MetricDef {
  key: string
  label: string
  color: string
  format: 'currency' | 'number' | 'pct' | 'roas'
  getValue: (d: MarginData) => number | null
}

const METRICS: MetricDef[] = [
  { key: 'revenueExclBtw',            label: 'Omzet excl. BTW',         color: '#2563eb', format: 'currency', getValue: d => d.revenueExclBtw },
  { key: 'totalOrders',               label: 'Orders',                   color: '#7c3aed', format: 'number',   getValue: d => d.totalOrders },
  { key: 'avgOrderValue',             label: 'Gem. orderwaarde',         color: '#0891b2', format: 'currency', getValue: d => d.avgOrderValue },
  { key: 'adSpend',                   label: 'Google Ads spend',         color: '#ea580c', format: 'currency', getValue: d => d.adSpend },
  { key: 'roas',                      label: 'ROAS',                     color: '#16a34a', format: 'roas',     getValue: d => d.roas },
  { key: 'contributionMarginPerAd',   label: 'CM / Google-euro',         color: '#15803d', format: 'roas',     getValue: d => d.adSpend > 0 ? d.contributionMargin / d.adSpend : null },
  { key: 'cogs',                      label: 'Inkoopwaarde',             color: '#b45309', format: 'currency', getValue: d => d.cogs },
  { key: 'actualShipping',            label: 'Verzendkosten',            color: '#6b7280', format: 'currency', getValue: d => d.actualShipping },
  { key: 'packagingCost',             label: 'Verpakkingskosten',        color: '#9ca3af', format: 'currency', getValue: d => d.packagingCost },
  { key: 'paymentCost',               label: 'Betaalkosten',             color: '#d1d5db', format: 'currency', getValue: d => d.paymentCost },
  { key: 'contributionMargin',        label: 'Contributiemarge',         color: '#059669', format: 'currency', getValue: d => d.contributionMargin },
  { key: 'contributionMarginPerOrder',label: 'CM per order',             color: '#10b981', format: 'currency', getValue: d => d.contributionMarginPerOrder },
]

function fmt(value: number | null, format: 'currency' | 'number' | 'pct' | 'roas'): string {
  if (value === null) return '—'
  if (format === 'currency') return `€${value.toFixed(2)}`
  if (format === 'number') return String(Math.round(value))
  if (format === 'pct') return `${value.toFixed(1)}%`
  if (format === 'roas') return `${value.toFixed(2)}×`
  return String(value)
}

function fmtMonth(mk: string): string {
  const [year, month] = mk.split('-').map(Number)
  const d = new Date(year, month - 1, 1)
  return d.toLocaleDateString('nl-NL', { month: 'short', year: '2-digit' })
}

// Custom tooltip
function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number | null; color: string; dataKey: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-xs max-w-xs">
      <p className="font-semibold text-slate-700 mb-2">{label}</p>
      {payload.map((p) => {
        const metric = METRICS.find(m => m.key === p.dataKey)
        return (
          <div key={p.dataKey} className="flex justify-between gap-4 mb-0.5">
            <span style={{ color: p.color }}>{metric?.label ?? p.name}</span>
            <span className="font-medium text-slate-800">{fmt(p.value, metric?.format ?? 'currency')}</span>
          </div>
        )
      })}
    </div>
  )
}

export default function MonthlyLineChart({ data }: Props) {
  const [active, setActive] = useState<Set<string>>(new Set(['revenueExclBtw', 'contributionMargin', 'adSpend']))

  function toggle(key: string) {
    setActive(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // Build chart rows — each point is { month, ...metricValues }
  const chartData = useMemo(() => data.map(d => {
    const row: Record<string, number | null | string> = { month: fmtMonth(d.month) }
    for (const m of METRICS) row[m.key] = m.getValue(d)
    return row
  }), [data])

  // Determine which Y-axis to use per metric (currency vs dimensionless)
  // Left axis: currency. Right axis: counts, ROAS, multiples.
  const leftMetrics = METRICS.filter(m => m.format === 'currency')
  const rightMetrics = METRICS.filter(m => m.format !== 'currency')
  const hasLeft = [...active].some(k => leftMetrics.find(m => m.key === k))
  const hasRight = [...active].some(k => rightMetrics.find(m => m.key === k))

  return (
    <div>
      {/* Checkbox grid */}
      <div className="flex flex-wrap gap-2 mb-5">
        {METRICS.map(m => (
          <button
            key={m.key}
            onClick={() => toggle(m.key)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
              active.has(m.key)
                ? 'text-white border-transparent'
                : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'
            }`}
            style={active.has(m.key) ? { background: m.color, borderColor: m.color } : {}}
          >
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: active.has(m.key) ? 'white' : m.color }} />
            {m.label}
          </button>
        ))}
      </div>

      {active.size === 0 ? (
        <p className="text-slate-400 text-sm text-center py-12">Selecteer minstens één lijn hierboven.</p>
      ) : (
        <ResponsiveContainer width="100%" height={340}>
          <LineChart data={chartData} margin={{ top: 8, right: hasRight ? 60 : 16, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
            {hasLeft && (
              <YAxis
                yAxisId="left"
                orientation="left"
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={v => `€${Math.round(v)}`}
                width={62}
              />
            )}
            {hasRight && (
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                tickLine={false}
                axisLine={false}
                width={40}
              />
            )}
            <Tooltip content={<CustomTooltip />} />
            {METRICS.filter(m => active.has(m.key)).map(m => (
              <Line
                key={m.key}
                yAxisId={m.format === 'currency' ? 'left' : 'right'}
                dataKey={m.key}
                stroke={m.color}
                strokeWidth={2}
                dot={{ r: 3, fill: m.color, strokeWidth: 0 }}
                activeDot={{ r: 5 }}
                connectNulls
                name={m.label}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
