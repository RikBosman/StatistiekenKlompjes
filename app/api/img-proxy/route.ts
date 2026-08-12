import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'

// Allowed image hosts — only serve images from klompjes.com
const ALLOWED_HOSTS = ['klompjes.com', 'www.klompjes.com']

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url')
  const w = Math.min(Math.max(parseInt(req.nextUrl.searchParams.get('w') ?? '240'), 40), 600)

  if (!url) return new NextResponse('Missing url', { status: 400 })

  try {
    const { hostname } = new URL(url)
    if (!ALLOWED_HOSTS.some((h) => hostname === h || hostname.endsWith('.' + h))) {
      return new NextResponse('Forbidden', { status: 403 })
    }
  } catch {
    return new NextResponse('Invalid url', { status: 400 })
  }

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; StatistiekenKlompjes/1.0)' },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      next: { revalidate: 86400 } as any,
    })

    if (!res.ok) return new NextResponse('Upstream fetch failed', { status: 502 })

    const buf = Buffer.from(await res.arrayBuffer())

    const jpeg = await sharp(buf)
      .resize(w, w, { fit: 'cover', position: 'centre' })
      .jpeg({ quality: 82, progressive: true })
      .toBuffer()

    return new NextResponse(new Uint8Array(jpeg), {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=604800, immutable',
      },
    })
  } catch {
    return new NextResponse('Image processing failed', { status: 500 })
  }
}
