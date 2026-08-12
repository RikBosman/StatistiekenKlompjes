import { prisma } from '@/lib/db'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export const revalidate = 0

export default async function ListDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { id } = await params
  const { error } = await searchParams

  const list = await prisma.customerList.findUnique({
    where: { id: Number(id) },
    include: {
      members: {
        include: { customer: true },
      },
    },
  })

  if (!list) return notFound()

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link href="/dashboard/email" className="text-sm text-slate-400 hover:text-slate-600">← E-mail</Link>
        <h2 className="text-2xl font-bold text-slate-900 mt-1">{list.name}</h2>
        <p className="text-slate-500 text-sm mt-1">{list.members.length} leden</p>
      </div>

      {/* Add member form */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
        <h3 className="font-semibold text-slate-900 mb-3">Lid toevoegen op e-mailadres</h3>
        {error === 'not_found' && (
          <p className="text-sm text-red-600 mb-3">Geen klant gevonden met dit e-mailadres.</p>
        )}
        <form
          action={`/api/lists/${id}/members`}
          method="POST"
          encType="application/x-www-form-urlencoded"
          className="flex gap-2"
        >
          <input
            type="email"
            name="email"
            placeholder="klant@voorbeeld.nl"
            required
            className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700 transition-colors font-medium"
          >
            Toevoegen
          </button>
        </form>
        <p className="text-xs text-slate-400 mt-2">Het e-mailadres moet al als klant in het systeem staan (gesynchroniseerd via WooCommerce).</p>
      </div>

      {/* Members table */}
      <div className="bg-white rounded-xl border border-slate-200">
        {list.members.length === 0 ? (
          <p className="p-8 text-center text-slate-400 text-sm">Nog geen leden in deze lijst.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-6 py-3 font-medium text-slate-500">Naam</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">E-mail</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {list.members.map((m) => (
                  <tr key={m.customerId} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-6 py-2.5 font-medium text-slate-900">
                      {m.customer.firstName} {m.customer.lastName}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">{m.customer.email}</td>
                    <td className="px-4 py-2.5 text-right">
                      <form
                        action={`/api/lists/${id}/members/remove`}
                        method="POST"
                        encType="application/x-www-form-urlencoded"
                      >
                        <input type="hidden" name="customerId" value={m.customerId} />
                        <button type="submit" className="text-xs text-red-400 hover:text-red-600">
                          Verwijderen
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
