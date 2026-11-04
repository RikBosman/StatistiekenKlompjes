import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const BLOCKED_DOMAINS = ['@verkopen.bol.com']

async function main() {
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
