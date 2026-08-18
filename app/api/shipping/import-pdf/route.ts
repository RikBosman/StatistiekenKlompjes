import { NextResponse } from 'next/server'

const MONTHS_NL: Record<string, number> = {
  januari: 1, februari: 2, maart: 3, april: 4, mei: 5, juni: 6,
  juli: 7, augustus: 8, september: 9, oktober: 10, november: 11, december: 12,
}

function parseMoney(s: string): number {
  // Handles "€ 1.234,56", "1.234,56", "1234.56"
  const cleaned = s.replace(/[€\s]/g, '')
  if (/^\d{1,3}(\.\d{3})*(,\d+)?$/.test(cleaned)) {
    return parseFloat(cleaned.replace(/\./g, '').replace(',', '.'))
  }
  return parseFloat(cleaned.replace(',', '.'))
}

function extractFromText(text: string): { year: number | null; month: number | null; amountExclBtw: number | null } {
  let year: number | null = null
  let month: number | null = null
  let amountExclBtw: number | null = null

  // --- Extract month/year ---

  // "Periode: 01-01-2025 t/m 31-01-2025" or "Periode: 1 januari 2025 t/m ..."
  const periodeNumeric = text.match(/[Pp]eriode[:\s]+(\d{1,2})-(\d{2})-(\d{4})/i)
  if (periodeNumeric) {
    month = parseInt(periodeNumeric[2])
    year = parseInt(periodeNumeric[3])
  }

  if (!month) {
    const periodeText = text.match(/[Pp]eriode[:\s]+\d{1,2}\s+(\w+)\s+(\d{4})/i)
    if (periodeText) {
      month = MONTHS_NL[periodeText[1].toLowerCase()] ?? null
      year = parseInt(periodeText[2])
    }
  }

  // "Factuurdatum: 01-02-2025" or "1 februari 2025"
  if (!month) {
    const factuur = text.match(/[Ff]actuurdatum[:\s]+(\d{1,2})-(\d{2})-(\d{4})/i)
    if (factuur) {
      month = parseInt(factuur[2])
      year = parseInt(factuur[3])
    }
  }

  if (!month) {
    const factuurText = text.match(/[Ff]actuurdatum[:\s]+\d{1,2}\s+(\w+)\s+(\d{4})/i)
    if (factuurText) {
      month = MONTHS_NL[factuurText[1].toLowerCase()] ?? null
      year = parseInt(factuurText[2])
    }
  }

  // Fallback: find any "maandnaam YYYY" pattern
  if (!month) {
    for (const [name, num] of Object.entries(MONTHS_NL)) {
      const m = text.match(new RegExp(`${name}\\s+(20\\d{2})`, 'i'))
      if (m) { month = num; year = parseInt(m[1]); break }
    }
  }

  // --- Extract amount excl. BTW ---

  // "Subtotaal excl. BTW  € 1.234,56"  or "Subtotaal  € 1.234,56"  or "Totaal excl. BTW  € 1.234,56"
  const patterns = [
    /[Ss]ubtotaal\s+excl\.?\s+[Bb][Tt][Ww][^\d€]+([\d.,]+)/,
    /[Tt]otaal\s+excl\.?\s+[Bb][Tt][Ww][^\d€]+([\d.,]+)/,
    /[Ss]ubtotaal[^\d€\n]+([\d.,]+)/,
  ]

  for (const pat of patterns) {
    const m = text.match(pat)
    if (m) {
      const parsed = parseMoney(m[1])
      if (!isNaN(parsed) && parsed > 0) { amountExclBtw = parsed; break }
    }
  }

  // If still not found, look for the largest amount on a "Subtotaal" line
  if (!amountExclBtw) {
    const lines = text.split('\n')
    for (const line of lines) {
      if (/subtotaal|totaal excl/i.test(line)) {
        const amounts = [...line.matchAll(/([\d]{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)/g)]
          .map((m) => parseMoney(m[1]))
          .filter((n) => !isNaN(n) && n > 0)
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
    const { PDFParse } = await import('pdf-parse')
    const parser = new PDFParse({ data: buffer })
    const result = await parser.getText()
    const text: string = result.text

    const { year, month, amountExclBtw } = extractFromText(text)

    return NextResponse.json({
      ok: true,
      filename: f.name,
      year,
      month,
      amountExclBtw,
      // Return a snippet of the raw text so the user can debug if parsing fails
      textSnippet: text.slice(0, 800).replace(/\s+/g, ' '),
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
