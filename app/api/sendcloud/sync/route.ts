import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

interface SendcloudParcel {
  price: { value: string; currency: string } | null
  created_at: string
}

interface SendcloudResponse {
  parcels: SendcloudParcel[]
}

async function fetchParcels(publicKey: string, secretKey: string, page: number, from?: string, to?: string): Promise<SendcloudResponse> {
  const auth = Buffer.from(`${publicKey}:${secretKey}`).toString('base64')
  const params = new URLSearchParams({ page: String(page), page_size: '100' })
  if (from) params.set('created_at_date_from', from)
  if (to) params.set('created_at_date_to', to)
  const res = await fetch(`https://panel.sendcloud.sc/api/v2/parcels?${params}`, {
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

export async function POST(req: Request) {
  try {
    const publicKey = await getSetting('sendcloud_public_key')
    const secretKey = await getSetting('sendcloud_secret_key')

    if (!publicKey || !secretKey) {
      return NextResponse.json({ error: 'SendCloud API-sleutels niet ingesteld.' }, { status: 400 })
    }

    let from: string | undefined
    let to: string | undefined
    try {
      const body = await req.json()
      from = body.from ?? undefined
      to = body.to ?? undefined
    } catch { /* no body */ }

    // Fetch all parcels and group costs by year+month
    let page = 1
    let totalFetched = 0
    const costByMonth = new Map<string, number>() // "2025-04" → total cost

    while (true) {
      const data = await fetchParcels(publicKey, secretKey, page, from, to)
      const parcels = data.parcels ?? []
      totalFetched += parcels.length

      for (const parcel of parcels) {
        if (!parcel.price?.value || !parcel.created_at) continue
        const cost = parseFloat(parcel.price.value)
        if (isNaN(cost) || cost <= 0) continue

        const date = new Date(parcel.created_at)
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        costByMonth.set(key, (costByMonth.get(key) ?? 0) + cost)
      }

      if (parcels.length < 100) break
      page++
      if (page > 50) break
    }

    // Upsert monthly totals into ShippingInvoice table
    let savedMonths = 0
    for (const [key, total] of costByMonth.entries()) {
      const [year, month] = key.split('-').map(Number)
      await prisma.shippingInvoice.upsert({
        where: { year_month: { year, month } },
        create: { year, month, amountExclBtw: total, filename: 'SendCloud API' },
        update: { amountExclBtw: total, filename: 'SendCloud API' },
      })
      savedMonths++
    }

    await prisma.syncLog.create({
      data: { type: 'sendcloud', status: 'success', message: `${savedMonths} maanden opgeslagen`, itemCount: savedMonths },
    })

    return NextResponse.json({ ok: true, totalFetched, savedMonths, months: [...costByMonth.entries()].map(([k, v]) => `${k}: €${v.toFixed(2)}`) })
  } catch (err) {
    await prisma.syncLog.create({
      data: { type: 'sendcloud', status: 'failed', message: String(err), itemCount: 0 },
    })
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
