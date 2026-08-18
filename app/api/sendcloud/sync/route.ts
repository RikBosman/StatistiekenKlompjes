import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

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

function extractNumericId(orderNumber: string): number | null {
  if (!orderNumber) return null
  const direct = parseInt(orderNumber)
  if (!isNaN(direct) && String(direct) === orderNumber.trim()) return direct
  const digits = orderNumber.replace(/[^0-9]/g, '')
  if (!digits) return null
  return parseInt(digits)
}

export async function POST() {
  try {
    const publicKey = await getSetting('sendcloud_public_key')
    const secretKey = await getSetting('sendcloud_secret_key')

    if (!publicKey || !secretKey) {
      return NextResponse.json({ error: 'SendCloud API-sleutels niet ingesteld.' }, { status: 400 })
    }

    let page = 1
    let updated = 0
    let skipped = 0
    let totalFetched = 0
    const sampleOrderNumbers: string[] = []

    while (true) {
      const data = await fetchParcels(publicKey, secretKey, page)
      const parcels = data.parcels ?? []
      totalFetched += parcels.length

      for (const parcel of parcels) {
        // Collect samples from first page for debugging
        if (page === 1 && sampleOrderNumbers.length < 5 && parcel.order_number) {
          sampleOrderNumbers.push(`"${parcel.order_number}" (price: ${parcel.price?.value ?? 'null'})`)
        }

        if (!parcel.order_number || !parcel.price?.value) { skipped++; continue }

        const cost = parseFloat(parcel.price.value)
        if (isNaN(cost) || cost <= 0) { skipped++; continue }

        const rawNumber = parcel.order_number.trim()

        // Strategy 1: match on WooCommerce orderNumber field (exact, or numeric part)
        let result = await prisma.order.updateMany({
          where: { orderNumber: rawNumber },
          data: { sendcloudCost: cost },
        })

        if (result.count === 0) {
          // Strategy 2: extract digits and match numeric part of orderNumber
          const numericStr = rawNumber.replace(/[^0-9]/g, '')
          if (numericStr) {
            result = await prisma.order.updateMany({
              where: { orderNumber: numericStr },
              data: { sendcloudCost: cost },
            })
          }
        }

        if (result.count === 0) {
          // Strategy 3: fall back to matching by post id
          const orderId = extractNumericId(rawNumber)
          if (orderId) {
            result = await prisma.order.updateMany({
              where: { id: orderId },
              data: { sendcloudCost: cost },
            })
          }
        }

        if (result.count > 0) updated++
        else skipped++
      }

      if (parcels.length < 100) break
      page++
      if (page > 50) break
    }

    await prisma.syncLog.create({
      data: { type: 'sendcloud', status: 'success', message: `${updated} zendingen bijgewerkt`, itemCount: updated },
    })

    return NextResponse.json({ ok: true, updated, skipped, totalFetched, sampleOrderNumbers })
  } catch (err) {
    await prisma.syncLog.create({
      data: { type: 'sendcloud', status: 'failed', message: String(err), itemCount: 0 },
    })
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
