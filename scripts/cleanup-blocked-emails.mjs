import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const BLOCKED_DOMAINS = ['@verkopen.bol.com', '@bol.com']
const BATCH = 500

async function deleteInBatches(label, fn, ids) {
  let total = 0
  for (let i = 0; i < ids.length; i += BATCH) {
    const chunk = ids.slice(i, i + BATCH)
    const result = await fn(chunk)
    total += result.count
    process.stdout.write(`\r${label}: ${total}`)
  }
  console.log()
  return total
}

async function main() {
  const customers = await prisma.customer.findMany({
    where: { OR: BLOCKED_DOMAINS.map((d) => ({ email: { endsWith: d } })) },
    select: { id: true },
  })

  console.log(`Klanten met bol.com domein: ${customers.length}`)
  if (customers.length === 0) { console.log('Niks te doen.'); return }

  const ids = customers.map((c) => c.id)

  await deleteInBatches('Orders ontkoppeld', (chunk) =>
    prisma.order.updateMany({ where: { customerId: { in: chunk } }, data: { customerId: null } }), ids)

  await deleteInBatches('Campagne-ontvangers verwijderd', (chunk) =>
    prisma.campaignRecipient.deleteMany({ where: { customerId: { in: chunk } } }), ids)

  await deleteInBatches('Herinneringen verwijderd', (chunk) =>
    prisma.reminder.deleteMany({ where: { customerId: { in: chunk } } }), ids)

  await deleteInBatches('Lijst-leden verwijderd', (chunk) =>
    prisma.customerListMember.deleteMany({ where: { customerId: { in: chunk } } }), ids)

  const deleted = await deleteInBatches('Klanten verwijderd', (chunk) =>
    prisma.customer.deleteMany({ where: { id: { in: chunk } } }), ids)

  console.log(`\nKlaar! ${deleted} klanten verwijderd. Omzet telt nog mee.`)
}

main()
  .catch((err) => { console.error('FOUT:', err.message); process.exit(1) })
  .finally(() => prisma.$disconnect())
