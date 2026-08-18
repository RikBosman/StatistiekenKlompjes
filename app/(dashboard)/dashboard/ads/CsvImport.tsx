'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function CsvImport() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle')
  const [msg, setMsg] = useState('')

  async function upload(file: File) {
    setState('uploading')
    setMsg('')
    const form = new FormData()
    form.append('file', file)
    try {
      const res = await fetch('/api/ads/import-csv', { method: 'POST', body: form })
      const data = await res.json()
      if (data.ok) {
        setState('done')
        setMsg(`${data.rows} rijen geïmporteerd`)
        router.refresh()
      } else {
        setState('error')
        setMsg(data.error ?? 'Onbekende fout')
      }
    } catch (e) {
      setState('error')
      setMsg(String(e))
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <h3 className="font-semibold text-slate-900 mb-1">Google Ads CSV importeren</h3>
      <p className="text-xs text-slate-400 mb-1">
        Exporteer in Google Ads een dagrapport met kolommen <strong>Dag</strong> en <strong>Kosten</strong> (optioneel Campagne, Klikken, Vertoningen).
        Download als CSV en upload hier.
      </p>
      <p className="text-xs text-slate-400 mb-5">
        Pad in Google Ads: Campagnes → Rapporten → Tabel exporteren als CSV
      </p>
      <div
        className="border-2 border-dashed border-slate-200 rounded-lg p-8 text-center cursor-pointer hover:border-brand-400 transition-colors"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) upload(f) }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f) }}
        />
        {state === 'uploading' ? (
          <p className="text-slate-500 text-sm">Bezig met importeren…</p>
        ) : (
          <>
            <p className="text-slate-500 text-sm">Sleep een CSV hierheen of klik om te kiezen</p>
            <p className="text-slate-400 text-xs mt-1">.csv bestanden</p>
          </>
        )}
      </div>
      {state === 'done' && <p className="text-green-700 text-sm mt-3 font-medium">✓ {msg}</p>}
      {state === 'error' && <p className="text-red-600 text-sm mt-3">{msg}</p>}
    </div>
  )
}
