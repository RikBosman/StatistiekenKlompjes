import { prisma } from './db'
import { fetchProducts, fetchOrdersPage } from './woocommerce'

export async function syncProducts(): Promise<{ count: number; error?: string }> {
  try {
    const products = await fetchProducts()

    for (const p of products) {
      const cogsMeta = p.meta_data?.find((m) => m.key === '_wc_cog_cost')
      const cogs = cogsMeta ? parseFloat(cogsMeta.value) || null : null

      const price = p.price ? parseFloat(p.price) || null : null
      const imageUrl = p.images?.[0]?.src || null
      const permalink = p.permalink || null
      const tagNames = JSON.stringify((p.tags ?? []).map((t) => t.name))

      await prisma.product.upsert({
        where: { id: p.id },
        create: {
          id: p.id,
          name: p.name,
          sku: p.sku || null,
          cogs,
          price,
          imageUrl,
          permalink,
          createdAt: new Date(p.date_created),
          status: p.status,
          categories: JSON.stringify(p.categories.map((c) => c.name)),
          tags: tagNames,
          syncedAt: new Date(),
        },
        update: {
          name: p.name,
          sku: p.sku || null,
          cogs,
          price,
          imageUrl,
          permalink,
          status: p.status,
          categories: JSON.stringify(p.categories.map((c) => c.name)),
          tags: tagNames,
          syncedAt: new Date(),
        },
      })
    }

    await prisma.syncLog.create({
      data: { type: 'products', status: 'success', itemCount: products.length },
    })

    return { count: products.length }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await prisma.syncLog.create({
      data: { type: 'products', status: 'failed', message },
    })
    return { count: 0, error: message }
  }
}

