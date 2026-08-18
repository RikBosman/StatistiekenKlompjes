'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  settingKey: string
  label: string
  description: string
  current: number
  prefix?: string
  suffix?: string
  step?: string
  placeholder?: string
}

export default function SettingInput({ settingKey, label, description, current, prefix, suffix, step = '0.01', placeholder = '0' }: Props) {
  const router = useRouter()
  const [value, setValue] = useState(current > 0 ? String(current) : '')
  const [state, setState] = useState<'idle' | 'saving' | 'done' | 'error'>('idle')

  async function save() {
    const num = parseFloat(value)
    if (isNaN(num) || num < 0) { setState('error'); return }
    setState('saving')
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: settingKey, value: num }),
    })
    const data = await res.json()
    setState(data.ok ? 'done' : 'error')
    if (data.ok) router.refresh()
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <h3 className="font-semibold text-slate-900 mb-1">{label}</h3>
      <p className="text-xs text-slate-400 mb-5">{description}</p>
      <div className="flex items-end gap-3">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Bedrag</label>
          <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-brand-500">
            {prefix && <span className="px-3 py-2 bg-slate-50 text-slate-400 text-sm border-r border-slate-200">{prefix}</span>}
            <input
              type="number"
              min="0"
              step={step}
              placeholder={placeholder}
              value={value}
              onChange={(e) => { setValue(e.target.value); setState('idle') }}
              className="px-3 py-2 text-slate-900 text-sm w-28 focus:outline-none"
            />
            {suffix && <span className="px-3 py-2 bg-slate-50 text-slate-400 text-sm border-l border-slate-200">{suffix}</span>}
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
        {state === 'error' && <span className="text-sm text-red-600">Vul een geldig getal in</span>}
      </div>
    </div>
  )
}
