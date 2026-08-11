import { prisma } from '@/lib/db'
import { getSegmentCustomers, segmentLabel, SegmentType } from '@/lib/segments'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export const revalidate = 0

const VALID_SEGMENTS: SegmentType[] = ['logo_buyer', 'repeat_buyer', 'inactive_3m', 'top_customers']

const segmentDescriptions: Record<string, string> = {
  logo_buyer: 'Klanten die een product met "logo" of "tekst" in de naam hebben besteld.',
  repeat_buyer: 'Klanten met 2 of meer bestellingen — ideaal voor loyaliteitscampagnes.',
  inactive_3m: 'Klanten die meer dan 3 maanden niet hebben besteld — win ze terug.',
  top_customers: 'Top 500 klanten op totale omzet.',
}

export default async function SegmentPage({ params }: { params: Promise<{ segment: string }> }) {
  const { segment } = await params

  if (!VALID_SEGMENTS.includes(segment as SegmentType)) return notFound()

  const segmentType = segment as SegmentType
  const customers = await getSegmentCustomers(segmentType)

  const fmt = (n: number) =>
    new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n)

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link href="/dashboard/email" className="text-sm text-slate-400 hover:text-slate-600">← E-mail</Link>
        <h2 className="text-2xl font-bold text-slate-900 mt-1">{segmentLabel(segmentType)}</h2>
        <p className="text-slate-500 text-sm mt-1">{segmentDescriptions[segmentType]}</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 mb-4 inline-flex items-center px-5 py-3 gap-6">
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-wide font-medium">Klanten</p>
          <p className="text-2xl font-bold text-slate-900">{customers.length}</p>
        </div>
        <Link
          href={`/dashboard/email/new?segment=${segmentType}`}
          className="px-4 py-2 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700 transition-colors font-medium"
        >
          Campagne sturen →
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-slate-200">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-6 py-3 font-medium text-slate-500">Naam</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">E-mail</th>
                {(segmentType === 'top_customers' || segmentType === 'repeat_buyer') && (
                  <th className="text-right px-4 py-3 font-medium text-slate-500">Bestellingen</th>
                )}
                {(segmentType === 'top_customers' || segmentType === 'repeat_buyer') && (
                  <th className="text-right px-4 py-3 font-medium text-slate-500">Omzet</th>
                )}
                {segmentType === 'inactive_3m' && (
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Laatste bestelling</th>
                )}
                {segmentType === 'repeat_buyer' && (
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Laatste bestelling</th>
                )}
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-6 py-2.5 font-medium text-slate-900">
                    {c.firstName} {c.lastName}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">{c.email}</td>
                  {(segmentType === 'top_customers' || segmentType === 'repeat_buyer') && (
                    <td className="px-4 py-2.5 text-right text-slate-700">{c.orderCount ?? '—'}</td>
                  )}
                  {(segmentType === 'top_customers' || segmentType === 'repeat_buyer') && (
                    <td className="px-4 py-2.5 text-right text-slate-700">
                      {c.totalRevenue != null ? fmt(c.totalRevenue) : '—'}
                    </td>
                  )}
                  {segmentType === 'inactive_3m' && (
                    <td className="px-4 py-2.5 text-slate-400 text-xs">
                      {c.lastOrderDate ? formatDate(c.lastOrderDate) : '—'}
                    </td>
                  )}
                  {segmentType === 'repeat_buyer' && (
                    <td className="px-4 py-2.5 text-slate-400 text-xs">
                      {c.lastOrderDate ? formatDate(c.lastOrderDate) : '—'}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
