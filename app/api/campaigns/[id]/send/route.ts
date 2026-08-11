import { NextRequest, NextResponse } from 'next/server'
import { sendCampaign } from '@/lib/campaigns'

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const result = await sendCampaign(Number(params.id))
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
