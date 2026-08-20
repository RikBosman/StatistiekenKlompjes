'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Mode = 'incremental' | '30d'

export default function SyncOrdersButton() {
  const router = useRouter()
  const [state, setState] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [result, setResult] = useState<{ count?: number; error?: string } | null>(null)
  const [lastMode, setLastMode] = useState<Mode>('incremental')

  async function run(mode: Mode) {
    setState('running')
    setLastMode(mode)
    setResult(null)
    try {
      const body = mode === '30d' ? JSON.stringify({ days: 30 }) : undefined
      const res = await fetch('/api/admin/sync-orders', {
        method: 'POST',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body,
      })
      const data = await res.json()
      setResult(data)
      setState(data.ok === false || data.error ? 'error' : 'done')
      if (data.ok) router.refresh()
    } catch (err) {
      setResult({ error: String(err) })
      setState('error')
    }
  }

  const busy = state === 'running'

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => run('incremental')}
          disabled={busy}
          className="px-4 py-2 bg-slate-800 text-white text-sm rounded-md hover:bg-slate-700 disabled:opacity-50 transition-colors"
        >
          {busy && lastMode === 'incremental' ? 'Bezig…' : 'Nieuwe orders ophalen'}
        </button>
        <button
          type="button"
          onClick={() => run('30d')}
          disabled={busy}
          className="px-4 py-2 bg-slate-600 text-white text-sm rounded-md hover:bg-slate-700 disabled:opacity-50 transition-colors"
        >
          {busy && lastMode === '30d' ? 'Bezig…' : 'Afgelopen 30 dagen opnieuw laden'}
        </button>
      </div>

      {state === 'done' && result && (
        <p className="text-sm text-green-700 font-medium">
          Klaar! {result.count} bestelling{result.count === 1 ? '' : 'en'} verwerkt
          {lastMode === '30d' ? ' (afgelopen 30 dagen)' : ''}.
        </p>
      )}
      {state === 'error' && result && (
        <p className="text-sm text-red-600 font-medium">Fout: {result.error}</p>
      )}
      {busy && (
        <p className="text-xs text-slate-400">Bestellingen worden opgehaald vanuit WooCommerce. Verlaat deze pagina niet.</p>
      )}
    </div>
  )
}
