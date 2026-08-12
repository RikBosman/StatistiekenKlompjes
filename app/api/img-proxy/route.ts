import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'

// Only proxy images from klompjes domains
const ALLOWED_HOSTS = ['klompjes.com', 'www.klompjes.com', 'statistieken.klompjes.com']

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url')
  const w = Math.min(Math.max(parseInt(req.nextUrl.searchParams.get('w') ?? '240'), 40), 600)

  if (!url) {
    return new NextResponse('Missing url', { status: 400 })
  }

  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
    const ok = ALLOWED_HOSTS.some((h) => parsedUrl.hostname === h || parsedUrl.hostname.endsWith('.' + h))
    if (!ok) return new NextResponse('Forbidden', { status: 403 })
  } catch {
    return new NextResponse('Invalid url', { status: 400 })
  }

  let imageBuffer: Buffer
  try {
    const res = await fetch(parsedUrl.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; StatistiekenBot/1.0)',
        Accept: 'image/*,*/*',
      },
    })
    if (!res.ok) {
      console.error(`[img-proxy] upstream ${res.status} for ${url}`)
      return new NextResponse(`Upstream error: ${res.status}`, { status: 502 })
    }
    imageBuffer = Buffer.from(await res.arrayBuffer())
  } catch (err) {
    console.error('[img-proxy] fetch error', err)
    return new NextResponse('Fetch failed', { status: 502 })
  }

  try {
    const jpeg = await sharp(imageBuffer)
      .resize(w, w, { fit: 'cover', position: 'centre' })
      .jpeg({ quality: 82 })
      .toBuffer()

    return new NextResponse(new Uint8Array(jpeg), {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=604800, immutable',
      },
    })
  } catch (err) {
    console.error('[img-proxy] sharp error', err)
    return new NextResponse('Image processing failed', { status: 500 })
  }
}
