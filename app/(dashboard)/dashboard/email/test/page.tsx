'use client'

import { useState, useEffect } from 'react'

interface Template {
  id: number
  name: string
  subject: string
}

export default function TestEmailPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loaded, setLoaded] = useState(false)
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | ''>('')
  const [emailInput, setEmailInput] = useState('')
  const [sending, setSending] = useState(false)
  const [results, setResults] = useState<{ email: string; ok: boolean; error?: string }[] | null>(null)

  useEffect(() => {
    fetch('/api/email-templates')
      .then((r) => r.json())
      .then((data) => { setTemplates(data); setLoaded(true) })
  }, [])

  async function send() {
    if (!selectedTemplateId || !emailInput.trim()) return
    setSending(true)
    setResults(null)
    const emails = emailInput.split(/[,\n]/).map((e) => e.trim()).filter(Boolean)
    const res = await fetch('/api/email/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emails, templateId: selectedTemplateId }),
    })
    const data = await res.json()
    setResults(data.results)
    setSending(false)
  }

  return (
    <div className="p-8 max-w-xl">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900">Test e-mail versturen</h2>
        <p className="text-slate-500 text-sm mt-1">Stuur een testmail naar jezelf of een collega om de Resend-configuratie te testen.</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Sjabloon</label>
          <select
            value={selectedTemplateId}
            onChange={(e) => setSelectedTemplateId(Number(e.target.value))}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
          >
            <option value="">— Kies een sjabloon —</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.name} — {t.subject}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            E-mailadressen <span className="text-slate-400 font-normal">(komma of enter gescheiden)</span>
          </label>
          <textarea
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            placeholder="info@klompjes.com, collega@klompjes.com"
            rows={3}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
          />
        </div>

        <button
          onClick={send}
          disabled={sending || !selectedTemplateId || !emailInput.trim()}
          className="w-full py-2.5 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-40 transition-colors"
        >
          {sending ? 'Versturen...' : 'Stuur testmail'}
        </button>

        {results && (
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <p className="text-sm font-medium text-slate-700">Resultaat:</p>
            {results.map((r) => (
              <div key={r.email} className={`flex items-start gap-2 text-sm rounded-lg px-3 py-2 ${r.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                <span className="mt-0.5">{r.ok ? '✓' : '✗'}</span>
                <div>
                  <span className="font-medium">{r.email}</span>
                  {r.error && <p className="text-xs mt-0.5 opacity-80">{r.error}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
