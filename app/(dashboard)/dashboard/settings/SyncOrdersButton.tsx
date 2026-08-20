'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function SyncOrdersButton() {
  const router = useRouter()
  const [state, setState] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [result, setResult] = useState<{ count?: number; error?: string } | null>(null)

  async function run() {
    setState('running')
    setResult(null)
    try {
      const res = await fetch('/api/admin/sync-orders', { method: 'POST' })
      const data = await res.json()
      setResult(data)
      setState(data.ok === false || data.error ? 'error' : 'done')
      if (data.ok) router.refresh()
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
        {state === 'running' ? 'Bezig met synchroniseren…' : 'Orders nu synchroniseren'}
      </button>
      {state === 'done' && result && (
        <p className="mt-3 text-sm text-green-700 font-medium">
          Klaar! {result.count} nieuwe bestelling{result.count === 1 ? '' : 'en'} opgehaald.
        </p>
      )}
      {state === 'error' && result && (
        <p className="mt-3 text-sm text-red-600 font-medium">Fout: {result.error}</p>
      )}
      {state === 'running' && (
        <p className="mt-2 text-xs text-slate-400">Nieuwe bestellingen worden opgehaald vanuit WooCommerce. Verlaat deze pagina niet.</p>
      )}
    </div>
  )
}
