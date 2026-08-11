/**
 * Re-links OrderItems that have productId=null to their product by matching on SKU.
 * Run this once after bulk-importing orders with the standalone script.
 *
 * Usage:
 *   set -a && source .env && set +a
 *   npx tsx scripts/fix-order-items.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Build sku → productId map from synced products
  const products = await prisma.product.findMany({
    where: { sku: { not: null } },
    select: { id: true, sku: true },
  })
  const skuToId = new Map<string, number>()
  for (const p of products) {
    if (p.sku) skuToId.set(p.sku, p.id)
  }
  console.log(`Geladen: ${skuToId.size} producten met SKU`)

  // Find order items with null productId but a non-null SKU
  const items = await prisma.orderItem.findMany({
    where: { productId: null, sku: { not: null } },
    select: { id: true, sku: true },
  })
  console.log(`${items.length} order items met null productId gevonden`)

  let fixed = 0
  let skipped = 0

  for (const item of items) {
    const productId = item.sku ? skuToId.get(item.sku) : undefined
    if (productId !== undefined) {
      await prisma.orderItem.update({ where: { id: item.id }, data: { productId } })
      fixed++
    } else {
      skipped++
    }
  }

  console.log(`Klaar: ${fixed} gekoppeld, ${skipped} niet gevonden (onbekende SKU)`)
}

main()
  .then(() => process.exit(0))
  .catch((err) => { console.error(err); process.exit(1) })
  .finally(() => prisma.$disconnect())
