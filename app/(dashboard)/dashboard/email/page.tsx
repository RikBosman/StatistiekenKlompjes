import { prisma } from '@/lib/db'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'
import { subMonths } from 'date-fns'

export const revalidate = 0

export default async function EmailPage() {
  const cutoff3m = subMonths(new Date(), 3)

  const [campaigns, templates, lists, logoBuyerCount, inactiveCount, repeatGroups, emmerCount, glaswerkCount, graveringCount, tulpCount] = await Promise.all([
    prisma.campaign.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        template: { select: { name: true } },
        list: { select: { name: true } },
        _count: { select: { recipients: true } },
      },
    }),
    prisma.emailTemplate.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.customerList.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { members: true } } },
    }),
    prisma.customer.count({
      where: {
        orders: {
          some: {
            status: { notIn: ['cancelled', 'refunded'] },
            lineItems: {
              some: {
                OR: [
                  { name: { contains: 'logo' } },
                  { name: { contains: 'tekst' } },
                ],
              },
            },
          },
        },
      },
    }),
    prisma.customer.count({
      where: {
        AND: [
          { orders: { some: { status: { notIn: ['cancelled', 'refunded'] } } } },
          { orders: { none: { date: { gte: cutoff3m }, status: { notIn: ['cancelled', 'refunded'] } } } },
        ],
      },
    }),
    prisma.order.groupBy({
      by: ['customerId'],
      where: { customerId: { not: null }, status: { notIn: ['cancelled', 'refunded'] } },
      _count: { id: true },
    }),
    prisma.customer.count({
      where: { orders: { some: { status: { notIn: ['cancelled', 'refunded'] }, lineItems: { some: { name: { contains: 'emmer' } } } } } },
    }),
    prisma.customer.count({
      where: {
        orders: {
          some: {
            status: { notIn: ['cancelled', 'refunded'] },
            lineItems: {
              some: {
                OR: [
                  { name: { contains: 'aperol glas' } },
                  { name: { contains: 'bier glas' } },
                  { name: { contains: 'bierglas' } },
                  { name: { contains: 'speciaalbier' } },
                  { name: { contains: 'bierpul' } },
                  { name: { contains: 'champagneglas' } },
                  { name: { contains: 'champagne glas' } },
                ],
              },
            },
          },
        },
      },
    }),
    prisma.customer.count({
      where: { orders: { some: { status: { notIn: ['cancelled', 'refunded'] }, lineItems: { some: { name: { contains: 'gravering' } } } } } },
    }),
    prisma.customer.count({
      where: { orders: { some: { status: { notIn: ['cancelled', 'refunded'] }, lineItems: { some: { name: { contains: 'tulp' } } } } } },
    }),
  ])

  const repeatBuyerCount = repeatGroups.filter(g => g._count.id >= 2).length

  // Top customers: all with any valid order revenue
  const topCustomerCount = await prisma.customer.count({
    where: { orders: { some: { status: { notIn: ['cancelled', 'refunded'] }, total: { gt: 0 } } } },
  })

  // Klompen logo/tekst: join through relation to avoid large IN clause (P2029)
  const klompenItems = await prisma.orderItem.findMany({
    where: {
      name: { contains: 'klompen' },
      order: { status: { notIn: ['cancelled', 'refunded'] } },
    },
    select: { name: true, order: { select: { customerId: true } } },
  })
  const klompenLogoCount = new Set(
    klompenItems
      .filter((i) => i.name.toLowerCase().includes('logo') || i.name.toLowerCase().includes('tekst'))
      .map((i) => i.order.customerId)
      .filter(Boolean)
  ).size

  const productSegments = [
    {
      key: 'emmer_buyer',
      label: 'Emmer kopers',
      description: 'Emmer in productnaam',
      count: emmerCount,
      color: 'teal',
    },
    {
      key: 'glaswerk_buyer',
      label: 'Glaswerk kopers',
      description: 'Bier-, wijn- of champagneglas / bierpul',
      count: glaswerkCount,
      color: 'cyan',
    },
    {
      key: 'gravering_buyer',
      label: 'Gravering kopers',
      description: 'Gravering in productnaam',
      count: graveringCount,
      color: 'rose',
    },
    {
      key: 'klompen_logo_buyer',
      label: 'Klompen logo/tekst',
      description: 'Klompen met logo of tekst',
      count: klompenLogoCount,
      color: 'indigo',
    },
    {
      key: 'tulp_buyer',
      label: 'Tulpen kopers',
      description: 'Tulp in productnaam',
      count: tulpCount,
      color: 'pink',
    },
  ]

  const behaviorSegments = [
    {
      key: 'logo_buyer',
      label: 'Logo / tekst kopers',
      description: 'Klanten die ooit een logo- of tekstproduct hebben besteld',
      count: logoBuyerCount,
      color: 'blue',
    },
    {
      key: 'repeat_buyer',
      label: 'Vaste klanten',
      description: 'Klanten met 2 of meer bestellingen',
      count: repeatBuyerCount,
      color: 'green',
    },
    {
      key: 'inactive_3m',
      label: 'Slapende klanten',
      description: 'Klanten die meer dan 3 maanden niet hebben besteld',
      count: inactiveCount,
      color: 'amber',
    },
    {
      key: 'top_customers',
      label: 'Top klanten',
      description: 'Top 500 klanten op omzet',
      count: Math.min(topCustomerCount, 500),
      color: 'purple',
    },
  ]

  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
    teal: 'bg-teal-50 border-teal-200 text-teal-700',
    cyan: 'bg-cyan-50 border-cyan-200 text-cyan-700',
    rose: 'bg-rose-50 border-rose-200 text-rose-700',
    indigo: 'bg-indigo-50 border-indigo-200 text-indigo-700',
    pink: 'bg-pink-50 border-pink-200 text-pink-700',
  }
  const countColorMap: Record<string, string> = {
    blue: 'text-blue-900',
    green: 'text-green-900',
    amber: 'text-amber-900',
    purple: 'text-purple-900',
    teal: 'text-teal-900',
    cyan: 'text-cyan-900',
    rose: 'text-rose-900',
    indigo: 'text-indigo-900',
    pink: 'text-pink-900',
  }

  const segmentLabels: Record<string, string> = {
    logo_buyer: 'Logo/tekst kopers',
    inactive_3m: 'Slapende klanten (3m+)',
    top_customers: 'Top klanten',
    repeat_buyer: 'Vaste klanten',
    list: 'Handmatige lijst',
    emmer_buyer: 'Emmer kopers',
    glaswerk_buyer: 'Glaswerk kopers',
    gravering_buyer: 'Gravering kopers',
    klompen_logo_buyer: 'Klompen logo/tekst',
    tulp_buyer: 'Tulpen kopers',
    cross_emmer_glaswerk: 'Emmer → Glaswerk upsell',
    cross_glaswerk_emmer: 'Glaswerk → Emmer upsell',
    cross_logo_gravering: 'Logo/tekst → Gravering upsell',
    cross_gravering_logo: 'Gravering → Logo klompen upsell',
  }

  const statusBadge = (status: string) => {
    if (status === 'sent') return <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700 font-medium">Verzonden</span>
    if (status === 'failed') return <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700 font-medium">Mislukt</span>
    return <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-500 font-medium">Concept</span>
  }

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">E-mail campagnes</h2>
          <p className="text-slate-500 text-sm mt-1">Stuur gerichte e-mails naar klantsegmenten</p>
        </div>
        <Link
          href="/dashboard/email/new"
          className="px-4 py-2 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700 transition-colors font-medium"
        >
          + Nieuwe campagne
        </Link>
      </div>

      {/* Smart lists */}
      <div className="mb-8">
        <h3 className="font-semibold text-slate-900 mb-3">Automatische klantenlijsten</h3>
        <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-2">Op besteld product</p>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
          {productSegments.map((seg) => (
            <Link
              key={seg.key}
              href={`/dashboard/email/segments/${seg.key}`}
              className={`rounded-xl border p-5 hover:shadow-sm transition-shadow ${colorMap[seg.color]}`}
            >
              <p className={`text-3xl font-bold mb-1 ${countColorMap[seg.color]}`}>{seg.count}</p>
              <p className="font-semibold text-sm mb-1">{seg.label}</p>
              <p className="text-xs opacity-70">{seg.description}</p>
            </Link>
          ))}
        </div>
        <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-2">Op klantgedrag</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {behaviorSegments.map((seg) => (
            <Link
              key={seg.key}
              href={`/dashboard/email/segments/${seg.key}`}
              className={`rounded-xl border p-5 hover:shadow-sm transition-shadow ${colorMap[seg.color]}`}
            >
              <p className={`text-3xl font-bold mb-1 ${countColorMap[seg.color]}`}>{seg.count}</p>
              <p className="font-semibold text-sm mb-1">{seg.label}</p>
              <p className="text-xs opacity-70">{seg.description}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Campagnes */}
      <div className="bg-white rounded-xl border border-slate-200 mb-8">
        <div className="p-6 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900">Campagnes</h3>
        </div>
        {campaigns.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">
            Nog geen campagnes. Maak je eerste campagne aan.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-6 py-3 font-medium text-slate-500">Naam</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Sjabloon</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Doelgroep</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-500">Ontvangers</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-500">Verzonden</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Datum</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-6 py-3 font-medium text-slate-900">{c.name}</td>
                    <td className="px-4 py-3 text-slate-500">{c.template.name}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {c.segmentType === 'list' && c.list
                        ? c.list.name
                        : segmentLabels[c.segmentType ?? ''] ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700">{c._count.recipients}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{c.totalSent}</td>
                    <td className="px-4 py-3">{statusBadge(c.status)}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">
                      {c.sentAt ? formatDate(c.sentAt) : formatDate(c.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/email/${c.id}`}
                        className="text-brand-600 hover:underline text-xs"
                      >
                        Details →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Templates + Manual lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">E-mailsjablonen</h3>
            <Link href="/dashboard/settings" className="text-xs text-brand-600 hover:underline">Beheer →</Link>
          </div>
          {templates.length === 0 ? (
            <p className="p-5 text-slate-400 text-sm">Nog geen sjablonen.</p>
          ) : (
            <ul className="divide-y divide-slate-50">
              {templates.map((t) => (
                <li key={t.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{t.name}</p>
                    <p className="text-xs text-slate-400">{t.subject}</p>
                  </div>
                  {t.isDefault && (
                    <span className="text-xs bg-brand-50 text-brand-600 px-2 py-0.5 rounded-full">Standaard</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">Handmatige lijsten</h3>
            <CreateListButton />
          </div>
          {lists.length === 0 ? (
            <p className="p-5 text-slate-400 text-sm">Nog geen lijsten aangemaakt.</p>
          ) : (
            <ul className="divide-y divide-slate-50">
              {lists.map((l) => (
                <li key={l.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{l.name}</p>
                    <p className="text-xs text-slate-400">{l._count.members} leden</p>
                  </div>
                  <Link href={`/dashboard/email/lists/${l.id}`} className="text-xs text-brand-600 hover:underline">
                    Beheer →
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

function CreateListButton() {
  return (
    <form action="/api/lists" method="POST" className="flex gap-2 items-center">
      <input
        type="text"
        name="name"
        placeholder="Naam lijst..."
        className="text-xs border border-slate-200 rounded px-2 py-1 w-32 focus:outline-none focus:ring-1 focus:ring-brand-400"
        required
      />
      <button
        type="submit"
        className="text-xs bg-brand-600 text-white px-2 py-1 rounded hover:bg-brand-700"
      >
        + Aanmaken
      </button>
    </form>
  )
}
