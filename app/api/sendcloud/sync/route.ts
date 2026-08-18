import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

interface SendcloudParcel {
  price: { value: string; currency: string } | null
  // created_at field may vary — we check multiple names
  created_at?: string
  date_created?: string
  date?: string
  [key: string]: unknown
}

interface SendcloudResponse {
  parcels: SendcloudParcel[]
}

async function getSetting(key: string): Promise<string | null> {
  const s = await prisma.settings.findUnique({ where: { key } })
  return s?.value ?? null
}

function getParcelDate(parcel: SendcloudParcel): Date | null {
  const raw = parcel.created_at ?? parcel.date_created ?? parcel.date
  if (!raw) return null
  const d = new Date(raw as string)
  return isNaN(d.getTime()) ? null : d
}

async function fetchPage(auth: string, page: number): Promise<SendcloudParcel[]> {
  const res = await fetch(
    `https://panel.sendcloud.sc/api/v2/parcels?page=${page}&page_size=100`,
    { headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' } }
  )
  if (!res.ok) throw new Error(`SendCloud ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const data: SendcloudResponse = await res.json()
  return data.parcels ?? []
}

export async function POST() {
  try {
    const publicKey = await getSetting('sendcloud_public_key')
    const secretKey = await getSetting('sendcloud_secret_key')
    if (!publicKey || !secretKey) {
      return NextResponse.json({ error: 'SendCloud API-sleutels niet ingesteld.' }, { status: 400 })
    }

    const auth = Buffer.from(`${publicKey}:${secretKey}`).toString('base64')

    const costByMonth = new Map<string, number>() // "2025-04" → total
    let totalFetched = 0
    let skippedNoPrice = 0
    let skippedNoDate = 0
    let sampleParcelKeys: string[] = []

    let page = 1
    while (true) {
      const parcels = await fetchPage(auth, page)
      if (!parcels.length) break
      totalFetched += parcels.length

      // Capture field names from first parcel for debugging
      if (page === 1 && parcels.length > 0 && sampleParcelKeys.length === 0) {
        sampleParcelKeys = Object.keys(parcels[0]).slice(0, 15)
      }

      for (const parcel of parcels) {
        if (!parcel.price?.value) { skippedNoPrice++; continue }
        const cost = parseFloat(parcel.price.value)
        if (isNaN(cost) || cost <= 0) { skippedNoPrice++; continue }

        const d = getParcelDate(parcel)
        if (!d) { skippedNoDate++; continue }

        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        costByMonth.set(key, (costByMonth.get(key) ?? 0) + cost)
      }

      if (parcels.length < 100) break
      page++
      if (page > 50) break
    }

    // Upsert monthly totals into ShippingInvoice
    let savedMonths = 0
    const monthResults: string[] = []
    for (const [key, total] of [...costByMonth.entries()].sort()) {
      const [year, month] = key.split('-').map(Number)
      await prisma.shippingInvoice.upsert({
        where: { year_month: { year, month } },
        create: { year, month, amountExclBtw: Math.round(total * 100) / 100, filename: 'SendCloud API' },
        update: { amountExclBtw: Math.round(total * 100) / 100, filename: 'SendCloud API' },
      })
      savedMonths++
      monthResults.push(`${key}: €${total.toFixed(2)}`)
    }

    await prisma.syncLog.create({
      data: { type: 'sendcloud', status: 'success', message: `${savedMonths} maanden opgeslagen`, itemCount: savedMonths },
    })

    return NextResponse.json({
      ok: true,
      totalFetched,
      savedMonths,
      skippedNoPrice,
      skippedNoDate,
      months: monthResults,
      debugParcelFields: sampleParcelKeys,
    })
  } catch (err) {
    await prisma.syncLog.create({
      data: { type: 'sendcloud', status: 'failed', message: String(err), itemCount: 0 },
    })
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
