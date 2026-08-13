import { prisma } from '@/lib/db'
import { formatCurrency } from '@/lib/utils'
import AdSpendForm from './AdSpendForm'
import DeleteAdSpendButton from './DeleteAdSpendButton'
import ShippingCostForm from './ShippingCostForm'
import { subDays } from 'date-fns'

export const revalidate = 0

export default async function AdsPage() {
  const since = subDays(new Date(), 90)

  const [rows, shippingSettings] = await Promise.all([
    prisma.adSpend.findMany({
      where: { date: { gte: since } },
      orderBy: { date: 'desc' },
    }),
    prisma.settings.findMany({
      where: { key: { startsWith: 'shipping_actual_' } },
      orderBy: { key: 'desc' },
    }),
  ])

  const shippingRows = shippingSettings.map((s) => ({
    month: s.key.replace('shipping_actual_', ''),
    amount: parseFloat(s.value),
  }))

  const totalSpend = rows.reduce((s, r) => s + r.spend, 0)
  const avgPerDay = rows.length > 0 ? totalSpend / rows.length : 0

  return (
    <div className="p-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900">Kosten invoeren</h2>
        <p className="text-slate-500 text-sm mt-1">Sendcloud facturen en Google Ads — worden meegenomen in alle margeberekeningen</p>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <div className="bg-orange-50 rounded-xl border border-orange-200 p-5">
          <p className="text-xs text-orange-600 uppercase tracking-wide font-medium mb-2">Totaal (90 dagen)</p>
          <p className="text-2xl font-bold text-orange-700">{formatCurrency(totalSpend)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-2">Gem. per dag</p>
          <p className="text-2xl font-bold text-slate-900">{formatCurrency(avgPerDay)}</p>
          <p className="text-xs text-slate-400 mt-1">{rows.length} dagen ingevoerd</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-2">Verwacht per maand</p>
          <p className="text-2xl font-bold text-slate-900">{formatCurrency(avgPerDay * 30)}</p>
          <p className="text-xs text-slate-400 mt-1">Op basis van daggemiddelde</p>
        </div>
      </div>

      {/* Sendcloud actual shipping costs */}
      <ShippingCostForm initial={shippingRows} />

      {/* Google Ads entry form */}
      <AdSpendForm />

      {/* Data table */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="p-6 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900">Ingevoerde kosten (laatste 90 dagen)</h3>
        </div>
        {rows.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">Nog geen data ingevoerd</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-6 py-3 font-medium text-slate-500">Datum</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Campagne</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-500">Kosten</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-500">Klikken</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-500">Impressies</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-6 py-2.5 font-medium text-slate-900">
                      {new Date(r.date).toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">{r.campaign}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-orange-700">{formatCurrency(r.spend)}</td>
                    <td className="px-4 py-2.5 text-right text-slate-400">{r.clicks > 0 ? r.clicks.toLocaleString('nl-NL') : '—'}</td>
                    <td className="px-4 py-2.5 text-right text-slate-400">{r.impressions > 0 ? r.impressions.toLocaleString('nl-NL') : '—'}</td>
                    <td className="px-4 py-2.5 text-right">
                      <DeleteAdSpendButton id={r.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-orange-50 border-t border-orange-100">
                  <td colSpan={2} className="px-6 py-3 font-semibold text-slate-700">Totaal</td>
                  <td className="px-4 py-3 text-right font-bold text-orange-700">{formatCurrency(totalSpend)}</td>
                  <td colSpan={3}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
