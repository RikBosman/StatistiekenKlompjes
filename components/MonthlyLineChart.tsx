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
}

const METRICS: MetricDef[] = [
  { key: 'revenueExclBtw',             label: 'Omzet excl. BTW',    color: '#2563eb', format: 'currency' },
  { key: 'totalOrders',                label: 'Orders',              color: '#7c3aed', format: 'number'   },
  { key: 'avgOrderValue',              label: 'Gem. orderwaarde',    color: '#0891b2', format: 'currency' },
  { key: 'adSpend',                    label: 'Google Ads spend',    color: '#ea580c', format: 'currency' },
  { key: 'roas',                       label: 'ROAS',                color: '#16a34a', format: 'roas'     },
  { key: 'contributionMarginPerAd',    label: 'CM / Google-euro',    color: '#15803d', format: 'roas'     },
  { key: 'cogs',                       label: 'Inkoopwaarde',        color: '#b45309', format: 'currency' },
  { key: 'actualShipping',             label: 'Verzendkosten',       color: '#6b7280', format: 'currency' },
  { key: 'packagingCost',              label: 'Verpakkingskosten',   color: '#9ca3af', format: 'currency' },
  { key: 'paymentCost',                label: 'Betaalkosten',        color: '#d97706', format: 'currency' },
  { key: 'contributionMargin',         label: 'Contributiemarge',    color: '#059669', format: 'currency' },
  { key: 'contributionMarginPerOrder', label: 'CM per order',        color: '#10b981', format: 'currency' },
]

type TimeView = 'month' | 'quarter' | 'year'

type ChartRow = Record<string, number | null | string>

function groupKey(month: string, view: TimeView): string {
  const [year, m] = month.split('-').map(Number)
  if (view === 'year') return String(year)
  if (view === 'quarter') return `${year}-Q${Math.ceil(m / 3)}`
  return month
}

function fmtLabel(key: string, view: TimeView): string {
  if (view === 'year' || view === 'quarter') return key.replace('-', ' ')
  const [year, m] = key.split('-').map(Number)
  return new Date(year, m - 1, 1).toLocaleDateString('nl-NL', { month: 'short', year: '2-digit' })
}

function buildRows(data: MarginData[], view: TimeView): ChartRow[] {
  const source = view === 'month' ? data.slice(-25) : data
  const groups = new Map<string, MarginData[]>()
  for (const d of source) {
    const k = groupKey(d.month, view)
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k)!.push(d)
  }

  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, items]) => {
      const s = <K extends keyof MarginData>(fn: (d: MarginData) => number) =>
        items.reduce((acc, d) => acc + fn(d), 0)

      const revenue = s(d => d.revenue)
      const adSpend = s(d => d.adSpend)
      const totalOrders = s(d => d.totalOrders)
      const contributionMargin = s(d => d.contributionMargin)

      return {
        month: fmtLabel(key, view),
        revenueExclBtw: s(d => d.revenueExclBtw),
        totalOrders,
        avgOrderValue: totalOrders > 0 ? revenue / totalOrders : 0,
        adSpend,
        roas: adSpend > 0 ? revenue / adSpend : null,
        contributionMarginPerAd: adSpend > 0 ? contributionMargin / adSpend : null,
        cogs: s(d => d.cogs),
        actualShipping: s(d => d.actualShipping),
        packagingCost: s(d => d.packagingCost),
        paymentCost: s(d => d.paymentCost),
        contributionMargin,
        contributionMarginPerOrder: totalOrders > 0 ? contributionMargin / totalOrders : 0,
      } as ChartRow
    })
}

function fmt(value: number | null, format: MetricDef['format']): string {
  if (value === null) return '—'
  if (format === 'currency') return `€${value.toFixed(2)}`
  if (format === 'number') return String(Math.round(value))
  if (format === 'pct') return `${value.toFixed(1)}%`
  return `${value.toFixed(2)}×`
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: { color: string; dataKey: string; value: number | null }[] }) {
  if (!active || !payload?.length) return null
  const row = payload[0]
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-xs max-w-xs">
      {payload.map((p) => {
        const m = METRICS.find(m => m.key === p.dataKey)
        return (
          <div key={p.dataKey} className="flex justify-between gap-4 mb-0.5">
            <span style={{ color: p.color }}>{m?.label ?? p.dataKey}</span>
            <span className="font-medium text-slate-800">{fmt(p.value, m?.format ?? 'currency')}</span>
          </div>
        )
      })}
    </div>
  )
}

const TIME_VIEWS: { value: TimeView; label: string }[] = [
  { value: 'month',   label: 'Per maand' },
  { value: 'quarter', label: 'Per kwartaal' },
  { value: 'year',    label: 'Per jaar' },
]

export default function MonthlyLineChart({ data }: Props) {
  const [active, setActive] = useState<Set<string>>(
    new Set(['revenueExclBtw', 'contributionMargin', 'adSpend'])
  )
  const [timeView, setTimeView] = useState<TimeView>('month')

  function toggle(key: string) {
    setActive(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const chartData = useMemo(() => buildRows(data, timeView), [data, timeView])

  const currencyActive = [...active].some(k => METRICS.find(m => m.key === k && m.format === 'currency'))
  const otherActive    = [...active].some(k => METRICS.find(m => m.key === k && m.format !== 'currency'))

  return (
    <div>
      {/* Time view switcher */}
      <div className="flex items-center gap-1 mb-5">
        {TIME_VIEWS.map(tv => (
          <button
            key={tv.value}
            onClick={() => setTimeView(tv.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              timeView === tv.value
                ? 'bg-slate-800 text-white'
                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
          >
            {tv.label}
          </button>
        ))}
      </div>

      {/* Metric toggles */}
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
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: active.has(m.key) ? 'white' : m.color }}
            />
            {m.label}
          </button>
        ))}
      </div>

      {active.size === 0 ? (
        <p className="text-slate-400 text-sm text-center py-12">Selecteer minstens één lijn hierboven.</p>
      ) : (
        <ResponsiveContainer width="100%" height={340}>
          <LineChart data={chartData} margin={{ top: 8, right: otherActive ? 60 : 16, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
            {currencyActive && (
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
            {otherActive && (
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
