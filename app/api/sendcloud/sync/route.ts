import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import axios from 'axios'

interface SendcloudParcel {
  id: number
  order_number: string
  tracking_number: string | null
  price: { value: string; currency: string } | null
  status: { id: number; message: string }
  created_at: string
}

interface SendcloudResponse {
  parcels: SendcloudParcel[]
  next?: string | null
}

async function fetchParcels(publicKey: string, secretKey: string, page: number): Promise<SendcloudResponse> {
  const auth = Buffer.from(`${publicKey}:${secretKey}`).toString('base64')
  const res = await fetch(`https://panel.sendcloud.sc/api/v2/parcels?page=${page}&page_size=100`, {
    headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`SendCloud API fout ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json()
}

async function getSetting(key: string): Promise<string | null> {
  const s = await prisma.settings.findUnique({ where: { key } })
  return s?.value ?? null
}

// Build a lookup map: every known form of an order number → DB order id
async function buildOrderMap(): Promise<Map<string, number>> {
  const map = new Map<string, number>()

  const wcUrl = process.env.WOOCOMMERCE_URL
  const wcKey = process.env.WOOCOMMERCE_CONSUMER_KEY
  const wcSecret = process.env.WOOCOMMERCE_CONSUMER_SECRET

  if (wcUrl && wcKey && wcSecret) {
    // Fetch all WC orders (id + number) in parallel batches of 5 pages
    const client = axios.create({
      baseURL: `${wcUrl}/wp-json/wc/v3`,
      auth: { username: wcKey, password: wcSecret },
      timeout: 30000,
    })

    const first = await client.get<{ id: number; number: string }[]>('/orders', {
      params: { per_page: 100, page: 1, _fields: 'id,number', status: 'any' },
    })
    const totalPages = parseInt(first.headers['x-wp-totalpages'] || '1', 10)
    const wcOrders: { id: number; number: string }[] = [...first.data]

    for (let start = 2; start <= totalPages; start += 5) {
      const pages = Array.from({ length: Math.min(5, totalPages - start + 1) }, (_, i) => start + i)
      const results = await Promise.all(
        pages.map(p => client.get<{ id: number; number: string }[]>('/orders', {
          params: { per_page: 100, page: p, _fields: 'id,number', status: 'any' },
        }))
      )
      for (const r of results) wcOrders.push(...r.data)
    }

    // Populate map with all known representations
    for (const o of wcOrders) {
      if (!o.number) continue
      const num = o.number.trim()
      map.set(num, o.id)                             // "KL-176814" or "176814"
      map.set(num.replace(/[^0-9]/g, ''), o.id)      // "176814" (digits only)
    }

    // Backfill orderNumber in DB as a side-effect (no await on individual, batch it)
    const chunks: { id: number; number: string }[][] = []
    for (let i = 0; i < wcOrders.length; i += 100) {
      chunks.push(wcOrders.slice(i, i + 100).filter(o => !!o.number))
    }
    for (const chunk of chunks) {
      await prisma.$transaction(
        chunk.map(o => prisma.order.updateMany({ where: { id: o.id }, data: { orderNumber: o.number } }))
      ).catch(() => { /* ignore backfill errors */ })
    }
  } else {
    // Fallback: use already-stored orderNumbers from DB
    const orders = await prisma.order.findMany({ select: { id: true, orderNumber: true } })
    for (const o of orders) {
      if (!o.orderNumber) continue
      const num = o.orderNumber.trim()
      map.set(num, o.id)
      map.set(num.replace(/[^0-9]/g, ''), o.id)
    }
  }

  return map
}

export async function POST() {
  try {
    const publicKey = await getSetting('sendcloud_public_key')
    const secretKey = await getSetting('sendcloud_secret_key')

    if (!publicKey || !secretKey) {
      return NextResponse.json({ error: 'SendCloud API-sleutels niet ingesteld.' }, { status: 400 })
    }

    // Build order number → DB id mapping
    const orderMap = await buildOrderMap()

    // Collect all SendCloud parcels
    let page = 1
    let totalFetched = 0
    const costByOrderId = new Map<number, number>() // db order id → shipping cost

    while (true) {
      const data = await fetchParcels(publicKey, secretKey, page)
      const parcels = data.parcels ?? []
      totalFetched += parcels.length

      for (const parcel of parcels) {
        if (!parcel.order_number || !parcel.price?.value) continue
        const cost = parseFloat(parcel.price.value)
        if (isNaN(cost) || cost <= 0) continue

        const raw = parcel.order_number.trim()
        const digits = raw.replace(/[^0-9]/g, '')

        const dbId = orderMap.get(raw) ?? orderMap.get(digits)
        if (dbId !== undefined) {
          // Keep the highest cost if a parcel appears multiple times for the same order
          costByOrderId.set(dbId, (costByOrderId.get(dbId) ?? 0) + cost)
        }
      }

      if (parcels.length < 100) break
      page++
      if (page > 50) break
    }

    // Batch-update all matched orders
    let updated = 0
    const entries = [...costByOrderId.entries()]
    for (let i = 0; i < entries.length; i += 100) {
      const chunk = entries.slice(i, i + 100)
      const results = await prisma.$transaction(
        chunk.map(([id, cost]) => prisma.order.updateMany({ where: { id }, data: { sendcloudCost: cost } }))
      )
      updated += results.reduce((sum, r) => sum + r.count, 0)
    }

    const skipped = totalFetched - [...costByOrderId.values()].length

    await prisma.syncLog.create({
      data: { type: 'sendcloud', status: 'success', message: `${updated} zendingen bijgewerkt`, itemCount: updated },
    })

    return NextResponse.json({ ok: true, updated, skipped, totalFetched, mapSize: orderMap.size })
  } catch (err) {
    await prisma.syncLog.create({
      data: { type: 'sendcloud', status: 'failed', message: String(err), itemCount: 0 },
    })
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
