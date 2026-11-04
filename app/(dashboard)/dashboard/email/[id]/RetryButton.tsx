'use client'

import { useState } from 'react'

export default function RetryButton({ campaignId, failedCount }: { campaignId: number; failedCount: number }) {
  const [state, setState] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [result, setResult] = useState<{ sent?: number; failed?: number; remaining?: number; error?: string } | null>(null)
  const [totalSent, setTotalSent] = useState(0)
  const [currentFailed, setCurrentFailed] = useState(failedCount)

  async function retry() {
    if (!confirm(`Weet je zeker dat je de ${currentFailed} mislukte mails opnieuw wil versturen? (max 200 per klik)`)) return
    setState('running')
    setResult(null)
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/retry`, { method: 'POST' })
      const data = await res.json()
      if (data.error) {
        setResult(data)
        setState('error')
      } else {
        setTotalSent((prev) => prev + (data.sent ?? 0))
        setCurrentFailed(data.remaining ?? 0)
        setResult(data)
        setState('done')
      }
    } catch (err) {
      setResult({ error: String(err) })
      setState('error')
    }
  }

  if (state === 'running') {
    return <span className="text-sm text-slate-500 italic">Bezig met versturen… (max 200, duurt ~30 sec)</span>
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        {currentFailed > 0 && (
          <button
            type="button"
            onClick={retry}
            className="px-4 py-2 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-700 transition-colors font-medium"
          >
            Opnieuw versturen ({currentFailed} mislukt)
          </button>
        )}
        {state === 'done' && result && (
          <span className="text-sm text-green-700 font-medium">
            {result.sent} verzonden{result.failed ? `, ${result.failed} mislukt` : ''}.
            {(result.remaining ?? 0) > 0 && (
              <> Nog <strong>{result.remaining}</strong> te gaan — klik opnieuw.</>
            )}
            {(result.remaining ?? 0) === 0 && totalSent > 0 && <> Klaar! Totaal {totalSent} verstuurd.</>}
          </span>
        )}
        {state === 'error' && result && (
          <span className="text-sm text-red-600 font-medium">Fout: {result.error}</span>
        )}
      </div>
    </div>
  )
}
