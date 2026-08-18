import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import axios from 'axios'

export async function POST() {
  try {
    const baseURL = process.env.WOOCOMMERCE_URL
    const consumerKey = process.env.WOOCOMMERCE_CONSUMER_KEY
    const consumerSecret = process.env.WOOCOMMERCE_CONSUMER_SECRET

    if (!baseURL || !consumerKey || !consumerSecret) {
      return NextResponse.json({ error: 'WooCommerce credentials niet ingesteld.' }, { status: 400 })
    }

    const client = axios.create({
      baseURL: `${baseURL}/wp-json/wc/v3`,
      auth: { username: consumerKey, password: consumerSecret },
      timeout: 60000,
    })

    let page = 1
    let updated = 0
    let totalFetched = 0

    while (true) {
      const res = await client.get<{ id: number; number: string }[]>('/orders', {
        params: { per_page: 100, page, _fields: 'id,number', status: 'any' },
      })

      const orders = res.data
      if (!orders.length) break

      totalFetched += orders.length

      // Batch all updates for this page in a single transaction
      const results = await prisma.$transaction(
        orders
          .filter(o => !!o.number)
          .map(o => prisma.order.updateMany({ where: { id: o.id }, data: { orderNumber: o.number } }))
      )
      updated += results.reduce((sum, r) => sum + r.count, 0)

      const totalPages = parseInt(res.headers['x-wp-totalpages'] || '1', 10)
      if (page >= totalPages) break
      page++
    }

    return NextResponse.json({ ok: true, totalFetched, updated })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
