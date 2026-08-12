'use client'

import { useState } from 'react'

export default function RetryButton({ campaignId, failedCount }: { campaignId: number; failedCount: number }) {
  const [state, setState] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [result, setResult] = useState<{ sent?: number; failed?: number; error?: string } | null>(null)

  async function retry() {
    if (!confirm(`Weet je zeker dat je de ${failedCount} mislukte mails opnieuw wil versturen?`)) return
    setState('running')
    setResult(null)
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/retry`, { method: 'POST' })
      const data = await res.json()
      setResult(data)
      setState(data.error ? 'error' : 'done')
    } catch (err) {
      setResult({ error: String(err) })
      setState('error')
    }
  }

  if (state === 'running') {
    return <span className="text-sm text-slate-500 italic">Bezig met versturen…</span>
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={retry}
        className="px-4 py-2 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-700 transition-colors font-medium"
      >
        Opnieuw versturen ({failedCount} mislukt)
      </button>
      {state === 'done' && result && (
        <span className="text-sm text-green-700 font-medium">
          Klaar! {result.sent} verzonden{result.failed ? `, ${result.failed} mislukt` : ''}.
        </span>
      )}
      {state === 'error' && result && (
        <span className="text-sm text-red-600 font-medium">Fout: {result.error}</span>
      )}
    </div>
  )
}
