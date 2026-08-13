'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Template {
  id: number
  name: string
  subject: string
  bodyHtml: string
}

interface List {
  id: number
  name: string
  _count: { members: number }
}

interface SegmentInfo {
  type: string
  label: string
  description: string
}

const SEGMENTS: SegmentInfo[] = [
  { type: 'emmer_buyer', label: 'Emmer kopers', description: 'Klanten die een emmer hebben besteld' },
  { type: 'glaswerk_buyer', label: 'Glaswerk kopers', description: 'Klanten die aperol glas, bierglas, bierpul, champagneglas e.d. hebben besteld' },
  { type: 'gravering_buyer', label: 'Gravering kopers', description: 'Klanten die een product met gravering hebben besteld' },
  { type: 'klompen_logo_buyer', label: 'Klompen met logo/tekst kopers', description: 'Klanten die klompen met logo of tekst hebben besteld' },
  { type: 'tulp_buyer', label: 'Tulpen kopers', description: 'Klanten die tulpenpennen of andere tulpenproducten hebben besteld' },
  { type: 'cross_emmer_glaswerk', label: 'Emmer → Glaswerk upsell', description: 'Emmers gekocht, maar nog nooit glaswerk besteld' },
  { type: 'cross_glaswerk_emmer', label: 'Glaswerk → Emmer upsell', description: 'Glaswerk gekocht, maar nog nooit een emmer besteld' },
  { type: 'cross_logo_gravering', label: 'Logo/tekst → Gravering upsell', description: 'Logo of tekst product gekocht, maar nog nooit gravering besteld' },
  { type: 'cross_gravering_logo', label: 'Gravering → Logo klompen upsell', description: 'Gravering besteld, maar nog nooit logo/tekst product gekocht' },
  { type: 'logo_buyer', label: 'Logo / tekst kopers', description: 'Klanten die een logo of tekst product hebben besteld' },
  { type: 'repeat_buyer', label: 'Vaste klanten', description: 'Klanten met 2 of meer bestellingen' },
  { type: 'inactive_3m', label: 'Slapende klanten', description: 'Hebben 3+ maanden niets besteld — win ze terug' },
  { type: 'top_customers', label: 'Top klanten', description: 'Top 500 klanten op totale omzet' },
  { type: 'list', label: 'Handmatige lijst', description: 'Een zelf samengestelde lijst' },
]

