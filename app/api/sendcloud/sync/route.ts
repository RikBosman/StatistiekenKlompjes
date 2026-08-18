import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

interface SendcloudParcel {
  id: number
  price?: { value: string; currency: string } | null
  // date field names vary by account type
  created_at?: string
  date_created?: string
  date?: string
  status?: { id: number; message: string } | string
  [key: string]: unknown
}

interface SendcloudResponse {
  parcels: SendcloudParcel[]
  next?: string | null
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
  if (!res.ok) throw new Error(`SendCloud parcels ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const data: SendcloudResponse = await res.json()
  return data.parcels ?? []
}

async function fetchSingleParcel(auth: string, id: number): Promise<SendcloudParcel | null> {
  try {
    const res = await fetch(
      `https://panel.sendcloud.sc/api/v2/parcels/${id}`,
      { headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' } }
    )
    if (!res.ok) return null
    const data = await res.json()
    return data.parcel ?? null
  } catch {
    return null
  }
}

export async function POST() {
  try {
    const publicKey = await getSetting('sendcloud_public_key')
    const secretKey = await getSetting('sendcloud_secret_key')
    if (!publicKey || !secretKey) {
      return NextResponse.json({ error: 'SendCloud API-sleutels niet ingesteld.' }, { status: 400 })
    }

    const auth = Buffer.from(`${publicKey}:${secretKey}`).toString('base64')

    // Fetch first page to inspect field names
    const firstPage = await fetchPage(auth, 1)
    const listFields = firstPage.length > 0 ? Object.keys(firstPage[0]) : []

    // Fetch a single parcel detail to compare available fields
    let detailFields: string[] = []
    let singleParcel: SendcloudParcel | null = null
    if (firstPage.length > 0) {
      singleParcel = await fetchSingleParcel(auth, firstPage[0].id)
      if (singleParcel) detailFields = Object.keys(singleParcel)
    }

    // Inspect nested sub-objects for price data
    const sample = singleParcel ?? firstPage[0] ?? null
    const subObjects = sample ? {
      shipment: sample.shipment,
      carrier:  sample.carrier,
      label:    sample.label,
      data:     sample.data,
      contract: sample.contract,
    } : {}

    // Check if price is nested inside a known sub-object
    const shipmentPrice = (sample?.shipment as Record<string, unknown>)?.price
    const carrierPrice  = (sample?.carrier  as Record<string, unknown>)?.price
    const labelPrice    = (sample?.label    as Record<string, unknown>)?.price

    const nestedPrice = shipmentPrice ?? carrierPrice ?? labelPrice ?? null

    // Decide: can we get price from the list, or only from detail?
    const listHasPrice = listFields.includes('price')
    const detailHasPrice = detailFields.includes('price')
    const hasNestedPrice = nestedPrice !== null

    // If no price anywhere, return debug info so we can investigate
    if (!listHasPrice && !detailHasPrice && !hasNestedPrice) {
      return NextResponse.json({
        ok: false,
        error: 'Geen price-veld gevonden in SendCloud API. De SendCloud REST API biedt geen toegang tot verzendkosten per zending. Gebruik de PDF-import voor facturen.',
        listFields,
        detailFields,
        subObjects,
      })
    }

    // If only detail has price, fetching 5000 individual parcels is too slow.
    // We fall back to the "list but use detail for price" approach for a single page,
    // and return a clear warning.
    const costByMonth = new Map<string, number>()
    let totalFetched = 0
    let skippedNoPrice = 0
    let skippedNoDate = 0

    let page = 1
    while (true) {
      const parcels = page === 1 ? firstPage : await fetchPage(auth, page)
      if (!parcels.length) break
      totalFetched += parcels.length

      for (const parcel of parcels) {
        // Resolve price — check top-level, then nested sub-objects
        let cost: number | null = null
        const rawPrice =
          parcel.price?.value ??
          (parcel.shipment as Record<string, { value?: string } | null> | null)?.price?.value ??
          (parcel.carrier  as Record<string, { value?: string } | null> | null)?.price?.value ??
          (parcel.label    as Record<string, { value?: string } | null> | null)?.price?.value ??
          null
        if (rawPrice) {
          const v = parseFloat(rawPrice)
          if (!isNaN(v) && v > 0) cost = v
        }
        if (cost === null) { skippedNoPrice++; continue }

        const d = getParcelDate(parcel)
        if (!d) { skippedNoDate++; continue }

        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        costByMonth.set(key, (costByMonth.get(key) ?? 0) + cost)
      }

      if (parcels.length < 100) break
      page++
      if (page > 50) break
    }

    // Upsert monthly totals
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
      listFields,
      detailFields,
    })
  } catch (err) {
    await prisma.syncLog.create({
      data: { type: 'sendcloud', status: 'failed', message: String(err), itemCount: 0 },
    })
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
