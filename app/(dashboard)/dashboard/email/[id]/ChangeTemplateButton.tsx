'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Template { id: number; name: string }

export default function ChangeTemplateButton({
  campaignId,
  currentTemplateId,
  templates,
}: {
  campaignId: number
  currentTemplateId: number
  templates: Template[]
}) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState(currentTemplateId)
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  async function save() {
    if (selected === currentTemplateId) { setOpen(false); return }
    setSaving(true)
    await fetch(`/api/campaigns/${campaignId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ templateId: selected }),
    })
    setSaving(false)
    setOpen(false)
    router.refresh()
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-blue-600 hover:underline"
      >
        Wijzigen
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={selected}
        onChange={(e) => setSelected(Number(e.target.value))}
        className="text-sm border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {templates.map((t) => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </select>
      <button
        onClick={save}
        disabled={saving}
        className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? 'Opslaan…' : 'Opslaan'}
      </button>
      <button onClick={() => setOpen(false)} className="text-xs text-slate-400 hover:text-slate-600">Annuleren</button>
    </div>
  )
}