export default function NewCampaignPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [name, setName] = useState('')
  const [templates, setTemplates] = useState<Template[]>([])
  const [lists, setLists] = useState<List[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [selectedSegment, setSelectedSegment] = useState<string>('')
  const [selectedList, setSelectedList] = useState<number | null>(null)
  const [previewHtml, setPreviewHtml] = useState('')
  const [recipientCount, setRecipientCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [campaignId, setCampaignId] = useState<number | null>(null)

  async function loadStep2() {
    setLoading(true)
    const [tRes, lRes] = await Promise.all([
      fetch('/api/email-templates'),
      fetch('/api/lists'),
    ])
    setTemplates(await tRes.json())
    setLists(await lRes.json())
    setLoading(false)
    setStep(2)
  }

  async function loadStep3() {
    if (!selectedTemplate || !selectedSegment) return
    setLoading(true)
    const params = new URLSearchParams({ segmentType: selectedSegment })
    if (selectedSegment === 'list' && selectedList) params.set('listId', String(selectedList))
    const res = await fetch(`/api/segments/count?${params}`)
    const { count, preview } = await res.json()
    setRecipientCount(count)
    setPreviewHtml(preview ?? selectedTemplate.bodyHtml)
    setLoading(false)
    setStep(3)
  }

  async function createAndSend() {
    if (!selectedTemplate || !selectedSegment) return
    setSending(true)
    const res = await fetch('/api/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        templateId: selectedTemplate.id,
        segmentType: selectedSegment,
        listId: selectedSegment === 'list' ? selectedList : null,
      }),
    })
    const campaign = await res.json()
    setCampaignId(campaign.id)

    const sendRes = await fetch(`/api/campaigns/${campaign.id}/send`, { method: 'POST' })
    const result = await sendRes.json()
    setSending(false)
    setStep(4)
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900">Nieuwe campagne</h2>
        {/* Progress */}
        <div className="flex items-center gap-2 mt-4">
          {['Naam', 'Sjabloon & doelgroep', 'Preview', 'Verzonden'].map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                ${step > i + 1 ? 'bg-green-500 text-white' : step === i + 1 ? 'bg-brand-600 text-white' : 'bg-slate-200 text-slate-400'}`}>
                {step > i + 1 ? '✓' : i + 1}
              </div>
              <span className={`text-sm ${step === i + 1 ? 'text-slate-900 font-medium' : 'text-slate-400'}`}>{s}</span>
              {i < 3 && <div className="w-8 h-px bg-slate-200" />}
            </div>
          ))}
        </div>
      </div>

      {/* Step 1: Name */}
      {step === 1 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-900 mb-4">Campagnenaam</h3>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Bijv. Herinnering logo klanten augustus"
            className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
          <button
            onClick={loadStep2}
            disabled={!name.trim()}
            className="mt-4 px-6 py-2.5 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-40"
          >
            Volgende →
          </button>
        </div>
      )}

      {/* Step 2: Template + Segment */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-900 mb-4">Kies een e-mailsjabloon</h3>
            {loading ? <p className="text-slate-400 text-sm">Laden...</p> : (
              <div className="space-y-2">
                {templates.map((t) => (
                  <label key={t.id} className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors
                    ${selectedTemplate?.id === t.id ? 'border-brand-400 bg-brand-50' : 'border-slate-200 hover:border-slate-300'}`}>
                    <input
                      type="radio"
                      name="template"
                      value={t.id}
                      checked={selectedTemplate?.id === t.id}
                      onChange={() => setSelectedTemplate(t)}
                      className="mt-0.5"
                    />
                    <div>
                      <p className="text-sm font-medium text-slate-900">{t.name}</p>
                      <p className="text-xs text-slate-400">{t.subject}</p>
                    </div>
                  </label>
                ))}
                {templates.length === 0 && (
                  <p className="text-slate-400 text-sm">Geen sjablonen. Maak er eerst een aan via Instellingen.</p>
                )}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-900 mb-4">Kies doelgroep</h3>
            <div className="space-y-2">
              {SEGMENTS.map((s) => (
                <label key={s.type} className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors
                  ${selectedSegment === s.type ? 'border-brand-400 bg-brand-50' : 'border-slate-200 hover:border-slate-300'}`}>
                  <input
                    type="radio"
                    name="segment"
                    value={s.type}
                    checked={selectedSegment === s.type}
                    onChange={() => { setSelectedSegment(s.type); setSelectedList(null) }}
                    className="mt-0.5"
                  />
                  <div>
                    <p className="text-sm font-medium text-slate-900">{s.label}</p>
                    <p className="text-xs text-slate-400">{s.description}</p>
                  </div>
                </label>
              ))}
            </div>

            {selectedSegment === 'list' && (
              <div className="mt-3 pl-6">
                <select
                  value={selectedList ?? ''}
                  onChange={(e) => setSelectedList(Number(e.target.value))}
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 w-full"
                >
                  <option value="">— Kies een lijst —</option>
                  {lists.map((l) => (
                    <option key={l.id} value={l.id}>{l.name} ({l._count.members} leden)</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
              ← Terug
            </button>
            <button
              onClick={loadStep3}
              disabled={!selectedTemplate || !selectedSegment || (selectedSegment === 'list' && !selectedList)}
              className="px-6 py-2.5 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-40"
            >
              Preview bekijken →
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Preview */}
      {step === 3 && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-900 mb-1">Samenvatting</h3>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex gap-2"><span className="text-slate-400 w-28">Campagne:</span><span className="text-slate-900 font-medium">{name}</span></div>
              <div className="flex gap-2"><span className="text-slate-400 w-28">Sjabloon:</span><span className="text-slate-700">{selectedTemplate?.name}</span></div>
              <div className="flex gap-2"><span className="text-slate-400 w-28">Onderwerp:</span><span className="text-slate-700">{selectedTemplate?.subject}</span></div>
              <div className="flex gap-2"><span className="text-slate-400 w-28">Doelgroep:</span><span className="text-slate-700">{SEGMENTS.find(s => s.type === selectedSegment)?.label}</span></div>
              {loading ? (
                <div className="flex gap-2"><span className="text-slate-400 w-28">Ontvangers:</span><span className="text-slate-400">Tellen...</span></div>
              ) : (
                <div className="flex gap-2"><span className="text-slate-400 w-28">Ontvangers:</span><span className="text-emerald-700 font-semibold">{recipientCount} personen</span></div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-900 mb-4">E-mail preview</h3>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <iframe
                srcDoc={previewHtml}
                className="w-full h-96"
                title="E-mail preview"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep(2)} className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
              ← Terug
            </button>
            <button
              onClick={createAndSend}
              disabled={sending || recipientCount === 0}
              className="px-6 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-40"
            >
              {sending ? 'Bezig met verzenden...' : `✉️ Verstuur naar ${recipientCount ?? '...'} personen`}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Done */}
      {step === 4 && (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
          <div className="text-5xl mb-4">✅</div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">Campagne verzonden!</h3>
          <p className="text-slate-500 text-sm mb-6">De e-mails zijn verstuurd via Mailtrap.</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => router.push('/dashboard/email')}
              className="px-5 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700"
            >
              Terug naar campagnes
            </button>
            {campaignId && (
              <button
                onClick={() => router.push(`/dashboard/email/${campaignId}`)}
                className="px-5 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50"
              >
                Bekijk resultaten
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
