'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

const MONTHS_NL = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december']

interface ParsedResult {
  filename: string
  year: number | null
  month: number | null
  amountExclBtw: number | null
  textSnippet: string
}

export default function ShippingPdfImport() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [parsing, setParsing] = useState(false)
  const [parsed, setParsed] = useState<ParsedResult | null>(null)
  const [year, setYear] = useState('')
  const [month, setMonth] = useState('')
  const [amount, setAmount] = useState('')
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'done' | 'error'>('idle')
  const [parseError, setParseError] = useState('')

  async function handleFile(file: File) {
    setParsing(true)
    setParsed(null)
    setParseError('')
    setSaveState('idle')
    const form = new FormData()
    form.append('file', file)
    try {
      const res = await fetch('/api/shipping/import-pdf', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok || data.error) { setParseError(data.error ?? 'Parseren mislukt'); setParsing(false); return }
      setParsed(data)
      setYear(String(data.year ?? new Date().getFullYear()))
      setMonth(String(data.month ?? ''))
      setAmount(data.amountExclBtw != null ? String(data.amountExclBtw) : '')
    } catch (e) {
      setParseError(String(e))
    }
    setParsing(false)
  }

  async function save() {
    const y = parseInt(year)
    const m = parseInt(month)
    const a = parseFloat(amount)
    if (!y || !m || isNaN(a) || a <= 0) return
    setSaveState('saving')
    const res = await fetch('/api/shipping/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year: y, month: m, amountExclBtw: a, filename: parsed?.filename }),
    })
    const data = await res.json()
    setSaveState(data.ok ? 'done' : 'error')
    if (data.ok) { setParsed(null); router.refresh() }
  }

  return (
    <div className="space-y-4">
      <div
        className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center cursor-pointer hover:border-brand-400 transition-colors"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }}
        />
        {parsing ? (
          <p className="text-slate-500 text-sm">PDF wordt uitgelezen…</p>
        ) : (
          <>
            <p className="text-slate-500 text-sm">Sleep een SendCloud factuur PDF hierheen of klik om te kiezen</p>
            <p className="text-slate-400 text-xs mt-1">Maandfactuur van SendCloud — subtotaal excl. BTW wordt automatisch uitgelezen</p>
          </>
        )}
      </div>

      {parseError && <p className="text-red-600 text-sm">{parseError}</p>}

      {parsed && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
          <p className="text-sm font-semibold text-slate-700">Uitgelezen uit: <span className="font-normal text-slate-500">{parsed.filename}</span></p>

          {(!parsed.year || !parsed.month || !parsed.amountExclBtw) && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
              Niet alles kon automatisch worden uitgelezen. Vul de ontbrekende velden zelf in.
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Jaar</label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="2025"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Maand</label>
              <select
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">— kies —</option>
                {MONTHS_NL.map((n, i) => (
                  <option key={i + 1} value={i + 1}>{n}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Subtotaal excl. BTW (€)</label>
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={save}
              disabled={saveState === 'saving' || !year || !month || !amount}
              className="px-5 py-2 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors font-medium"
            >
              {saveState === 'saving' ? 'Opslaan…' : 'Opslaan'}
            </button>
            <button
              onClick={() => setParsed(null)}
              className="px-4 py-2 text-slate-500 text-sm rounded-lg hover:bg-slate-100 transition-colors"
            >
              Annuleren
            </button>
            {saveState === 'error' && <span className="text-red-600 text-sm">Opslaan mislukt</span>}
          </div>

          {parsed.textSnippet && (
            <details className="text-xs text-slate-400">
              <summary className="cursor-pointer hover:text-slate-600">Ruwe PDF-tekst (voor controle)</summary>
              <pre className="mt-2 whitespace-pre-wrap bg-white border border-slate-100 rounded p-3 max-h-40 overflow-auto">{parsed.textSnippet}</pre>
            </details>
          )}
        </div>
      )}
    </div>
  )
}
