import { NextRequest, NextResponse } from 'next/server'
import { getSegmentCustomers, SegmentType } from '@/lib/segments'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const segmentType = searchParams.get('segmentType') as SegmentType
  const listId = searchParams.get('listId') ? Number(searchParams.get('listId')) : undefined

  if (!segmentType) return NextResponse.json({ error: 'segmentType required' }, { status: 400 })

  const customers = await getSegmentCustomers(segmentType, listId)
  return NextResponse.json({ count: customers.length })
}
