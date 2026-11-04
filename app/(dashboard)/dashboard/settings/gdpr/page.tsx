'use client'

import { useState } from 'react'

export default function GdprPage() {
  const [emails, setEmails] = useState('')
  const [results, setResults] = useState<Array<{ email: string; ok: boolean; message: string }>>([])
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    const list = emails
      .split(/[\n,;]+/)
      .map((e) => e.trim())
      .filter(Boolean)

    if (list.length === 0) return
    if (!confirm(`Weet je zeker dat je ${list.length} klant(en) wil verwijderen? Dit kan niet ongedaan gemaakt worden.`)) return

    setLoading(true)
    setResults([])
    const newResults: typeof results = []

    for (const email of list) {
      const res = await fetch('/api/admin/delete-customer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      newResults.push({ email, ok: res.ok, message: data.message || data.error || 'Onbekende fout' })
      setResults([...newResults])
    }

    setLoading(false)
  }

  return (
    <div className="max-w-2xl mx-auto py-10 px-4">
      <h1 className="text-2xl font-bold text-slate-900 mb-2">AVG / GDPR — Klant verwijderen</h1>
      <p className="text-slate-600 mb-6 text-sm">
        Voer één of meerdere e-mailadressen in (komma of regel gescheiden). De klant wordt volledig verwijderd.
        Bestellingen blijven bewaard voor de statistieken maar zijn niet meer aan de klant gekoppeld.
      </p>

      <textarea
        className="w-full border border-slate-300 rounded-lg p-3 text-sm font-mono h-32 focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder="klant@example.com&#10;iemand@example.com"
        value={emails}
        onChange={(e) => setEmails(e.target.value)}
      />

      <button
        onClick={handleDelete}
        disabled={loading || !emails.trim()}
        className="mt-3 px-5 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
      >
        {loading ? 'Bezig…' : 'Verwijderen'}
      </button>

      {results.length > 0 && (
        <div className="mt-6 space-y-2">
          {results.map((r) => (
            <div
              key={r.email}
              className={`p-3 rounded-lg text-sm ${r.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}
            >
              <span className="font-medium">{r.email}</span> — {r.message}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
