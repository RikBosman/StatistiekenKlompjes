import { NextResponse } from 'next/server'

const MONTHS_NL: Record<string, number> = {
  januari: 1, jan: 1,
  februari: 2, feb: 2,
  maart: 3, mrt: 3,
  april: 4, apr: 4,
  mei: 5,
  juni: 6, jun: 6,
  juli: 7, jul: 7,
  augustus: 8, aug: 8,
  september: 9, sep: 9,
  oktober: 10, okt: 10,
  november: 11, nov: 11,
  december: 12, dec: 12,
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

  // Numeric date in period: "01-01-2025"
  const periodeNumeric = text.match(/(?:periode|period)[^\d]*(\d{1,2})[/-](\d{2})[/-](\d{4})/i)
  if (periodeNumeric) {
    month = parseInt(periodeNumeric[2])
    year = parseInt(periodeNumeric[3])
  }

  // "Overzicht voor 1 apr 2025" or "Overzicht voor 1 april 2025" (Google Ads)
  if (!month) {
    const overzicht = text.match(/[Oo]verzicht\s+voor\s+\d{1,2}\s+(\w+\.?)\s+(20\d{2})/i)
    if (overzicht) {
      const mn = overzicht[1].replace(/\.$/, '').toLowerCase()
      month = MONTHS_NL[mn] ?? null
      year = parseInt(overzicht[2])
    }
  }

  // "Factuurdatum ... 30 apr 2025" — date anywhere after the label
  if (!month) {
    const factuurText = text.match(/[Ff]actuurdatum[^]*?(\d{1,2})\s+(\w+\.?)\s+(20\d{2})/)
    if (factuurText) {
      const mn = factuurText[2].replace(/\.$/, '').toLowerCase()
      month = MONTHS_NL[mn] ?? null
      year = parseInt(factuurText[3])
    }
  }

  // Numeric "Factuurdatum: 01-04-2025"
  if (!month) {
    const factuur = text.match(/[Ff]actuurdatum[^\d]*(\d{1,2})[/-](\d{2})[/-](\d{4})/i)
    if (factuur) {
      month = parseInt(factuur[2])
      year = parseInt(factuur[3])
    }
  }

  // Any period text: "periode ... januari 2025"
  if (!month) {
    const periodeText = text.match(/(?:periode|period)[^\n]*?(\w+\.?)\s+(20\d{2})/i)
    if (periodeText) {
      const mn = periodeText[1].replace(/\.$/, '').toLowerCase()
      month = MONTHS_NL[mn] ?? null
      year = parseInt(periodeText[2])
    }
  }

  // Fallback: any "mmm YYYY" or "maandnaam YYYY" in the text
  if (!month) {
    for (const [name, num] of Object.entries(MONTHS_NL)) {
      const m = text.match(new RegExp(`${name}\\.?\\s+(20\\d{2})`, 'i'))
      if (m) { month = num; year = parseInt(m[1]); break }
    }
  }

  // --- Amount extraction ---
  // Google Ads NL invoice format (PDF text linearized):
  //   "€ 10.458,57 Google Ads Totaal in EUR € 10.458,01 ..."
  // The grand total appears BEFORE the "Totaal in EUR" label in the text stream.

  const amountPatterns = [
    // Google Ads: amount precedes "Totaal in EUR" label
    /€\s*([\d.]+,\d{2})\s+(?:Google Ads\s+)?[Tt]otaal\s+in\s+EUR/,
    // "Totaal in EUR" label followed by amount
    /[Tt]otaal\s+in\s+EUR[^\d€\n]*([\d.]+,\d{2})/,
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
      textSnippet: text.slice(0, 1000).replace(/\s+/g, ' '),
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
