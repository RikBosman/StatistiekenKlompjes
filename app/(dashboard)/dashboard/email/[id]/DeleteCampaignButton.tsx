'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function DeleteCampaignButton({ id }: { id: number }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    setLoading(true)
    await fetch(`/api/campaigns/${id}`, { method: 'DELETE' })
    router.push('/dashboard/email')
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-500">Zeker weten?</span>
        <button
          onClick={handleDelete}
          disabled={loading}
          className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50"
        >
          {loading ? 'Verwijderen...' : 'Ja, verwijder'}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="px-3 py-1.5 border border-slate-200 text-slate-600 text-sm rounded-lg hover:bg-slate-50"
        >
          Annuleer
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="px-3 py-1.5 border border-red-200 text-red-600 text-sm rounded-lg hover:bg-red-50"
    >
      Verwijder campagne
    </button>
  )
}
