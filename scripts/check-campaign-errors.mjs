import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Get the most recent campaign with failures
  const campaigns = await prisma.campaign.findMany({
    where: { recipients: { some: { status: 'failed' } } },
    orderBy: { id: 'desc' },
    take: 3,
    include: {
      _count: { select: { recipients: true } },
    },
  })

  for (const c of campaigns) {
    const stats = await prisma.campaignRecipient.groupBy({
      by: ['status'],
      where: { campaignId: c.id },
      _count: true,
    })
    console.log(`\nCampagne #${c.id}: ${c.name}`)
    for (const s of stats) console.log(`  ${s.status}: ${s._count}`)

    // Sample 5 errors
    const errors = await prisma.campaignRecipient.findMany({
      where: { campaignId: c.id, status: 'failed', error: { not: null } },
      select: { error: true },
      take: 5,
    })
    if (errors.length) {
      console.log('  Voorbeeldfouten:')
      const unique = [...new Set(errors.map((e) => e.error))]
      unique.forEach((e) => console.log(`    - ${e}`))
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
