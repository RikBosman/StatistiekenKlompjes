'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DailyRateForm({ current }: { current: number }) {
  const router = useRouter()
  const [value, setValue] = useState(current > 0 ? String(current) : '')
  const [state, setState] = useState<'idle' | 'saving' | 'done' | 'error'>('idle')

  async function save() {
    const rate = parseFloat(value)
    if (isNaN(rate) || rate < 0) { setState('error'); return }
    setState('saving')
    const res = await fetch('/api/ads-daily-rate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rate }),
    })
    const data = await res.json()
    setState(data.ok ? 'done' : 'error')
    if (data.ok) router.refresh()
  }

  const rate = parseFloat(value) || 0

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <h3 className="font-semibold text-slate-900 mb-1">Google Ads — dagelijks budget</h3>
      <p className="text-xs text-slate-400 mb-5">
        Vul één bedrag in. Dit wordt automatisch doorgerekend voor elke dag in de geselecteerde periode.
      </p>

      <div className="flex items-end gap-3 mb-6">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Bedrag per dag (€)</label>
          <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-brand-500">
            <span className="px-3 py-2 bg-slate-50 text-slate-400 text-sm border-r border-slate-200">€</span>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="410"
              value={value}
              onChange={(e) => { setValue(e.target.value); setState('idle') }}
              className="px-3 py-2 text-slate-900 text-sm w-32 focus:outline-none"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={state === 'saving'}
          className="px-5 py-2 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors font-medium"
        >
          {state === 'saving' ? 'Opslaan…' : 'Opslaan'}
        </button>
        {state === 'done' && <span className="text-sm text-green-700 font-medium">Opgeslagen</span>}
        {state === 'error' && <span className="text-sm text-red-600">Vul een geldig bedrag in</span>}
      </div>

      {rate > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: '7 dagen', days: 7 },
            { label: '30 dagen', days: 30 },
            { label: '3 maanden', days: 91 },
            { label: '1 jaar', days: 365 },
          ].map(({ label, days }) => (
            <div key={label} className="bg-orange-50 rounded-lg border border-orange-100 p-3 text-center">
              <p className="text-xs text-orange-500 mb-1">{label}</p>
              <p className="font-bold text-orange-700">
                €{(rate * days).toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
