import { NextRequest, NextResponse } from 'next/server'

const ALLOWED_HOSTS = ['klompjes.com', 'www.klompjes.com', 'statistieken.klompjes.com']

function allowedUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url)
    return ALLOWED_HOSTS.some((h) => hostname === h || hostname.endsWith('.' + h))
  } catch {
    return false
  }
}

async function fetchImg(url: string): Promise<Response | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; StatistiekenBot/1.0)',
        Accept: 'image/*,*/*',
      },
    })
    return res.ok ? res : null
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url')
  const w = Math.min(Math.max(parseInt(req.nextUrl.searchParams.get('w') ?? '240'), 40), 600)

  if (!url || !allowedUrl(url)) {
    return new NextResponse('Bad request', { status: 400 })
  }

  // Strategy 1: if URL is WebP, try the JPEG equivalent first
  // WordPress keeps original .jpg files even when it generates .webp thumbnails
  if (/\.webp(\?|$)/i.test(url)) {
    const jpegUrl = url.replace(/\.webp(\?.*)?$/i, (_, qs) => `.jpg${qs ?? ''}`)
    const res = await fetchImg(jpegUrl)
    if (res) {
      console.log('[img-proxy] jpeg fallback worked:', jpegUrl)
      const buf = await res.arrayBuffer()
      return new NextResponse(buf, {
        headers: {
          'Content-Type': 'image/jpeg',
          'Cache-Control': 'public, max-age=604800, immutable',
        },
      })
    }
  }

  // Strategy 2: fetch original and convert with sharp (if installed)
  const originalRes = await fetchImg(url)
  if (!originalRes) {
    console.error('[img-proxy] could not fetch:', url)
    return new NextResponse('Upstream error', { status: 502 })
  }

  const originalBuf = Buffer.from(await originalRes.arrayBuffer())
  const originalContentType = originalRes.headers.get('content-type') ?? 'image/jpeg'

  try {
    // Dynamic import so missing sharp doesn't crash the route
    const sharp = (await import('sharp')).default
    const jpeg = await sharp(originalBuf)
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
    console.error('[img-proxy] sharp unavailable:', (err as Error).message?.slice(0, 120))
  }

  // Strategy 3: pass through original as-is (better than a broken image)
  console.log('[img-proxy] passthrough:', url, originalContentType)
  return new NextResponse(new Uint8Array(originalBuf), {
    headers: {
      'Content-Type': originalContentType,
      'Cache-Control': 'public, max-age=86400',
    },
  })
}
