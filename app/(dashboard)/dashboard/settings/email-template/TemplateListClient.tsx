'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Template {
  id: number
  name: string
  subject: string
  isDefault: boolean
  updatedAt: Date
}

export default function TemplateListClient({ templates }: { templates: Template[] }) {
  const router = useRouter()
  const [deleting, setDeleting] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete(id: number) {
    setDeleting(id)
    setError(null)
    const res = await fetch(`/api/email-templates?id=${id}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Fout bij verwijderen')
      setDeleting(null)
      return
    }
    router.refresh()
    setDeleting(null)
  }

  if (templates.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400 text-sm">
        Nog geen sjablonen aangemaakt.{' '}
        <a href="/dashboard/settings/email-template/new" className="text-brand-600 hover:underline">
          Maak je eerste sjabloon
        </a>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm">{error}</div>
      )}
      {templates.map((t) => (
        <div
          key={t.id}
          className="bg-white rounded-xl border border-slate-200 p-5 flex items-center justify-between gap-4"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-slate-900 truncate">{t.name}</span>
              {t.isDefault && (
                <span className="px-2 py-0.5 rounded-full text-xs bg-brand-100 text-brand-700 font-medium flex-shrink-0">
                  Standaard
                </span>
              )}
            </div>
            <p className="text-sm text-slate-400 truncate mt-0.5">{t.subject}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <a
              href={`/dashboard/settings/email-template/${t.id}`}
              className="px-3 py-1.5 border border-slate-200 text-slate-700 text-sm rounded-lg hover:bg-slate-50 transition-colors"
            >
              Bewerken
            </a>
            <button
              onClick={() => handleDelete(t.id)}
              disabled={deleting === t.id}
              className="px-3 py-1.5 border border-red-200 text-red-600 text-sm rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              {deleting === t.id ? '...' : 'Verwijder'}
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
