'use client'

import { useState, useMemo, useCallback } from 'react'

interface Product {
  id: number
  name: string
  imageUrl: string | null
  price: number | null
  permalink: string | null
  sku: string | null
}

interface TemplateData {
  id?: number
  name: string
  subject: string
  bodyHtml: string
  bodyJson: string
}

interface BuilderConfig {
  logoUrl: string
  shopUrl: string
  headerBg: string
  buttonBg: string
  introText: string
  featuredProductId: number | null
  gridProductIds: number[]
  ctaText: string
  ctaUrl: string
  footerText: string
}

const DEFAULT_CONFIG: BuilderConfig = {
  logoUrl: '',
  shopUrl: 'https://klompjes.com',
  headerBg: '#1e3a5f',
  buttonBg: '#f97316',
  introText: 'Hoi {{first_name}},\n\nBedankt voor je interesse! We hebben een aantal mooie producten voor je geselecteerd.',
  featuredProductId: null,
  gridProductIds: [],
  ctaText: 'Bekijk ons assortiment',
  ctaUrl: 'https://klompjes.com',
  footerText: 'Je ontvangt deze e-mail omdat je eerder een bestelling hebt geplaatst bij Klompjes.\n\nKlompjes | klompjes.com',
}

function fmtPrice(p: number | null): string {
  if (p == null) return ''
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(p)
}

