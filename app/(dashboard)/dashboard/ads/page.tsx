import { prisma } from '@/lib/db'
import { formatCurrency } from '@/lib/utils'
import DailyRateForm from './DailyRateForm'
import SettingInput from './SettingInput'
import CsvImport from './CsvImport'
import SendcloudSync from './SendcloudSync'

export const revalidate = 0

async function getSetting(key: string, fallback: number) {
  const s = await prisma.settings.findUnique({ where: { key } })
  return s ? parseFloat(s.value) : fallback
}

async function getStringSetting(key: string): Promise<string> {
  const s = await prisma.settings.findUnique({ where: { key } })
  return s?.value ?? ''
}

export default async function AdsPage() {
  const [dailyRate, btwRate, paymentCostPerOrder, sendcloudPublicKey, sendcloudSecretKey, adSpendCount] = await Promise.all([
    getSetting('ads_daily_rate', 0),
    getSetting('btw_rate', 21),
    getSetting('payment_cost_per_order', 0.50),
    getStringSetting('sendcloud_public_key'),
    getStringSetting('sendcloud_secret_key'),
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
        {/* Google Ads */}
        <div>
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Google Ads</h3>
          <div className="space-y-4">
            {adSpendCount > 0 ? (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-700">
                ✓ <strong>{adSpendCount} rijen</strong> werkelijke Google Ads spend geïmporteerd. De dagelijkse schatting hieronder wordt genegeerd zolang er CSV-data beschikbaar is voor de geselecteerde periode.
              </div>
            ) : dailyRate > 0 ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
                Schatting actief: {formatCurrency(dailyRate)}/dag. Importeer een CSV voor exacte bedragen.
              </div>
            ) : null}

            <CsvImport />

            <div>
              <p className="text-xs text-slate-400 mb-3">Fallback dagbudget (wordt gebruikt als er geen CSV-data is voor een periode)</p>
              {dailyRate > 0 && (
                <div className="grid grid-cols-3 gap-4 mb-4">
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
          </div>
        </div>

        {/* SendCloud */}
        <div>
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">SendCloud verzendkosten</h3>
          <SendcloudSync publicKey={sendcloudPublicKey} secretKey={sendcloudSecretKey} />
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
