'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatCurrency } from '@/lib/utils'

interface Row { month: string; amount: number }

export default function ShippingCostForm({ initial }: { initial: Row[] }) {
  const router = useRouter()
  const now = new Date()
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const [month, setMonth] = useState(defaultMonth)
  const [amount, setAmount] = useState('')
  const [rows, setRows] = useState<Row[]>(initial)
  const [state, setState] = useState<'idle' | 'saving' | 'done' | 'error'>('idle')
  const [msg, setMsg] = useState('')

  async function save() {
    const amt = parseFloat(amount)
    if (!month || isNaN(amt) || amt < 0) {
      setState('error'); setMsg('Vul een geldige maand en bedrag in'); return
    }
    setState('saving'); setMsg('')
    const res = await fetch('/api/shipping-costs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month, amount: amt }),
    })
    const data = await res.json()
    if (data.error) {
      setState('error'); setMsg(data.error)
    } else {
      setRows((prev) => {
        const rest = prev.filter((r) => r.month !== month)
        return [{ month, amount: amt }, ...rest].sort((a, b) => b.month.localeCompare(a.month))
      })
      setState('done'); setMsg('Opgeslagen')
      setAmount('')
      router.refresh()
    }
  }

  async function remove(m: string) {
    await fetch('/api/shipping-costs', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month: m }),
    })
    setRows((prev) => prev.filter((r) => r.month !== m))
    router.refresh()
  }

  function monthLabel(mk: string) {
    const [y, mo] = mk.split('-').map(Number)
    return new Date(y, mo - 1, 1).toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
      <h3 className="font-semibold text-slate-900 mb-1">Sendcloud verzendkosten per maand</h3>
      <p className="text-xs text-slate-400 mb-4">Voer het werkelijke Sendcloud factuurbedrag in. Dit vervangt de schatting per bestelling in alle margeberekeningen voor die maand.</p>

      <div className="flex gap-3 items-end mb-4">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Maand</label>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Factuurbedrag (€)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="16280"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-36 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <button
          type="button"
          onClick={save}
          disabled={state === 'saving'}
          className="px-5 py-2 bg-slate-700 text-white text-sm rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors font-medium"
        >
          {state === 'saving' ? 'Opslaan…' : 'Opslaan'}
        </button>
        {state === 'done' && <span className="text-sm text-green-700 font-medium">{msg}</span>}
        {state === 'error' && <span className="text-sm text-red-600">{msg}</span>}
      </div>

      {rows.length > 0 && (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left py-2 text-slate-500 font-medium">Maand</th>
              <th className="text-right py-2 text-slate-500 font-medium">Verzendkosten</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.month} className="border-b border-slate-50">
                <td className="py-2 text-slate-700">{monthLabel(r.month)}</td>
                <td className="py-2 text-right font-medium text-slate-900">{formatCurrency(r.amount)}</td>
                <td className="py-2 text-right">
                  <button
                    type="button"
                    onClick={() => remove(r.month)}
                    className="text-red-400 hover:text-red-600 text-xs"
                  >
                    Verwijder
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {rows.length === 0 && (
        <p className="text-xs text-slate-400">Nog geen maanden ingevoerd — schatting per bestelling wordt gebruikt.</p>
      )}
    </div>
  )
}
