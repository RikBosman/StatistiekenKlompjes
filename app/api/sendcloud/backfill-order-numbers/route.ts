import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import axios from 'axios'

const PARALLEL = 5 // fetch 5 WC pages concurrently

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
      timeout: 30000,
    })

    // Fetch first page to get total page count
    const first = await client.get<{ id: number; number: string }[]>('/orders', {
      params: { per_page: 100, page: 1, _fields: 'id,number', status: 'any' },
    })
    const totalPages = parseInt(first.headers['x-wp-totalpages'] || '1', 10)
    const allOrders: { id: number; number: string }[] = [...first.data]

    // Fetch remaining pages in parallel batches
    for (let startPage = 2; startPage <= totalPages; startPage += PARALLEL) {
      const pages = Array.from(
        { length: Math.min(PARALLEL, totalPages - startPage + 1) },
        (_, i) => startPage + i
      )
      const results = await Promise.all(
        pages.map(p =>
          client.get<{ id: number; number: string }[]>('/orders', {
            params: { per_page: 100, page: p, _fields: 'id,number', status: 'any' },
          })
        )
      )
      for (const r of results) allOrders.push(...r.data)
    }

    // Batch-update DB in chunks of 100 per transaction
    let updated = 0
    for (let i = 0; i < allOrders.length; i += 100) {
      const chunk = allOrders.slice(i, i + 100).filter(o => !!o.number)
      const results = await prisma.$transaction(
        chunk.map(o => prisma.order.updateMany({ where: { id: o.id }, data: { orderNumber: o.number } }))
      )
      updated += results.reduce((sum, r) => sum + r.count, 0)
    }

    return NextResponse.json({ ok: true, totalFetched: allOrders.length, updated })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
