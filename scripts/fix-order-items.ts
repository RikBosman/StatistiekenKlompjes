/**
 * Re-links OrderItems that have productId=null to their product.
 * Pass 1: match by SKU
 * Pass 2: match by exact product name (for items without SKU or unknown SKU)
 *
 * Usage:
 *   set -a && source .env && set +a
 *   npx tsx scripts/fix-order-items.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const products = await prisma.product.findMany({
    select: { id: true, sku: true, name: true },
  })

  const skuToId = new Map<string, number>()
  const nameToId = new Map<string, number>()
  for (const p of products) {
    if (p.sku) skuToId.set(p.sku, p.id)
    nameToId.set(p.name.trim().toLowerCase(), p.id)
  }
  console.log(`Geladen: ${products.length} producten (${skuToId.size} met SKU)`)

  const items = await prisma.orderItem.findMany({
    where: { productId: null },
    select: { id: true, sku: true, name: true },
  })
  console.log(`${items.length} order items met null productId`)

  let fixedSku = 0
  let fixedName = 0
  let skipped = 0

  for (const item of items) {
    // Pass 1: SKU
    const bySkuId = item.sku ? skuToId.get(item.sku) : undefined
    if (bySkuId !== undefined) {
      await prisma.orderItem.update({ where: { id: item.id }, data: { productId: bySkuId } })
      fixedSku++
      continue
    }

    // Pass 2: exact name (case-insensitive)
    const byNameId = nameToId.get(item.name.trim().toLowerCase())
    if (byNameId !== undefined) {
      await prisma.orderItem.update({ where: { id: item.id }, data: { productId: byNameId } })
      fixedName++
      continue
    }

    skipped++
  }

  console.log(`Klaar: ${fixedSku} via SKU, ${fixedName} via naam, ${skipped} niet gevonden`)
}

main()
  .then(() => process.exit(0))
  .catch((err) => { console.error(err); process.exit(1) })
  .finally(() => prisma.$disconnect())
