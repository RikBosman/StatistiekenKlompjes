import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { unsubscribeToken } from '@/lib/campaigns'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const email = searchParams.get('email') ?? ''
  const token = searchParams.get('token') ?? ''

  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? 'localhost:3000'
  const proto = req.headers.get('x-forwarded-proto') ?? 'http'
  const base = `${proto}://${host}`

  if (!email || !token || token !== unsubscribeToken(email)) {
    return NextResponse.redirect(`${base}/uitschrijven?error=invalid`)
  }

  const campaignId = Number(searchParams.get('campaign') ?? '0') || null

  try {
    const customer = await prisma.customer.findUnique({ where: { email: email.toLowerCase() } })
    if (customer) {
      // Track unsubscribe on the campaign that sent this email
      if (campaignId) {
        await prisma.campaign.update({
          where: { id: campaignId },
          data: { unsubscribes: { increment: 1 } },
        }).catch(() => { /* campaign may not exist, ignore */ })
      }
      // Remove from all lists and delete
      await prisma.customerListMember.deleteMany({ where: { customerId: customer.id } })
      await prisma.campaignRecipient.deleteMany({ where: { customerId: customer.id } })
      await prisma.reminder.deleteMany({ where: { customerId: customer.id } })
      await prisma.customer.delete({ where: { id: customer.id } })
    }
  } catch {
    return NextResponse.redirect(`${base}/uitschrijven?error=failed`)
  }

  return NextResponse.redirect(`${base}/uitschrijven?success=1`)
}
