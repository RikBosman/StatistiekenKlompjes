import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

function authorized(req: NextRequest) {
  const auth = req.headers.get('authorization')
  return auth === `Bearer ${process.env.CRON_SECRET}`
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const required = [
    'GOOGLE_ADS_DEVELOPER_TOKEN',
    'GOOGLE_ADS_CLIENT_ID',
    'GOOGLE_ADS_CLIENT_SECRET',
    'GOOGLE_ADS_REFRESH_TOKEN',
    'GOOGLE_ADS_CUSTOMER_ID',
  ]

  const missing = required.filter((k) => !process.env[k])
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Google Ads not configured. Missing: ${missing.join(', ')}` },
      { status: 503 }
    )
  }

  // Google Ads API integration placeholder
  // Full implementation requires google-ads-api SDK and OAuth flow
  await prisma.syncLog.create({
    data: {
      type: 'ads',
      status: 'failed',
      message: 'Google Ads sync not yet implemented — configure credentials and implement in lib/google-ads.ts',
    },
  })

  return NextResponse.json({
    message: 'Google Ads sync stub — implement lib/google-ads.ts to complete this integration',
  })
}
