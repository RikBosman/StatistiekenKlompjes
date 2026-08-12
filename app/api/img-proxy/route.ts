import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'
import sharp from 'sharp'

const ALLOWED_HOSTS = ['klompjes.com', 'www.klompjes.com']

// Local webroot for klompjes.com so we can read image files directly from
// disk rather than making an HTTP request (shared hosting often blocks
// loopback / same-server HTTP requests).
// Set KLOMPJES_WEBROOT in .env, e.g.:
//   KLOMPJES_WEBROOT=/home/klompjes/domains/klompjes.com/public_html
const KLOMPJES_WEBROOT = process.env.KLOMPJES_WEBROOT ?? ''

function allowedUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url)
    return ALLOWED_HOSTS.some((h) => hostname === h || hostname.endsWith('.' + h))
  } catch {
    return false
  }
}

async function readFromDisk(url: string): Promise<Buffer | null> {
  if (!KLOMPJES_WEBROOT) return null
  try {
    const { pathname } = new URL(url)
    const abs = path.resolve(KLOMPJES_WEBROOT, '.' + pathname)
    // Safety: ensure we stay within the webroot
    if (!abs.startsWith(path.resolve(KLOMPJES_WEBROOT))) return null
    return await readFile(abs)
  } catch {
    return null
  }
}

async function fetchFromHttp(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; StatistiekenBot/1.0)',
        Accept: 'image/*,*/*',
      },
    })
    if (!res.ok) return null
    return Buffer.from(await res.arrayBuffer())
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

  // 1. Try reading the file directly from disk (fastest, avoids HTTP firewall)
  let buf: Buffer | null = await readFromDisk(url)

  // 2. If disk read failed, try HTTP fetch
  if (!buf) {
    buf = await fetchFromHttp(url)
  }

  // 3. If URL is .webp and still no buffer, try .jpg equivalent via HTTP
  if (!buf && /\.webp(\?|$)/i.test(url)) {
    const jpgUrl = url.replace(/\.webp(\?.*)?$/i, (_, qs) => `.jpg${qs ?? ''}`)
    buf = await readFromDisk(jpgUrl) ?? await fetchFromHttp(jpgUrl)
  }

  if (!buf) {
    console.error('[img-proxy] all strategies failed for:', url)
    return new NextResponse('Image not found', { status: 404 })
  }

  // 4. Convert & resize to JPEG via sharp
  try {
    const jpeg = await sharp(buf)
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
    console.error('[img-proxy] sharp error:', (err as Error).message?.slice(0, 200))
    // Return original buffer as fallback even if sharp fails
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=86400',
      },
    })
  }
}
