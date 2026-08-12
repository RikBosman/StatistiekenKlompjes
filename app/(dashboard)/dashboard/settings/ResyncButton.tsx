'use client'

import { useState } from 'react'

export default function ResyncButton() {
  const [state, setState] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [result, setResult] = useState<{ count?: number; error?: string } | null>(null)

  async function run() {
    setState('running')
    setResult(null)
    try {
      const res = await fetch('/api/admin/resync-customers', { method: 'POST' })
      const data = await res.json()
      setResult(data)
      setState(data.error ? 'error' : 'done')
    } catch (err) {
      setResult({ error: String(err) })
      setState('error')
    }
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={run}
        disabled={state === 'running'}
        className="px-4 py-2 bg-slate-800 text-white text-sm rounded-md hover:bg-slate-700 disabled:opacity-50 transition-colors"
      >
        {state === 'running' ? 'Bezig met synchroniseren… (kan minuten duren)' : 'Volledige klantensync starten'}
      </button>
      {state === 'done' && result && (
        <p className="mt-3 text-sm text-green-700 font-medium">
          Klaar! {result.count} bestellingen verwerkt — alle gastklanten zijn nu toegevoegd.
        </p>
      )}
      {state === 'error' && result && (
        <p className="mt-3 text-sm text-red-600 font-medium">Fout: {result.error}</p>
      )}
      {state === 'running' && (
        <p className="mt-2 text-xs text-slate-400">
          Alle bestellingen worden opnieuw ingelezen vanaf 2015. Verlaat deze pagina niet.
        </p>
      )}
    </div>
  )
}
