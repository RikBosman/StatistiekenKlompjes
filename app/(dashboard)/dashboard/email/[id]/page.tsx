import { prisma } from '@/lib/db'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export const revalidate = 0

export default async function CampaignDetailPage({ params }: { params: { id: string } }) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: Number(params.id) },
    include: {
      template: true,
      list: true,
      recipients: { orderBy: { sentAt: 'desc' } },
    },
  })

  if (!campaign) return notFound()

  const sentCount = campaign.recipients.filter((r) => r.status === 'sent').length
  const failedCount = campaign.recipients.filter((r) => r.status === 'failed').length
  const pendingCount = campaign.recipients.filter((r) => r.status === 'pending').length

  const segmentLabels: Record<string, string> = {
    logo_buyer: 'Logo/tekst kopers',
    inactive_3m: 'Slapende klanten (3m+)',
    top_customers: 'Top klanten',
    list: campaign.list?.name ?? 'Handmatige lijst',
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link href="/dashboard/email" className="text-sm text-slate-400 hover:text-slate-600">← Campagnes</Link>
        <h2 className="text-2xl font-bold text-slate-900 mt-1">{campaign.name}</h2>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-2">Totaal</p>
          <p className="text-2xl font-bold text-slate-900">{campaign.recipients.length}</p>
        </div>
        <div className="bg-green-50 rounded-xl border border-green-200 p-5">
          <p className="text-xs text-green-600 uppercase tracking-wide font-medium mb-2">Verzonden</p>
          <p className="text-2xl font-bold text-green-700">{sentCount}</p>
        </div>
        <div className="bg-red-50 rounded-xl border border-red-200 p-5">
          <p className="text-xs text-red-600 uppercase tracking-wide font-medium mb-2">Mislukt</p>
          <p className="text-2xl font-bold text-red-700">{failedCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-2">In wachtrij</p>
          <p className="text-2xl font-bold text-slate-900">{pendingCount}</p>
        </div>
      </div>

      {/* Info */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <h3 className="font-semibold text-slate-900 mb-3">Details</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span className="text-slate-400">Sjabloon: </span><span className="text-slate-700">{campaign.template.name}</span></div>
          <div><span className="text-slate-400">Doelgroep: </span><span className="text-slate-700">{segmentLabels[campaign.segmentType ?? ''] ?? '—'}</span></div>
          <div><span className="text-slate-400">Aangemaakt: </span><span className="text-slate-700">{formatDate(campaign.createdAt)}</span></div>
          <div><span className="text-slate-400">Verzonden: </span><span className="text-slate-700">{campaign.sentAt ? formatDate(campaign.sentAt) : '—'}</span></div>
        </div>
      </div>

      {/* Recipients */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="p-6 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900">Ontvangers</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-6 py-3 font-medium text-slate-500">Naam</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">E-mail</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">Status</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">Verzonden op</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">Fout</th>
              </tr>
            </thead>
            <tbody>
              {campaign.recipients.map((r) => (
                <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-6 py-2.5 font-medium text-slate-900">{r.firstName}</td>
                  <td className="px-4 py-2.5 text-slate-500">{r.email}</td>
                  <td className="px-4 py-2.5">
                    {r.status === 'sent' && <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700 font-medium">Verzonden</span>}
                    {r.status === 'failed' && <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700 font-medium">Mislukt</span>}
                    {r.status === 'pending' && <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-500">Wachtend</span>}
                  </td>
                  <td className="px-4 py-2.5 text-slate-400 text-xs">{r.sentAt ? formatDate(r.sentAt) : '—'}</td>
                  <td className="px-4 py-2.5 text-red-500 text-xs max-w-xs truncate">{r.error ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
