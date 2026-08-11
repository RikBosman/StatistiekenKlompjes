import { prisma } from './db'
import { fetchProducts, fetchOrders } from './woocommerce'

export async function syncProducts(): Promise<{ count: number; error?: string }> {
  try {
    const products = await fetchProducts()

    for (const p of products) {
      const cogsMeta = p.meta_data?.find(
        (m) => m.key === '_wc_cog_cost' || m.key === '_cogs_cost' || m.key === 'cost_of_goods'
      )
      const cogs = cogsMeta ? parseFloat(cogsMeta.value) || null : null

      await prisma.product.upsert({
        where: { id: p.id },
        create: {
          id: p.id,
          name: p.name,
          sku: p.sku || null,
          cogs,
          createdAt: new Date(p.date_created),
          status: p.status,
          categories: JSON.stringify(p.categories.map((c) => c.name)),
          syncedAt: new Date(),
        },
        update: {
          name: p.name,
          sku: p.sku || null,
          cogs,
          status: p.status,
          categories: JSON.stringify(p.categories.map((c) => c.name)),
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

export async function syncOrders(): Promise<{ count: number; error?: string }> {
  try {
    // Find last synced order date to do incremental sync
    const lastOrder = await prisma.order.findFirst({
      orderBy: { date: 'desc' },
    })

    const afterDate = lastOrder
      ? new Date(lastOrder.date.getTime() - 24 * 60 * 60 * 1000).toISOString()
      : undefined

    const orders = await fetchOrders(afterDate)

    for (const o of orders) {
      const customerEmail = o.billing?.email || ''
      const customerName = `${o.billing?.first_name || ''} ${o.billing?.last_name || ''}`.trim()

      // Upsert customer
      let customer = null
      if (o.customer_id && customerEmail) {
        customer = await prisma.customer.upsert({
          where: { id: o.customer_id },
          create: {
            id: o.customer_id,
            email: customerEmail,
            firstName: o.billing?.first_name || '',
            lastName: o.billing?.last_name || '',
          },
          update: {
            email: customerEmail,
            firstName: o.billing?.first_name || '',
            lastName: o.billing?.last_name || '',
          },
        })
      }

      // Upsert order
      await prisma.order.upsert({
        where: { id: o.id },
        create: {
          id: o.id,
          date: new Date(o.date_created),
          customerId: customer?.id || null,
          customerEmail,
          customerName,
          total: parseFloat(o.total) || 0,
          shippingTotal: parseFloat(o.shipping_total) || 0,
          status: o.status,
          syncedAt: new Date(),
        },
        update: {
          status: o.status,
          total: parseFloat(o.total) || 0,
          shippingTotal: parseFloat(o.shipping_total) || 0,
          syncedAt: new Date(),
        },
      })

      // Sync line items
      await prisma.orderItem.deleteMany({ where: { orderId: o.id } })
      for (const item of o.line_items || []) {
        await prisma.orderItem.create({
          data: {
            orderId: o.id,
            productId: item.product_id || null,
            name: item.name,
            quantity: item.quantity,
            total: parseFloat(item.total) || 0,
            sku: item.sku || null,
          },
        })
      }

      // Update first order date on product
      if (o.status !== 'cancelled' && o.status !== 'refunded') {
        for (const item of o.line_items || []) {
          if (item.product_id) {
            const product = await prisma.product.findUnique({
              where: { id: item.product_id },
            })
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

    // Tag logo/tekst customers
    await tagLogoTekstCustomers()

    await prisma.syncLog.create({
      data: { type: 'orders', status: 'success', itemCount: orders.length },
    })

    return { count: orders.length }
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
      order: { status: { notIn: ['cancelled', 'refunded'] } },
    },
    include: { order: true },
  })

  const customerIds = new Set(
    logoTekstItems.map((i) => i.order.customerId).filter(Boolean) as number[]
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
