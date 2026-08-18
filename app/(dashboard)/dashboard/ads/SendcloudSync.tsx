'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  publicKey: string
  secretKey: string
}

export default function SendcloudSync({ publicKey, secretKey }: Props) {
  const router = useRouter()
  const [pk, setPk] = useState(publicKey)
  const [sk, setSk] = useState(secretKey)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'done' | 'error'>('idle')
  const [syncState, setSyncState] = useState<'idle' | 'syncing' | 'done' | 'error'>('idle')
  const [syncMsg, setSyncMsg] = useState('')
  const [syncDetail, setSyncDetail] = useState<string[]>([])
  const [syncDebug, setSyncDebug] = useState('')

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
    setSyncDetail([])
    const res = await fetch('/api/sendcloud/sync', { method: 'POST' })
    const data = await res.json()
    if (data.ok) {
      setSyncState('done')
      setSyncMsg(`${data.savedMonths} maanden opgeslagen (${data.totalFetched} zendingen opgehaald)`)
      setSyncDetail(data.months ?? [])
      setSyncDebug(`Overgeslagen: ${data.skippedNoPrice} geen prijs, ${data.skippedNoDate} geen datum · Lijst-velden: ${(data.listFields ?? []).join(', ')} · Detail-velden: ${(data.detailFields ?? []).join(', ')}`)
      if (data.savedMonths > 0) router.refresh()
    } else {
      setSyncState('error')
      setSyncMsg(data.error ?? 'Onbekende fout')
      if (data.subObjects) {
        setSyncDebug(`Sub-objecten: ${JSON.stringify(data.subObjects, null, 2)}`)
      } else if (data.listFields || data.detailFields) {
        setSyncDebug(`Lijst-velden: ${(data.listFields ?? []).join(', ')} · Detail-velden: ${(data.detailFields ?? []).join(', ')}`)
      }
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

      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={saveKeys}
          disabled={saveState === 'saving'}
          className="px-5 py-2 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors font-medium"
        >
          {saveState === 'saving' ? 'Opslaan…' : 'Sleutels opslaan'}
        </button>
        <button
          onClick={runSync}
          disabled={syncState === 'syncing' || !pk || !sk}
          className="px-5 py-2 bg-slate-800 text-white text-sm rounded-lg hover:bg-slate-900 disabled:opacity-50 transition-colors font-medium"
        >
          {syncState === 'syncing' ? 'Bezig…' : 'Verzendkosten synchroniseren'}
        </button>
        {saveState === 'done' && <span className="text-sm text-green-700 font-medium">Sleutels opgeslagen</span>}
        {saveState === 'error' && <span className="text-sm text-red-600">Opslaan mislukt</span>}
      </div>

      {syncState === 'done' && (
        <div className="mt-3">
          <p className="text-green-700 text-sm font-medium">✓ {syncMsg}</p>
          {syncDetail.length > 0 && (
            <p className="text-slate-500 text-xs mt-1">{syncDetail.join(' · ')}</p>
          )}
          {syncDebug && (
            <p className="text-slate-400 text-xs mt-1 font-mono">{syncDebug}</p>
          )}
        </div>
      )}
      {syncState === 'error' && (
        <div className="mt-3">
          <p className="text-red-600 text-sm">{syncMsg}</p>
          {syncDebug && <p className="text-slate-400 text-xs mt-1 font-mono">{syncDebug}</p>}
        </div>
      )}
    </div>
  )
}
