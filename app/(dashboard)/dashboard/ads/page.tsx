import { prisma } from '@/lib/db'
import { formatCurrency } from '@/lib/utils'
import DailyRateForm from './DailyRateForm'
import SettingInput from './SettingInput'
import CsvImport from './CsvImport'
import SendcloudSync from './SendcloudSync'
import ShippingPdfImport from './ShippingPdfImport'
import AdsPdfImport from './AdsPdfImport'

export const revalidate = 0

const MONTHS_NL = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']

async function getSetting(key: string, fallback: number) {
  const s = await prisma.settings.findUnique({ where: { key } })
  return s ? parseFloat(s.value) : fallback
}

async function getStringSetting(key: string): Promise<string> {
  const s = await prisma.settings.findUnique({ where: { key } })
  return s?.value ?? ''
}

export default async function AdsPage() {
  const [dailyRate, btwRate, paymentCostPerOrder, sendcloudPublicKey, sendcloudSecretKey, adsInvoices, shippingInvoices, adSpendCount] = await Promise.all([
    getSetting('ads_daily_rate', 0),
    getSetting('btw_rate', 21),
    getSetting('payment_cost_per_order', 0.50),
    getStringSetting('sendcloud_public_key'),
    getStringSetting('sendcloud_secret_key'),
    prisma.adsInvoice.findMany({ orderBy: [{ year: 'desc' }, { month: 'desc' }] }),
    prisma.shippingInvoice.findMany({ orderBy: [{ year: 'desc' }, { month: 'desc' }] }),
    prisma.adSpend.count(),
  ])

  return (
    <div className="p-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900">Kosten &amp; instellingen</h2>
        <p className="text-slate-500 text-sm mt-1">
          Alle kostenposten die doorgerekend worden in de contributiemarge
        </p>
      </div>

      <div className="space-y-8">

        {/* Google Ads facturen (PDF) */}
        <div>
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Google Ads</h3>
          <div className="space-y-4">
            {adsInvoices.length > 0 ? (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-700">
                ✓ <strong>{adsInvoices.length} maandfacturen</strong> geïmporteerd — exacte bedragen worden gebruikt in de berekeningen.
              </div>
            ) : adSpendCount > 0 ? (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-700">
                ✓ CSV-data actief ({adSpendCount} rijen). Importeer maandfacturen voor nog exactere bedragen.
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
                Schatting actief{dailyRate > 0 ? `: ${formatCurrency(dailyRate)}/dag` : ''}. Importeer een maandfactuur of CSV voor exacte bedragen.
              </div>
            )}

            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h4 className="font-semibold text-slate-900 mb-1">Maandfactuur importeren (PDF)</h4>
              <p className="text-xs text-slate-400 mb-5">
                Download je factuur bij Google Ads → Facturering → Documenten. Upload de PDF — totale kosten excl. BTW worden automatisch uitgelezen.
              </p>
              <AdsPdfImport />
            </div>

            {adsInvoices.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left text-xs text-slate-400 font-medium px-5 py-3">Periode</th>
                      <th className="text-right text-xs text-slate-400 font-medium px-5 py-3">Kosten excl. BTW</th>
                      <th className="text-right text-xs text-slate-400 font-medium px-5 py-3">Bestand</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adsInvoices.map((inv) => (
                      <tr key={`${inv.year}-${inv.month}`} className="border-b border-slate-50 last:border-0">
                        <td className="px-5 py-3 text-slate-700">{MONTHS_NL[inv.month - 1]} {inv.year}</td>
                        <td className="px-5 py-3 text-right font-semibold text-slate-900">{formatCurrency(inv.amountExclBtw)}</td>
                        <td className="px-5 py-3 text-right text-slate-400 text-xs">{inv.filename ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* CSV als alternatief / fallback */}
            <details className="text-xs text-slate-400">
              <summary className="cursor-pointer hover:text-slate-600 font-medium">CSV-import (alternatief voor dagelijkse uitsplitsing)</summary>
              <div className="mt-3">
                <CsvImport />
              </div>
            </details>

            <details className="text-xs text-slate-400">
              <summary className="cursor-pointer hover:text-slate-600 font-medium">Fallback dagbudget (als er geen factuur of CSV is)</summary>
              <div className="mt-3 space-y-4">
                {dailyRate > 0 && (
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-orange-50 rounded-xl border border-orange-200 p-5">
                      <p className="text-xs text-orange-600 uppercase tracking-wide font-medium mb-2">Per dag</p>
                      <p className="text-2xl font-bold text-orange-700">{formatCurrency(dailyRate)}</p>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 p-5">
                      <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-2">Per maand (30d)</p>
                      <p className="text-2xl font-bold text-slate-900">{formatCurrency(dailyRate * 30)}</p>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 p-5">
                      <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-2">Per jaar (365d)</p>
                      <p className="text-2xl font-bold text-slate-900">{formatCurrency(dailyRate * 365)}</p>
                    </div>
                  </div>
                )}
                <DailyRateForm current={dailyRate} />
              </div>
            </details>
          </div>
        </div>

        {/* SendCloud verzendkosten */}
        <div>
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">SendCloud verzendkosten</h3>
          <div className="space-y-4">
            {shippingInvoices.length > 0 ? (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-700">
                ✓ <strong>{shippingInvoices.length} maandfacturen</strong> geïmporteerd.
              </div>
            ) : (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-700">
                ✓ SendCloud API gekoppeld — werkelijke kosten per zending worden gebruikt.
              </div>
            )}

            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h4 className="font-semibold text-slate-900 mb-1">Maandfactuur importeren (PDF)</h4>
              <p className="text-xs text-slate-400 mb-5">
                Optioneel: importeer de SendCloud maandfactuur voor exacte totalen per maand (overschrijft de API-kosten).
              </p>
              <ShippingPdfImport />
            </div>

            {shippingInvoices.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left text-xs text-slate-400 font-medium px-5 py-3">Periode</th>
                      <th className="text-right text-xs text-slate-400 font-medium px-5 py-3">Subtotaal excl. BTW</th>
                      <th className="text-right text-xs text-slate-400 font-medium px-5 py-3">Bestand</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shippingInvoices.map((inv) => (
                      <tr key={`${inv.year}-${inv.month}`} className="border-b border-slate-50 last:border-0">
                        <td className="px-5 py-3 text-slate-700">{MONTHS_NL[inv.month - 1]} {inv.year}</td>
                        <td className="px-5 py-3 text-right font-semibold text-slate-900">{formatCurrency(inv.amountExclBtw)}</td>
                        <td className="px-5 py-3 text-right text-slate-400 text-xs">{inv.filename ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <details className="text-xs text-slate-400">
              <summary className="cursor-pointer hover:text-slate-600 font-medium">SendCloud API-sleutels beheren</summary>
              <div className="mt-3">
                <SendcloudSync publicKey={sendcloudPublicKey} secretKey={sendcloudSecretKey} />
              </div>
            </details>
          </div>
        </div>

        {/* BTW & betaalkosten */}
        <div>
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">BTW &amp; betaalkosten</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SettingInput
              settingKey="btw_rate"
              label="BTW-tarief"
              description="Wordt gebruikt om webshopomzet excl. BTW te berekenen. Standaard 21% voor de meeste producten."
              current={btwRate}
              suffix="%"
              step="1"
              placeholder="21"
            />
            <SettingInput
              settingKey="payment_cost_per_order"
              label="Betaalkosten per order"
              description="Vaste transactiekosten per bestelling via Mollie (gemiddeld €0,50 excl. BTW). Wordt vermenigvuldigd met het aantal orders."
              current={paymentCostPerOrder}
              prefix="€"
              step="0.01"
              placeholder="0.50"
            />
          </div>
        </div>

      </div>
    </div>
  )
}
