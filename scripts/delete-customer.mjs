import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const email = process.argv[2]?.toLowerCase()

if (!email) {
  console.error('Gebruik: node scripts/delete-customer.mjs klant@email.com')
  process.exit(1)
}

async function main() {
  const customer = await prisma.customer.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
  })

  if (!customer) {
    console.log(`Geen klant gevonden met e-mail: ${email}`)
    return
  }

  console.log(`Gevonden: ${customer.firstName} ${customer.lastName} (ID: ${customer.id})`)

  // Unlink orders (preserve revenue)
  const orders = await prisma.order.updateMany({
    where: { customerId: customer.id },
    data: { customerId: null },
  })
  console.log(`Orders ontkoppeld: ${orders.count}`)

  await prisma.campaignRecipient.deleteMany({ where: { customerId: customer.id } })
  await prisma.reminder.deleteMany({ where: { customerId: customer.id } })
  await prisma.customerListMember.deleteMany({ where: { customerId: customer.id } })
  await prisma.customer.delete({ where: { id: customer.id } })

  console.log(`Klant ${email} volledig verwijderd.`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
