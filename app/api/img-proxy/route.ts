import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import sharp from 'sharp'

const ALLOWED_HOSTS = ['klompjes.com', 'www.klompjes.com', 'statistieken.klompjes.com']

function allowedUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url)
    return ALLOWED_HOSTS.some((h) => hostname === h || hostname.endsWith('.' + h))
  } catch {
    return false
  }
}

async function fetchImg(url: string): Promise<Buffer | null> {
  try {
    const res = await axios.get<Buffer>(url, {
      responseType: 'arraybuffer',
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'image/*,*/*;q=0.8',
        Referer: 'https://klompjes.com/',
      },
    })
    return Buffer.from(res.data)
  } catch (err) {
    const msg = axios.isAxiosError(err)
      ? `${err.response?.status ?? 'network'} ${err.message}`
      : String(err)
    console.error('[img-proxy] fetch failed:', msg, url)
    return null
  }
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url')
  const w = Math.min(Math.max(parseInt(req.nextUrl.searchParams.get('w') ?? '240'), 40), 600)

  if (!url || !allowedUrl(url)) {
    return new NextResponse('Bad request', { status: 400 })
  }

  // Try original URL first
  let buf = await fetchImg(url)

  // If .webp and failed, try .jpg equivalent
  if (!buf && /\.webp(\?|$)/i.test(url)) {
    const jpgUrl = url.replace(/\.webp(\?.*)?$/i, (_, qs) => `.jpg${qs ?? ''}`)
    buf = await fetchImg(jpgUrl)
  }

  if (!buf) {
    return new NextResponse('Image not found', { status: 404 })
  }

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
    return new NextResponse(new Uint8Array(buf), {
      headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=86400' },
    })
  }
}
