import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const BLOCKED_DOMAINS = ['@verkopen.bol.com', '@bol.com']

async function main() {
  // Find all customer IDs with blocked domains
  const customers = await prisma.customer.findMany({
    where: { OR: BLOCKED_DOMAINS.map((d) => ({ email: { endsWith: d } })) },
    select: { id: true, email: true },
  })

  console.log(`Gevonden klanten met geblokkeerde domeinen: ${customers.length}`)
  if (customers.length === 0) {
    console.log('Niks te doen.')
    return
  }

  const customerIds = customers.map((c) => c.id)

  // 1. Set customerId = null on orders (revenue stays intact)
  const updatedOrders = await prisma.order.updateMany({
    where: { customerId: { in: customerIds } },
    data: { customerId: null },
  })
  console.log(`Orders ontkoppeld (omzet blijft): ${updatedOrders.count}`)

  // 2. Delete campaign recipients
  const deletedRecipients = await prisma.campaignRecipient.deleteMany({
    where: { customerId: { in: customerIds } },
  })
  console.log(`Campagne-ontvangers verwijderd: ${deletedRecipients.count}`)

  // 3. Delete reminders
  const deletedReminders = await prisma.reminder.deleteMany({
    where: { customerId: { in: customerIds } },
  })
  console.log(`Herinneringen verwijderd: ${deletedReminders.count}`)

  // 4. Delete list memberships
  const deletedListMembers = await prisma.customerListMember.deleteMany({
    where: { customerId: { in: customerIds } },
  })
  console.log(`Lijst-leden verwijderd: ${deletedListMembers.count}`)

  // 5. Delete the customers themselves
  const deletedCustomers = await prisma.customer.deleteMany({
    where: { id: { in: customerIds } },
  })
  console.log(`\nKlanten verwijderd: ${deletedCustomers.count}`)
  console.log('Klaar! Omzet van die bestellingen telt gewoon mee.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
