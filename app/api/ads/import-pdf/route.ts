import { NextResponse } from 'next/server'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const _pdfParse = require('pdf-parse')
// pdf-parse exports the function as .default in ESM contexts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pdfParse: (buf: Buffer) => Promise<{ text: string }> = (_pdfParse as any).default ?? _pdfParse

const MONTHS_NL: Record<string, number> = {
  januari: 1, februari: 2, maart: 3, april: 4, mei: 5, juni: 6,
  juli: 7, augustus: 8, september: 9, oktober: 10, november: 11, december: 12,
}

function parseMoney(s: string): number {
  const cleaned = s.replace(/[€\s]/g, '')
  // Dutch: 1.234,56
  if (/^\d{1,3}(\.\d{3})*(,\d+)?$/.test(cleaned)) {
    return parseFloat(cleaned.replace(/\./g, '').replace(',', '.'))
  }
  return parseFloat(cleaned.replace(',', '.'))
}

function extractFromText(text: string): { year: number | null; month: number | null; amountExclBtw: number | null } {
  let year: number | null = null
  let month: number | null = null
  let amountExclBtw: number | null = null

  // --- Period extraction ---
  // "Facturatieperiode: 1 jan. 2025 – 31 jan. 2025"
  // "Factuurperiode: 01-01-2025 t/m 31-01-2025"
  // "jan 2025" / "januari 2025"

  const periodeNumeric = text.match(/(?:periode|period)[^\d]*(\d{1,2})[/-](\d{2})[/-](\d{4})/i)
  if (periodeNumeric) {
    month = parseInt(periodeNumeric[2])
    year = parseInt(periodeNumeric[3])
  }

  if (!month) {
    const periodeText = text.match(/(?:periode|period)[^\n]*?(\w+)\s+(20\d{2})/i)
    if (periodeText) {
      month = MONTHS_NL[periodeText[1].toLowerCase()] ?? null
      year = parseInt(periodeText[2])
    }
  }

  // "Factuurdatum" / "Betalingsdatum"
  if (!month) {
    const factuur = text.match(/(?:factuur|invoice)[^\d]*(\d{1,2})[/-](\d{2})[/-](\d{4})/i)
    if (factuur) {
      month = parseInt(factuur[2])
      year = parseInt(factuur[3])
    }
  }

  // Month name anywhere: "februari 2025"
  if (!month) {
    for (const [name, num] of Object.entries(MONTHS_NL)) {
      const m = text.match(new RegExp(`${name}\\.?\\s+(20\\d{2})`, 'i'))
      if (m) { month = num; year = parseInt(m[1]); break }
    }
  }

  // --- Amount extraction ---
  // Google Ads invoices may show:
  // "Totale kosten   € 1.234,56"
  // "Subtotaal   € 1.234,56"
  // "Totaal (excl. btw)   1.234,56"
  // "Totale advertentiekosten   1.234,56"

  const amountPatterns = [
    /[Tt]otale?\s+(?:advertentie)?kosten[^\d€\n]*([\d.,]+)/,
    /[Ss]ubtotaal[^\d€\n]*([\d.,]+)/,
    /[Tt]otaal\s*(?:\(excl\.?\s*(?:btw|btw\.?)\))?[^\d€\n]*([\d.,]+)/,
    /[Aa]mount\s+due[^\d€\n]*([\d.,]+)/,
    /[Tt]otal\s+(?:costs?|charges?)[^\d€\n]*([\d.,]+)/,
  ]

  for (const pat of amountPatterns) {
    const m = text.match(pat)
    if (m) {
      const parsed = parseMoney(m[1])
      if (!isNaN(parsed) && parsed > 0) { amountExclBtw = parsed; break }
    }
  }

  // Fallback: largest plausible amount on a "totaal/kosten" line
  if (!amountExclBtw) {
    for (const line of text.split('\n')) {
      if (/totaal|kosten|subtotaal|total|cost/i.test(line) && !/btw|tax|vat/i.test(line)) {
        const amounts = [...line.matchAll(/([\d]{1,3}(?:[.,]\d{3})*[.,]\d{2})/g)]
          .map((m) => parseMoney(m[1]))
          .filter((n) => !isNaN(n) && n > 1)
        if (amounts.length > 0) { amountExclBtw = Math.max(...amounts); break }
      }
    }
  }

  return { year, month, amountExclBtw }
}

export async function POST(req: Request) {
  try {
    const form = await req.formData()
    const file = form.get('file')
    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'Geen bestand ontvangen' }, { status: 400 })
    }

    const f = file as File
    const buffer = Buffer.from(await f.arrayBuffer())
    const pdf = await pdfParse(buffer)
    const text: string = pdf.text

    const { year, month, amountExclBtw } = extractFromText(text)

    return NextResponse.json({
      ok: true,
      filename: f.name,
      year,
      month,
      amountExclBtw,
      textSnippet: text.slice(0, 1000).replace(/\s+/g, ' '),
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
