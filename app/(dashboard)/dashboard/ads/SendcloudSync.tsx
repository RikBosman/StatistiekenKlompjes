'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  publicKey: string
  secretKey: string
}

function getQuarters() {
  const now = new Date()
  const quarters = []
  for (let i = 0; i < 8; i++) {
    const totalMonths = now.getFullYear() * 12 + now.getMonth() - i * 3
    const year = Math.floor(totalMonths / 12)
    const q = Math.floor((totalMonths % 12) / 3)
    const startMonth = q * 3
    const from = new Date(year, startMonth, 1)
    const to = new Date(year, startMonth + 3, 0)
    quarters.push({
      label: `Q${q + 1} ${year}`,
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
    })
  }
  return quarters
}

export default function SendcloudSync({ publicKey, secretKey }: Props) {
  const router = useRouter()
  const [pk, setPk] = useState(publicKey)
  const [sk, setSk] = useState(secretKey)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'done' | 'error'>('idle')
  const [syncState, setSyncState] = useState<'idle' | 'syncing' | 'done' | 'error'>('idle')
  const [syncMsg, setSyncMsg] = useState('')

  const quarters = getQuarters()
  const [selectedQuarter, setSelectedQuarter] = useState(quarters[0].from + '|' + quarters[0].to)

  async function saveKeys() {
    setSaveState('saving')
    const [r1, r2] = await Promise.all([
      fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'sendcloud_public_key', value: pk }) }),
      fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'sendcloud_secret_key', value: sk }) }),
    ])
    const [d1, d2] = await Promise.all([r1.json(), r2.json()])
    setSaveState(d1.ok && d2.ok ? 'done' : 'error')
  }

  async function runSync() {
    setSyncState('syncing')
    setSyncMsg('')
    const [from, to] = selectedQuarter === 'all' ? [undefined, undefined] : selectedQuarter.split('|')
    const res = await fetch('/api/sendcloud/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(from ? { from, to } : {}),
    })
    const data = await res.json()
    if (data.ok) {
      setSyncState('done')
      const details = data.months?.join(', ') ?? ''
      setSyncMsg(`${data.savedMonths} maanden opgeslagen (${data.totalFetched} zendingen) — ${details}`)
      router.refresh()
    } else {
      setSyncState('error')
      setSyncMsg(data.error ?? 'Onbekende fout')
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <h3 className="font-semibold text-slate-900 mb-1">SendCloud API koppeling</h3>
      <p className="text-xs text-slate-400 mb-5">
        Vind je API-sleutels in SendCloud → Instellingen → API. Gebruik de Public key en Secret key van je integratie.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Public key</label>
          <input
            type="text"
            value={pk}
            onChange={(e) => { setPk(e.target.value); setSaveState('idle') }}
            placeholder="abc123..."
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Secret key</label>
          <input
            type="password"
            value={sk}
            onChange={(e) => { setSk(e.target.value); setSaveState('idle') }}
            placeholder="••••••••"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap mb-5">
        <button
          onClick={saveKeys}
          disabled={saveState === 'saving'}
          className="px-5 py-2 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors font-medium"
        >
          {saveState === 'saving' ? 'Opslaan…' : 'Sleutels opslaan'}
        </button>
        {saveState === 'done' && <span className="text-sm text-green-700 font-medium">Sleutels opgeslagen</span>}
        {saveState === 'error' && <span className="text-sm text-red-600">Opslaan mislukt</span>}
      </div>

      <div className="pt-4 border-t border-slate-100">
        <p className="text-xs text-slate-500 mb-3">
          Synchroniseer verzendkosten per kwartaal vanuit de SendCloud API. De maandtotalen worden opgeslagen en gebruikt in de berekeningen.
        </p>
        <div className="flex items-end gap-3 flex-wrap">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Kwartaal</label>
            <select
              value={selectedQuarter}
              onChange={(e) => setSelectedQuarter(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {quarters.map(q => (
                <option key={q.from} value={`${q.from}|${q.to}`}>{q.label}</option>
              ))}
              <option value="all">Alle zendingen</option>
            </select>
          </div>
          <button
            onClick={runSync}
            disabled={syncState === 'syncing' || !pk || !sk}
            className="px-5 py-2 bg-slate-800 text-white text-sm rounded-lg hover:bg-slate-900 disabled:opacity-50 transition-colors font-medium"
          >
            {syncState === 'syncing' ? 'Bezig…' : 'Verzendkosten synchroniseren'}
          </button>
        </div>
        {syncState === 'done' && <p className="text-green-700 text-sm mt-3 font-medium">✓ {syncMsg}</p>}
        {syncState === 'error' && <p className="text-red-600 text-sm mt-3">{syncMsg}</p>}
      </div>
    </div>
  )
}
