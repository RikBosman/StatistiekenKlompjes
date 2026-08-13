import { prisma } from '@/lib/db'
import { formatCurrency } from '@/lib/utils'
import DailyRateForm from './DailyRateForm'

export const revalidate = 0

export default async function AdsPage() {
  const setting = await prisma.settings.findUnique({ where: { key: 'ads_daily_rate' } })
  const dailyRate = setting ? parseFloat(setting.value) : 0

  return (
    <div className="p-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900">Kosten invoeren</h2>
        <p className="text-slate-500 text-sm mt-1">
          Stel het dagelijkse Google Ads budget in — wordt automatisch doorgerekend in alle marges
        </p>
      </div>

      {dailyRate > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
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
  )
}
