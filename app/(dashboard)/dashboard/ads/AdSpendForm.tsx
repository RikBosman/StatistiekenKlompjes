'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AdSpendForm() {
  const router = useRouter()
  const today = new Date().toISOString().slice(0, 10)
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)

  const [startDate, setStartDate] = useState(firstOfMonth)
  const [endDate, setEndDate] = useState(today)
  const [spend, setSpend] = useState('410')
  const [campaign, setCampaign] = useState('Google Ads')
  const [state, setState] = useState<'idle' | 'saving' | 'done' | 'error'>('idle')
  const [msg, setMsg] = useState('')

  async function save() {
    setState('saving')
    setMsg('')
    try {
      const res = await fetch('/api/ad-spend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate,
          endDate,
          spend: parseFloat(spend),
          campaign,
          campaignId: campaign.toLowerCase().replace(/\s+/g, '-'),
        }),
      })
      const data = await res.json()
      if (data.error) {
        setMsg(data.error)
        setState('error')
      } else {
        setMsg(`${data.saved} dagen opgeslagen`)
        setState('done')
        router.refresh()
      }
    } catch (err) {
      setMsg(String(err))
      setState('error')
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
      <h3 className="font-semibold text-slate-900 mb-4">Advertentiekosten invoeren</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Startdatum</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Einddatum</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Bedrag per dag (€)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={spend}
            onChange={(e) => setSpend(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Campagnenaam</label>
          <input
            type="text"
            value={campaign}
            onChange={(e) => setCampaign(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={save}
          disabled={state === 'saving'}
          className="px-5 py-2 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors font-medium"
        >
          {state === 'saving' ? 'Opslaan…' : 'Opslaan voor periode'}
        </button>
        {state === 'done' && <span className="text-sm text-green-700 font-medium">{msg}</span>}
        {state === 'error' && <span className="text-sm text-red-600">{msg}</span>}
      </div>
      <p className="text-xs text-slate-400 mt-3">
        Bestaande bedragen voor dezelfde dag worden overschreven. Voer de periode in en het vaste dagbedrag.
      </p>
    </div>
  )
}
