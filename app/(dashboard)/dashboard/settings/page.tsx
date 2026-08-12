import { prisma } from '@/lib/db'
import ResyncButton from './ResyncButton'

export const revalidate = 0

export default async function SettingsPage() {
  let template = null
  let dbOk = false

  try {
    template = await prisma.emailTemplate.findFirst({ where: { isDefault: true } })
    dbOk = true
  } catch {
    // DB not ready
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-slate-900">Instellingen</h2>
        <p className="text-slate-500 text-sm mt-1">Configuratie & e-mailtemplate</p>
      </div>

      {/* Setup status */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
        <h3 className="font-medium text-slate-700 mb-4">Verbindingsstatus</h3>
        <div className="space-y-3 text-sm">
          <ConfigRow label="Database" status={dbOk} value={dbOk ? 'Verbonden' : 'Niet geconfigureerd'} />
          <ConfigRow
            label="WooCommerce API"
            status={!!process.env.WOOCOMMERCE_URL}
            value={process.env.WOOCOMMERCE_URL || 'Niet ingesteld'}
          />
          <ConfigRow
            label="Mailtrap"
            status={!!process.env.MAILTRAP_API_TOKEN}
            value={process.env.MAILTRAP_API_TOKEN ? 'Token aanwezig' : 'Niet ingesteld'}
          />
        </div>
      </div>

      {/* Customer resync */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
        <h3 className="font-medium text-slate-700 mb-2">Klantensynchronisatie</h3>
        <p className="text-sm text-slate-500 mb-1">
          Ontbrekende klanten? Gastbestellingen worden standaard niet als klant opgeslagen.
          Klik op de knop om alle historische bestellingen opnieuw in te lezen en
          <strong> alle gastklanten toe te voegen</strong> aan je klantenlijst.
        </p>
        <p className="text-xs text-slate-400">
          Synct bestellingen vanaf 1 januari 2026. Dit kan enkele minuten duren.
        </p>
        <ResyncButton />
      </div>

      {/* Cron info */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
        <h3 className="font-medium text-slate-700 mb-3">Geplande taken</h3>
        <p className="text-sm text-slate-500 mb-4">
          Stel een externe cron in die deze endpoints dagelijks aanroept (beveiligd met <code className="bg-slate-100 px-1 rounded">CRON_SECRET</code>):
        </p>
        <div className="space-y-2 text-sm font-mono bg-slate-50 rounded p-4">
          <p><span className="text-slate-400">POST</span> /api/cron/sync-products</p>
          <p><span className="text-slate-400">POST</span> /api/cron/sync-orders</p>
          <p><span className="text-slate-400">POST</span> /api/cron/process-reminders</p>
        </div>
        <p className="text-xs text-slate-400 mt-3">
          Stuur header: <code className="bg-slate-100 px-1 rounded">Authorization: Bearer {'<CRON_SECRET>'}</code>
        </p>
      </div>

      {/* Email template link */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h3 className="font-medium text-slate-700 mb-3">E-mailtemplate</h3>
        <p className="text-sm text-slate-500 mb-4">
          {template
            ? `Huidig template: "${template.name}"`
            : 'Nog geen template aangemaakt.'}
        </p>
        <a
          href="/dashboard/settings/email-template"
          className="inline-block px-4 py-2 bg-brand-600 text-white text-sm rounded-md hover:bg-brand-700 transition-colors"
        >
          {template ? 'Template bewerken' : 'Template aanmaken'}
        </a>
      </div>
    </div>
  )
}

function ConfigRow({ label, status, value }: { label: string; status: boolean; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={`w-2 h-2 rounded-full flex-shrink-0 ${status ? 'bg-green-500' : 'bg-slate-300'}`}
      />
      <span className="text-slate-600 w-36 flex-shrink-0">{label}</span>
      <span className={status ? 'text-slate-700' : 'text-slate-400'}>{value}</span>
    </div>
  )
}