function generateHtml(cfg: BuilderConfig, products: Product[], subject: string): string {
  const getProduct = (id: number) => products.find((p) => p.id === id)

  const featured = cfg.featuredProductId ? getProduct(cfg.featuredProductId) : null
  const gridProducts = cfg.gridProductIds
    .map((id) => getProduct(id))
    .filter(Boolean) as Product[]

  const placeholder = `<div style="width:100%;height:130px;background:#e2e8f0;border-radius:6px;margin:0 auto;"></div>`

  const productCell = (p: Product) => `
    <td style="width:25%;padding:8px;vertical-align:top;text-align:center;">
      <a href="${p.permalink || cfg.shopUrl}" style="text-decoration:none;">
        ${p.imageUrl
          ? `<img src="${p.imageUrl}" alt="${p.name}" style="width:100%;max-width:130px;height:130px;object-fit:cover;border-radius:6px;display:block;margin:0 auto;" />`
          : placeholder}
        <p style="font-size:12px;font-weight:600;color:#1e293b;margin:8px 0 4px;line-height:1.3;">${p.name}</p>
        ${p.price != null ? `<p style="font-size:13px;color:#059669;font-weight:700;margin:0 0 8px;">${fmtPrice(p.price)}</p>` : '<p style="margin:0 0 8px;"> </p>'}
      </a>
      <a href="${p.permalink || cfg.shopUrl}" style="font-size:12px;background:${cfg.buttonBg};color:white;padding:6px 14px;border-radius:4px;text-decoration:none;display:inline-block;">Bestellen →</a>
    </td>`

  const gridRows: string[] = []
  for (let i = 0; i < gridProducts.length; i += 4) {
    const row = gridProducts.slice(i, i + 4)
    while (row.length < 4) row.push(null as unknown as Product)
    gridRows.push(`<tr>${row.map((p) => (p ? productCell(p) : '<td style="width:25%;padding:8px;"></td>')).join('')}</tr>`)
  }

  const introLines = cfg.introText
    .split('\n')
    .map((l) => (l.trim() ? `<p style="margin:0 0 12px;color:#374151;font-size:15px;line-height:1.6;">${l}</p>` : ''))
    .join('')

  const footerLines = cfg.footerText
    .split('\n')
    .map((l) => (l.trim() ? `<p style="margin:0 0 6px;color:#6b7280;font-size:12px;line-height:1.5;">${l}</p>` : ''))
    .join('')

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;padding:20px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 6px rgba(0,0,0,0.08);">

  <!-- Header -->
  <tr>
    <td style="background:${cfg.headerBg};padding:24px 32px;">
      ${cfg.logoUrl
        ? `<img src="${cfg.logoUrl}" alt="Logo" style="max-height:52px;max-width:200px;display:block;" />`
        : `<p style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.5px;">Klompjes</p>`}
    </td>
  </tr>

  <!-- Intro -->
  <tr>
    <td style="padding:32px 32px 24px;">
      ${introLines}
    </td>
  </tr>

  ${featured ? `
  <!-- Featured product -->
  <tr>
    <td style="padding:0 32px 32px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;border-radius:10px;overflow:hidden;">
        <tr>
          ${featured.imageUrl
            ? `<td style="width:44%;vertical-align:middle;padding:0;">
                <a href="${featured.permalink || cfg.shopUrl}">
                  <img src="${featured.imageUrl}" alt="${featured.name}" style="width:100%;height:230px;object-fit:cover;display:block;" />
                </a>
               </td>`
            : ''}
          <td style="padding:24px 24px;vertical-align:middle;">
            <p style="margin:0 0 6px;font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:#6b7280;font-weight:700;">⭐ Uitgelicht</p>
            <h2 style="margin:0 0 12px;color:#111827;font-size:19px;font-weight:700;line-height:1.3;">${featured.name}</h2>
            ${featured.price != null ? `<p style="margin:0 0 18px;font-size:24px;color:#059669;font-weight:700;">${fmtPrice(featured.price)}</p>` : ''}
            <a href="${featured.permalink || cfg.shopUrl}" style="background:${cfg.buttonBg};color:white;padding:11px 22px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:600;display:inline-block;">Bekijken →</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  ` : ''}

  ${gridProducts.length > 0 ? `
  <!-- Product grid -->
  <tr>
    <td style="padding:0 24px 8px;">
      <p style="margin:0 0 16px;font-size:16px;font-weight:700;color:#111827;border-top:1px solid #f1f5f9;padding-top:24px;">Meer uit ons assortiment</p>
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        ${gridRows.join('')}
      </table>
    </td>
  </tr>
  ` : ''}

  ${cfg.ctaText ? `
  <!-- CTA button -->
  <tr>
    <td style="padding:24px 32px;text-align:center;">
      <a href="${cfg.ctaUrl}" style="background:${cfg.headerBg};color:#ffffff;padding:14px 36px;border-radius:8px;text-decoration:none;font-size:15px;font-weight:600;display:inline-block;">${cfg.ctaText}</a>
    </td>
  </tr>
  ` : ''}

  <!-- Footer -->
  <tr>
    <td style="background:#f1f5f9;padding:24px 32px;border-top:1px solid #e2e8f0;">
      ${footerLines}
      <p style="margin:12px 0 0;color:#9ca3af;font-size:11px;">
        <a href="${cfg.shopUrl}" style="color:#9ca3af;text-decoration:none;">${cfg.shopUrl}</a>
      </p>
      <p style="margin:10px 0 0;color:#9ca3af;font-size:11px;">
        Wil je geen e-mails meer ontvangen?
        <a href="{{unsubscribe_url}}" style="color:#9ca3af;text-decoration:underline;">Klik hier om je uit te schrijven</a>
      </p>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>`
}

const inputCls = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <h4 className="font-semibold text-slate-800 text-sm mb-4">{title}</h4>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      {label && <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>}
      {children}
    </div>
  )
}

export default function EmailTemplateBuilder({
  template,
  products,
}: {
  template: TemplateData | null
  products: Product[]
}) {
  const initialConfig = useMemo((): BuilderConfig => {
    if (template?.bodyJson && template.bodyJson !== '{}') {
      try {
        return { ...DEFAULT_CONFIG, ...JSON.parse(template.bodyJson) }
      } catch {}
    }
    return DEFAULT_CONFIG
  }, [template])

  const [name, setName] = useState(template?.name || 'Nieuw sjabloon')
  const [subject, setSubject] = useState(template?.subject || '')
  const [cfg, setCfg] = useState<BuilderConfig>(initialConfig)
  const [featuredSearch, setFeaturedSearch] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [tab, setTab] = useState<'builder' | 'preview' | 'html'>('builder')

  const update = useCallback((patch: Partial<BuilderConfig>) => {
    setCfg((prev) => ({ ...prev, ...patch }))
  }, [])

  const filteredFeatured = useMemo(() => {
    const q = featuredSearch.toLowerCase()
    return products.filter(
      (p) =>
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.sku ?? '').toLowerCase().includes(q)
    )
  }, [products, featuredSearch])

  const filteredProducts = useMemo(() => {
    const q = productSearch.toLowerCase()
    return products.filter(
      (p) =>
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.sku ?? '').toLowerCase().includes(q)
    )
  }, [products, productSearch])

  const generatedHtml = useMemo(
    () => generateHtml(cfg, products, subject),
    [cfg, products, subject]
  )

  const previewHtml = useMemo(
    () =>
      generatedHtml
        .replace(/\{\{first_name\}\}/g, 'Jan')
        .replace(/\{\{name\}\}/g, 'Jan de Vries')
        .replace(/\{\{email\}\}/g, 'jan@example.com'),
    [generatedHtml]
  )

  const toggleGrid = (id: number) => {
    if (cfg.gridProductIds.includes(id)) {
      update({ gridProductIds: cfg.gridProductIds.filter((x) => x !== id) })
    } else if (cfg.gridProductIds.length < 8) {
      update({ gridProductIds: [...cfg.gridProductIds, id] })
    }
  }

  async function save() {
    setSaving(true)
    setMessage('')
    try {
      const res = await fetch('/api/email-templates', {
        method: template?.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: template?.id,
          name,
          subject: subject || 'Bericht van Klompjes',
          bodyHtml: generatedHtml,
          bodyJson: JSON.stringify(cfg),
          isDefault: true,
        }),
      })
      if (res.ok) {
        setMessage('Sjabloon opgeslagen!')
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
    <div className="flex flex-col gap-5">
      {/* Name + subject */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Naam sjabloon</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Onderwerp e-mail</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Bijv: Tijd voor een nieuw logo product?"
            className={inputCls}
          />
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
        {(['builder', 'preview', 'html'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === t
                ? 'bg-white shadow-sm text-slate-900'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t === 'builder' ? 'Opbouwen' : t === 'preview' ? 'Voorbeeld' : 'HTML code'}
          </button>
        ))}
      </div>

      {tab === 'builder' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
          {/* Left: config panels */}
          <div className="space-y-4">
            <Section title="Header & branding">
              <Field label="Logo URL (optioneel)">
                <input
                  type="url"
                  value={cfg.logoUrl}
                  onChange={(e) => update({ logoUrl: e.target.value })}
                  placeholder="https://klompjes.com/logo.png"
                  className={inputCls}
                />
              </Field>
              <Field label="Webshop URL">
                <input
                  type="url"
                  value={cfg.shopUrl}
                  onChange={(e) => update({ shopUrl: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label="Achtergrondkleur header">
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={cfg.headerBg}
                    onChange={(e) => update({ headerBg: e.target.value })}
                    className="h-9 w-14 rounded border border-slate-200 cursor-pointer p-0.5 bg-white"
                  />
                  <input
                    type="text"
                    value={cfg.headerBg}
                    onChange={(e) => update({ headerBg: e.target.value })}
                    className={`${inputCls} font-mono`}
                  />
                </div>
              </Field>
              <Field label="Kleur knoppen (bestellen / bekijken)">
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={cfg.buttonBg}
                    onChange={(e) => update({ buttonBg: e.target.value })}
                    className="h-9 w-14 rounded border border-slate-200 cursor-pointer p-0.5 bg-white"
                  />
                  <input
                    type="text"
                    value={cfg.buttonBg}
                    onChange={(e) => update({ buttonBg: e.target.value })}
                    className={`${inputCls} font-mono`}
                  />
                </div>
              </Field>
            </Section>

            <Section title="Introductietekst">
              <Field label="">
                <textarea
                  value={cfg.introText}
                  onChange={(e) => update({ introText: e.target.value })}
                  rows={5}
                  className={`${inputCls} resize-none`}
                />
                <p className="text-xs text-slate-400 mt-1.5">
                  Variabelen: <code className="bg-slate-100 px-1 rounded">{'{{first_name}}'}</code>{' '}
                  <code className="bg-slate-100 px-1 rounded">{'{{name}}'}</code>
                </p>
              </Field>
            </Section>

            <Section title="Uitgelicht product">
              <p className="text-xs text-slate-400 -mt-1">
                Één product dat groot wordt uitgelicht met foto en prijs
              </p>
              <input
                type="text"
                value={featuredSearch}
                onChange={(e) => setFeaturedSearch(e.target.value)}
                placeholder="Zoek op naam of SKU..."
                className={inputCls}
              />
              <div className="max-h-52 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-50">
                {!featuredSearch && (
                  <label className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 cursor-pointer">
                    <input
                      type="radio"
                      name="featured"
                      checked={cfg.featuredProductId === null}
                      onChange={() => update({ featuredProductId: null })}
                    />
                    <span className="text-sm text-slate-400 italic">Geen uitgelicht product</span>
                  </label>
                )}
                {filteredFeatured.length === 0 && (
                  <p className="px-3 py-4 text-sm text-slate-400 text-center">Geen producten gevonden</p>
                )}
                {filteredFeatured.map((p) => (
                  <label
                    key={p.id}
                    className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 cursor-pointer"
                  >
                    <input
                      type="radio"
                      name="featured"
                      checked={cfg.featuredProductId === p.id}
                      onChange={() => update({ featuredProductId: p.id })}
                    />
                    {p.imageUrl ? (
                      <img
                        src={p.imageUrl}
                        alt=""
                        className="w-9 h-9 rounded object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded bg-slate-100 flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{p.name}</p>
                      {p.price != null && (
                        <p className="text-xs text-green-600 font-medium">{fmtPrice(p.price)}</p>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </Section>

            <Section title={`Productgrid — ${cfg.gridProductIds.length} / 8 geselecteerd`}>
              <p className="text-xs text-slate-400 -mt-1">
                Kies maximaal 8 producten — getoond in 4 kolommen per rij
              </p>
              <input
                type="text"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Zoek op naam of SKU..."
                className={inputCls}
              />
              <div className="max-h-52 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-50">
                {filteredProducts.length === 0 && (
                  <p className="px-3 py-4 text-sm text-slate-400 text-center">Geen producten gevonden</p>
                )}
                {filteredProducts.map((p) => {
                  const selected = cfg.gridProductIds.includes(p.id)
                  const full = !selected && cfg.gridProductIds.length >= 8
                  return (
                    <label
                      key={p.id}
                      className={`flex items-center gap-3 px-3 py-2 hover:bg-slate-50 cursor-pointer ${
                        full ? 'opacity-40 cursor-not-allowed' : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        disabled={full}
                        onChange={() => toggleGrid(p.id)}
                      />
                      {p.imageUrl ? (
                        <img
                          src={p.imageUrl}
                          alt=""
                          className="w-9 h-9 rounded object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded bg-slate-100 flex-shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-800 truncate">{p.name}</p>
                        <p className="text-xs text-slate-400">
                          {p.sku && <span className="font-mono mr-2">{p.sku}</span>}
                          {p.price != null && (
                            <span className="text-green-600 font-medium">{fmtPrice(p.price)}</span>
                          )}
                        </p>
                      </div>
                    </label>
                  )
                })}
              </div>
              {cfg.gridProductIds.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {cfg.gridProductIds.map((id) => {
                    const p = products.find((x) => x.id === id)
                    if (!p) return null
                    return (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1 bg-brand-50 text-brand-700 text-xs px-2 py-0.5 rounded-full"
                      >
                        {p.name.length > 24 ? p.name.slice(0, 24) + '…' : p.name}
                        <button
                          type="button"
                          onClick={() => toggleGrid(id)}
                          className="ml-0.5 text-brand-400 hover:text-brand-700"
                        >
                          ×
                        </button>
                      </span>
                    )
                  })}
                </div>
              )}
            </Section>

            <Section title="Knop (Call to Action)">
              <Field label="Knoptekst">
                <input
                  type="text"
                  value={cfg.ctaText}
                  onChange={(e) => update({ ctaText: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label="Knop URL">
                <input
                  type="url"
                  value={cfg.ctaUrl}
                  onChange={(e) => update({ ctaUrl: e.target.value })}
                  className={inputCls}
                />
              </Field>
            </Section>

            <Section title="Footer">
              <Field label="">
                <textarea
                  value={cfg.footerText}
                  onChange={(e) => update({ footerText: e.target.value })}
                  rows={3}
                  className={`${inputCls} resize-none`}
                />
              </Field>
            </Section>
          </div>

          {/* Right: live preview */}
          <div className="sticky top-4 self-start">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Live voorbeeld
            </p>
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-slate-100">
              <iframe
                srcDoc={previewHtml}
                title="E-mail voorbeeld"
                className="w-full"
                style={{ height: '720px', border: 'none' }}
              />
            </div>
          </div>
        </div>
      )}

      {tab === 'preview' && (
        <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-100 p-4">
          <iframe
            srcDoc={previewHtml}
            title="E-mail voorbeeld"
            className="w-full mx-auto block"
            style={{ height: '800px', border: 'none', maxWidth: 640 }}
          />
        </div>
      )}

      {tab === 'html' && (
        <textarea
          readOnly
          value={generatedHtml}
          rows={24}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono bg-slate-50 focus:outline-none"
        />
      )}

      {/* Save */}
      <div className="flex items-center gap-4 pt-1 border-t border-slate-100">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="px-6 py-2.5 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors font-medium"
        >
          {saving ? 'Opslaan...' : 'Sjabloon opslaan'}
        </button>
        {message && (
          <p
            className={`text-sm font-medium ${
              message.startsWith('Fout') ? 'text-red-600' : 'text-green-600'
            }`}
          >
            {message}
          </p>
        )}
      </div>
    </div>
  )
}
