'use client'

import { useState } from 'react'

interface Template {
  id: number
  name: string
  subject: string
  bodyHtml: string
}

interface Props {
  template: Template | null
}

export default function EmailTemplateForm({ template }: Props) {
  const [name, setName] = useState(template?.name || 'Logo/Tekst Herinnering')
  const [subject, setSubject] = useState(template?.subject || 'Tijd voor een nieuw logo of tekst product?')
  const [bodyHtml, setBodyHtml] = useState(template?.bodyHtml || defaultTemplate)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage('')

    try {
      const res = await fetch('/api/email-templates', {
        method: template ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: template?.id, name, subject, bodyHtml, isDefault: true }),
      })
      if (res.ok) {
        setMessage('Template opgeslagen!')
      } else {
        const d = await res.json()
        setMessage(`Fout: ${d.error || 'Onbekend'}`)
      }
    } catch {
      setMessage('Netwerkfout')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Naam</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Onderwerp</label>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          required
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-slate-700">E-mailtekst (HTML)</label>
          <div className="flex gap-1">
            {(['edit', 'preview'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  activeTab === tab
                    ? 'bg-brand-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab === 'edit' ? 'Bewerken' : 'Voorbeeld'}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'edit' ? (
          <textarea
            value={bodyHtml}
            onChange={(e) => setBodyHtml(e.target.value)}
            rows={18}
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
            required
          />
        ) : (
          <div
            className="w-full border border-slate-300 rounded-md p-4 min-h-64 bg-white text-sm overflow-auto"
            dangerouslySetInnerHTML={{
              __html: bodyHtml
                .replace(/\{\{first_name\}\}/g, 'Jan')
                .replace(/\{\{name\}\}/g, 'Jan de Vries')
                .replace(/\{\{email\}\}/g, 'jan@example.com'),
            }}
          />
        )}
      </div>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2 bg-brand-600 text-white text-sm rounded-md hover:bg-brand-700 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Opslaan...' : 'Opslaan'}
        </button>
        {message && (
          <p className={`text-sm ${message.startsWith('Fout') ? 'text-red-600' : 'text-green-600'}`}>
            {message}
          </p>
        )}
      </div>
    </form>
  )
}

const defaultTemplate = `<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <h2>Hoi {{first_name}},</h2>
  <p>
    Het is alweer een tijdje geleden dat je bij ons een logo of tekst product hebt besteld.
    Misschien is het tijd voor een nieuwe ronde?
  </p>
  <p>
    We hebben onze collectie uitgebreid en we denken dat je er iets leuks bij kunt vinden.
  </p>
  <p style="margin: 30px 0;">
    <a href="#" style="background: #0e8ee7; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
      Bekijk ons assortiment
    </a>
  </p>
  <p>Met vriendelijke groet,<br>Het team</p>
</body>
</html>`
