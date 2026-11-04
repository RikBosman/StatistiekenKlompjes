import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const BLOCKED_DOMAINS = ['@verkopen.bol.com']

async function main() {
  // Show customer counts per bol.com variant
  const bolVariants = ['@verkopen.bol.com', '@bol.com', 'bol.com']
  for (const domain of bolVariants) {
    const count = await prisma.customer.count({
      where: { email: { contains: domain } },
    })
    console.log(`Klanten met ${domain} in email: ${count}`)
  }

  // Total customers
  const total = await prisma.customer.count()
  console.log(`\nTotaal klanten in DB: ${total}`)

  // Campaign recipient cleanup
  console.log('\n--- Cleanup campagne-ontvangers ---')
  for (const domain of BLOCKED_DOMAINS) {
    const deleted = await prisma.campaignRecipient.deleteMany({
      where: { email: { endsWith: domain } },
    })
    console.log(`Verwijderd met ${domain}: ${deleted.count}`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