export async function syncOrders(afterDate?: string, beforeDate?: string): Promise<{ count: number; error?: string }> {
  try {
    let after = afterDate
    if (!after && !beforeDate) {
      // Incremental: pick up from last synced order
      const lastOrder = await prisma.order.findFirst({ orderBy: { date: 'desc' } })
      if (lastOrder) {
        after = new Date(lastOrder.date.getTime() - 24 * 60 * 60 * 1000).toISOString()
      }
    }

    // Preload valid product IDs to avoid FK issues with deleted/draft products
    const existingProductIds = new Set<number>(
      (await prisma.product.findMany({ select: { id: true } })).map(p => p.id)
    )

    let page = 1
    let totalPages = 1
    let count = 0

    while (page <= totalPages) {
      const { orders, totalPages: tp } = await fetchOrdersPage(page, after, beforeDate)
      totalPages = tp

      for (const o of orders) {
        const customerEmail = o.billing?.email || ''
        const customerName = `${o.billing?.first_name || ''} ${o.billing?.last_name || ''}`.trim()
        const shippingMethod = o.shipping_lines?.[0]?.method_title ?? null

        let customer = null
        if (customerEmail) {
          if (o.customer_id > 0) {
            // Registered WooCommerce account
            const byId = await prisma.customer.findUnique({ where: { id: o.customer_id } })
            if (byId) {
              // If this email belongs to a different record (e.g. a guest), free it up first
              if (byId.email !== customerEmail) {
                const conflict = await prisma.customer.findUnique({ where: { email: customerEmail } })
                if (conflict && conflict.id !== byId.id) {
                  await prisma.customer.update({
                    where: { id: conflict.id },
                    data: { email: `guest_${conflict.id}@merged.local` },
                  })
                }
              }
              customer = await prisma.customer.update({
                where: { id: o.customer_id },
                data: {
                  email: customerEmail,
                  firstName: o.billing?.first_name || '',
                  lastName: o.billing?.last_name || '',
                },
              })
            } else {
              // Not found by ID — check if the email already exists (guest who later registered)
              const byEmail = await prisma.customer.findUnique({ where: { email: customerEmail } })
              if (byEmail) {
                // Reuse the existing record; don't change the ID (FK references depend on it)
                customer = byEmail
              } else {
                customer = await prisma.customer.create({
                  data: {
                    id: o.customer_id,
                    email: customerEmail,
                    firstName: o.billing?.first_name || '',
                    lastName: o.billing?.last_name || '',
                  },
                })
              }
            }
          } else {
            // Guest order (customer_id = 0) — find or create by email
            const existing = await prisma.customer.findUnique({ where: { email: customerEmail } })
            if (existing) {
              customer = existing
              // Fill in name if it was previously blank
              if (!existing.firstName && (o.billing?.first_name || o.billing?.last_name)) {
                customer = await prisma.customer.update({
                  where: { id: existing.id },
                  data: {
                    firstName: o.billing?.first_name || existing.firstName,
                    lastName: o.billing?.last_name || existing.lastName,
                  },
                })
              }
            } else {
              // Assign synthetic negative ID so it never clashes with WooCommerce IDs
              const lowestGuest = await prisma.customer.findFirst({
                where: { id: { lt: 0 } },
                orderBy: { id: 'asc' },
              })
              const newId = lowestGuest ? lowestGuest.id - 1 : -1
              try {
                customer = await prisma.customer.create({
                  data: {
                    id: newId,
                    email: customerEmail,
                    firstName: o.billing?.first_name || '',
                    lastName: o.billing?.last_name || '',
                  },
                })
              } catch {
                // Race condition: customer already created between our check and create
                customer = await prisma.customer.findUnique({ where: { email: customerEmail } }) ?? null
              }
            }
          }
        }

        await prisma.order.upsert({
          where: { id: o.id },
          create: {
            id: o.id,
            date: new Date(o.date_created),
            customerId: customer?.id ?? null,
            customerEmail,
            customerName,
            total: parseFloat(o.total) || 0,
            shippingTotal: parseFloat(o.shipping_total) || 0,
            shippingMethod,
            status: o.status,
            syncedAt: new Date(),
          },
          update: {
            customerId: customer?.id ?? null,
            status: o.status,
            total: parseFloat(o.total) || 0,
            shippingTotal: parseFloat(o.shipping_total) || 0,
            shippingMethod,
            syncedAt: new Date(),
          },
        })

        await prisma.orderItem.deleteMany({ where: { orderId: o.id } })
        for (const item of o.line_items || []) {
          const productId = item.product_id && existingProductIds.has(item.product_id)
            ? item.product_id
            : null
          await prisma.orderItem.create({
            data: {
              orderId: o.id,
              productId,
              name: item.name,
              quantity: item.quantity,
              total: parseFloat(item.total) || 0,
              sku: item.sku || null,
            },
          })
        }

        if (o.status !== 'cancelled' && o.status !== 'refunded') {
          for (const item of o.line_items || []) {
            if (item.product_id) {
              const product = await prisma.product.findUnique({ where: { id: item.product_id } })
              if (product) {
                const orderDate = new Date(o.date_created)
                if (!product.firstOrderDate || orderDate < product.firstOrderDate) {
                  await prisma.product.update({
                    where: { id: item.product_id },
                    data: { firstOrderDate: orderDate },
                  })
                }
              }
            }
          }
        }
      }

      count += orders.length
      page++
    }

    await tagLogoTekstCustomers()

    await prisma.syncLog.create({
      data: { type: 'orders', status: 'success', itemCount: count },
    })

    return { count }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await prisma.syncLog.create({
      data: { type: 'orders', status: 'failed', message },
    })
    return { count: 0, error: message }
  }
}

async function tagLogoTekstCustomers() {
  const logoTekstItems = await prisma.orderItem.findMany({
    where: {
      OR: [
        { name: { contains: 'logo' } },
        { name: { contains: 'tekst' } },
        { name: { contains: 'Logo' } },
        { name: { contains: 'Tekst' } },
      ],
    },
    select: { order: { select: { status: true, customerId: true } } },
  })

  const customerIds = new Set(
    logoTekstItems
      .filter((i) => i.order.status !== 'cancelled' && i.order.status !== 'refunded')
      .map((i) => i.order.customerId)
      .filter(Boolean) as number[]
  )

  for (const customerId of customerIds) {
    const customer = await prisma.customer.findUnique({ where: { id: customerId } })
    if (!customer) continue

    const tags: string[] = JSON.parse(customer.tags || '[]')
    if (!tags.includes('logo_buyer')) {
      tags.push('logo_buyer')
      await prisma.customer.update({
        where: { id: customerId },
        data: { tags: JSON.stringify(tags) },
      })
    }
  }
}
