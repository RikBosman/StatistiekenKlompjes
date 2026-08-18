import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

interface SendcloudInvoice {
  id: number
  date: string
  is_paid: boolean
  total_price_incl: string
  total_price_excl: string
  ref: string
  type?: string | number
  label?: string
  [key: string]: unknown
}

interface SendcloudInvoicesResponse {
  invoices: SendcloudInvoice[]
}

async function getSetting(key: string): Promise<string | null> {
  const s = await prisma.settings.findUnique({ where: { key } })
  return s?.value ?? null
}

export async function POST() {
  try {
    const publicKey = await getSetting('sendcloud_public_key')
    const secretKey = await getSetting('sendcloud_secret_key')
    if (!publicKey || !secretKey) {
      return NextResponse.json({ error: 'SendCloud API-sleutels niet ingesteld.' }, { status: 400 })
    }

    const auth = Buffer.from(`${publicKey}:${secretKey}`).toString('base64')

    const res = await fetch(
      'https://panel.sendcloud.sc/api/v2/invoices',
      { headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' } }
    )
    if (!res.ok) {
      const body = (await res.text()).slice(0, 300)
      throw new Error(`SendCloud invoices ${res.status}: ${body}`)
    }

    const data: SendcloudInvoicesResponse = await res.json()
    const invoices = data.invoices ?? []
    const sampleFields = invoices.length > 0 ? Object.keys(invoices[0]) : []

    // Group invoice amounts by month
    const costByMonth = new Map<string, number>()
    let skippedNoDate = 0
    let skippedNoAmount = 0

    for (const inv of invoices) {
      if (!inv.date) { skippedNoDate++; continue }
      const d = new Date(inv.date)
      if (isNaN(d.getTime())) { skippedNoDate++; continue }

      // Prefer excl. BTW; fall back to incl. BTW
      const raw = inv.total_price_excl ?? inv.total_price_incl
      if (!raw) { skippedNoAmount++; continue }
      const amount = parseFloat(String(raw))
      if (isNaN(amount) || amount <= 0) { skippedNoAmount++; continue }

      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      costByMonth.set(key, (costByMonth.get(key) ?? 0) + amount)
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
      totalFetched: invoices.length,
      savedMonths,
      skippedNoDate,
      skippedNoAmount,
      months: monthResults,
      debugInvoiceFields: sampleFields,
    })
  } catch (err) {
    await prisma.syncLog.create({
      data: { type: 'sendcloud', status: 'failed', message: String(err), itemCount: 0 },
    })
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
