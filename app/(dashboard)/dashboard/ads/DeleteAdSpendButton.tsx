'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DeleteAdSpendButton({ id }: { id: number }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function remove() {
    if (!confirm('Verwijder deze dag?')) return
    setLoading(true)
    await fetch('/api/ad-spend', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    router.refresh()
  }

  return (
    <button
      type="button"
      onClick={remove}
      disabled={loading}
      className="text-red-400 hover:text-red-600 text-xs disabled:opacity-40"
    >
      Verwijder
    </button>
  )
}
