import { prisma } from '@/lib/db'
import { formatDate } from '@/lib/utils'

export const revalidate = 300

export default async function CustomersPage() {
  let customers = null
  let error = null

  try {
    // Get logo/tekst customers with their last order
    customers = await prisma.customer.findMany({
      where: { tags: { contains: 'logo_buyer' } },
      include: {
        orders: {
          where: {
            status: { notIn: ['cancelled', 'refunded'] },
            lineItems: {
              some: {
                OR: [
                  { name: { contains: 'logo' } },
                  { name: { contains: 'tekst' } },
                  { name: { contains: 'Logo' } },
                  { name: { contains: 'Tekst' } },
                ],
              },
            },
          },
          orderBy: { date: 'desc' },
          take: 1,
          include: {
            lineItems: {
              where: {
                OR: [
                  { name: { contains: 'logo' } },
                  { name: { contains: 'tekst' } },
                  { name: { contains: 'Logo' } },
                  { name: { contains: 'Tekst' } },
                ],
              },
            },
          },
        },
        reminders: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { id: 'desc' },
    })
  } catch (err) {
    error = err instanceof Error ? err.message : 'Onbekende fout'
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      </div>
    )
  }

  const now = new Date()
  const threeMonthsAgo = new Date(now.setMonth(now.getMonth() - 3))

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Logo / Tekst klanten</h2>
          <p className="text-slate-500 text-sm mt-1">
            Klanten die een logo of tekst product hebben gekocht — {customers?.length || 0} gevonden
          </p>
        </div>
        <form action="/api/reminders/trigger" method="POST">
          <button
            type="submit"
            className="px-4 py-2 bg-brand-600 text-white text-sm rounded-md hover:bg-brand-700 transition-colors"
          >
            Herinneringen verwerken
          </button>
        </form>
      </div>

      {(!customers || customers.length === 0) ? (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-8 text-center">
          <p className="text-slate-500">
            Geen logo/tekst klanten gevonden. Zorg dat bestellingen zijn gesynchroniseerd.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Klant</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">E-mail</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Laatste logo/tekst bestelling</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Producten</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Herinnering</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => {
                  const lastOrder = customer.orders[0]
                  const lastReminder = customer.reminders[0]
                  const isDue = lastOrder && new Date(lastOrder.date) < threeMonthsAgo

                  return (
                    <tr key={customer.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {customer.firstName} {customer.lastName}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{customer.email}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {lastOrder ? formatDate(lastOrder.date) : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-500 max-w-xs">
                        {lastOrder?.lineItems.map((i) => i.name).join(', ') || '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {lastReminder?.sentAt ? formatDate(lastReminder.sentAt) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {lastReminder?.status === 'sent' ? (
                          <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700">
                            Verstuurd
                          </span>
                        ) : isDue ? (
                          <span className="px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700">
                            Te versturen
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-500">
                            Nog niet
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
