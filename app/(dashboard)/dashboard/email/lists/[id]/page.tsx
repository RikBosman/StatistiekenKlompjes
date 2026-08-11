import { prisma } from '@/lib/db'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export const revalidate = 0

export default async function ListDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
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
                </tr>
              </thead>
              <tbody>
                {list.members.map((m) => (
                  <tr key={m.customerId} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-6 py-2.5 font-medium text-slate-900">
                      {m.customer.firstName} {m.customer.lastName}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">{m.customer.email}</td>
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
