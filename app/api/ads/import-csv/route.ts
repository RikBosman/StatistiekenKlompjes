import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// Parse a Google Ads CSV export. Handles Dutch and English column names,
// Dutch number formatting (1.234,56) and currency prefixes (€).
function parseGoogleAdsCsv(text: string): { date: Date; campaign: string; campaignId: string; spend: number; clicks: number; impressions: number }[] {
  const lines = text.split(/\r?\n/)

  // Find the header row — the first row that contains a cost/kosten column
  const costKeywords = ['kosten', 'cost', 'spend']
  const dateKeywords = ['dag', 'day', 'date', 'datum']
  let headerIdx = -1
  let headers: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const cols = splitCsvRow(lines[i])
    const lower = cols.map((c) => c.toLowerCase().trim())
    if (lower.some((c) => costKeywords.some((k) => c.includes(k))) && lower.some((c) => dateKeywords.some((k) => c.includes(k)))) {
      headerIdx = i
      headers = lower
      break
    }
  }

  if (headerIdx === -1) throw new Error('Geen geldige Google Ads kolommen gevonden (verwacht: Dag + Kosten)')

  const dateCol = headers.findIndex((h) => dateKeywords.some((k) => h.includes(k)))
  const costCol = headers.findIndex((h) => costKeywords.some((k) => h.includes(k)))
  const campCol = headers.findIndex((h) => h.includes('campagne') || h.includes('campaign'))
  const clickCol = headers.findIndex((h) => h.includes('klik') || h.includes('click'))
  const impCol = headers.findIndex((h) => h.includes('vertoning') || h.includes('impres'))

  const results = []
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cols = splitCsvRow(lines[i])
    if (!cols.length || !cols[0]) continue

    const rawDate = cols[dateCol]?.trim()
    const rawCost = cols[costCol]?.trim()
    if (!rawDate || !rawCost) continue

    // Skip totals row
    const lowerFirst = rawDate.toLowerCase()
    if (lowerFirst.startsWith('totaal') || lowerFirst.startsWith('total') || lowerFirst === '') continue

    const date = parseDate(rawDate)
    if (!date) continue

    const spend = parseMoney(rawCost)
    if (isNaN(spend)) continue

    const campaign = campCol >= 0 ? (cols[campCol]?.trim() || 'Totaal') : 'Totaal'
    const campaignId = campaign.toLowerCase().replace(/\s+/g, '_').slice(0, 64)
    const clicks = clickCol >= 0 ? parseInt(cols[clickCol]?.replace(/\D/g, '') || '0') : 0
    const impressions = impCol >= 0 ? parseInt(cols[impCol]?.replace(/\D/g, '') || '0') : 0

    results.push({ date, campaign, campaignId, spend, clicks, impressions })
  }

  return results
}

function splitCsvRow(line: string): string[] {
  const result: string[] = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') { inQ = !inQ; continue }
    if (ch === ',' && !inQ) { result.push(cur); cur = ''; continue }
    cur += ch
  }
  result.push(cur)
  return result
}

function parseMoney(s: string): number {
  // Strip currency symbols and whitespace, then handle Dutch decimal notation (1.234,56 → 1234.56)
  const cleaned = s.replace(/[€$£\s]/g, '').trim()
  // Dutch format: period = thousands sep, comma = decimal
  if (/^\d{1,3}(\.\d{3})*(,\d+)?$/.test(cleaned)) {
    return parseFloat(cleaned.replace(/\./g, '').replace(',', '.'))
  }
  // Already standard: 1234.56 or 1234
  return parseFloat(cleaned.replace(',', '.'))
}

function parseDate(s: string): Date | null {
  const t = s.trim()
  // ISO: 2025-01-15
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return new Date(t + 'T00:00:00Z')
  // Dutch short: 15 jan. 2025 or 15 jan 2025
  const monthsNl: Record<string, number> = {
    jan: 0, feb: 1, mrt: 2, mar: 2, apr: 3, mei: 4, jun: 5, jul: 6, aug: 7, sep: 8, okt: 9, oct: 9, nov: 10, dec: 11,
  }
  const m = t.match(/^(\d{1,2})\s+(\w{3})\.?\s+(\d{4})$/)
  if (m) {
    const mo = monthsNl[m[2].toLowerCase()]
    if (mo !== undefined) return new Date(Date.UTC(parseInt(m[3]), mo, parseInt(m[1])))
  }
  // English: Jan 15, 2025
  const parsed = new Date(t)
  return isNaN(parsed.getTime()) ? null : parsed
}

export async function POST(req: Request) {
  try {
    const form = await req.formData()
    const file = form.get('file')
    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'Geen bestand ontvangen' }, { status: 400 })
    }

    const text = await (file as File).text()
    const rows = parseGoogleAdsCsv(text)

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Geen datarijen gevonden in CSV. Zorg dat de CSV een "Dag" en "Kosten" kolom heeft.' }, { status: 400 })
    }

    let upserted = 0
    for (const row of rows) {
      await prisma.adSpend.upsert({
        where: { date_campaignId: { date: row.date, campaignId: row.campaignId } },
        create: row,
        update: { spend: row.spend, clicks: row.clicks, impressions: row.impressions },
      })
      upserted++
    }

    return NextResponse.json({ ok: true, rows: upserted })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
