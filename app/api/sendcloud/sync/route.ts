import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

interface SendcloudInvoice {
  id: number
  date?: string | null
  isPayed?: boolean
  price_incl?: string | number | null
  price_excl?: string | number | null
  ref?: string
  type?: string | number
  items?: unknown[]
  [key: string]: unknown
}

interface SendcloudInvoicesResponse {
  invoices: SendcloudInvoice[]
}

function parseInvoiceDate(raw: string): Date | null {
  // Try standard ISO parsing first
  let d = new Date(raw)
  if (!isNaN(d.getTime())) return d
  // Dutch format: DD-MM-YYYY HH:MM:SS
  const m = raw.match(/^(\d{2})-(\d{2})-(\d{4})/)
  if (m) {
    d = new Date(`${m[3]}-${m[2]}-${m[1]}`)
    if (!isNaN(d.getTime())) return d
  }
  return null
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
      'https://panel.sendcloud.sc/api/v2/user/invoices',
      { headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' } }
    )
    if (!res.ok) {
      const body = (await res.text()).slice(0, 300)
      throw new Error(`SendCloud ${res.status}: ${body}`)
    }

    const data: SendcloudInvoicesResponse = await res.json()
    const invoices = data.invoices ?? []
    const sampleFields = invoices.length > 0 ? Object.keys(invoices[0]) : []
    const sampleInvoice = invoices[0] ?? null

    // Group invoice amounts by month using invoice date
    const now = new Date()
    const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    const costByMonth = new Map<string, number>()
    let skippedNoDate = 0
    let skippedNoAmount = 0
    let skippedFuture = 0
    const noDateSamples: unknown[] = []

    for (const inv of invoices) {
      if (!inv.date) {
        if (noDateSamples.length < 5) noDateSamples.push({ id: inv.id, ref: inv.ref, type: inv.type, date: inv.date, price_excl: inv.price_excl })
        skippedNoDate++; continue
      }
      const d = parseInvoiceDate(inv.date as string)
      if (!d) {
        if (noDateSamples.length < 5) noDateSamples.push({ id: inv.id, ref: inv.ref, type: inv.type, date: inv.date, price_excl: inv.price_excl, parseError: 'invalid date' })
        skippedNoDate++; continue
      }

      // Prefer excl. BTW; fall back to incl. BTW
      const raw = inv.price_excl ?? inv.price_incl
      if (!raw) { skippedNoAmount++; continue }
      const amount = parseFloat(String(raw))
      if (isNaN(amount) || amount <= 0) { skippedNoAmount++; continue }

      const key = `${d!.getFullYear()}-${String(d!.getMonth() + 1).padStart(2, '0')}`
      // Skip future months
      if (key > currentYM) { skippedFuture++; continue }
      costByMonth.set(key, (costByMonth.get(key) ?? 0) + amount)
    }

    // Remove any future months that may have been saved by earlier syncs
    const [currentYear, currentMonth] = currentYM.split('-').map(Number)
    await prisma.shippingInvoice.deleteMany({
      where: {
        filename: 'SendCloud API',
        OR: [
          { year: { gt: currentYear } },
          { year: currentYear, month: { gt: currentMonth } },
        ],
      },
    })

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
      skippedFuture,
      months: monthResults,
      debugFields: sampleFields,
      debugSample: sampleInvoice,
      noDateSamples,
    })
  } catch (err) {
    await prisma.syncLog.create({
      data: { type: 'sendcloud', status: 'failed', message: String(err), itemCount: 0 },
    })
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
