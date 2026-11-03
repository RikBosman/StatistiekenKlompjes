import crypto from 'crypto'
import { prisma } from './db'
import { sendEmail } from './mailtrap'
import { getSegmentCustomers, SegmentType } from './segments'

export function unsubscribeToken(email: string): string {
  const secret = process.env.CRON_SECRET || 'unsubscribe-secret'
  return crypto.createHmac('sha256', secret).update(email.toLowerCase()).digest('hex')
}

export function renderTemplate(html: string, customer: { firstName: string; email: string; unsubscribeUrl?: string }): string {
  return html
    .replace(/\{\{first_name\}\}/gi, customer.firstName || 'klant')
    .replace(/\{\{voornaam\}\}/gi, customer.firstName || 'klant')
    .replace(/\{\{name\}\}/gi, customer.firstName || 'klant')
    .replace(/\{\{naam\}\}/gi, customer.firstName || 'klant')
    .replace(/\{\{email\}\}/gi, customer.email)
    .replace(/\{\{unsubscribe_url\}\}/gi, customer.unsubscribeUrl || '#')
}

export async function sendCampaign(campaignId: number, limit?: number): Promise<{ sent: number; failed: number; remaining: number }> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { template: true, recipients: true },
  })
  if (!campaign) throw new Error('Campagne niet gevonden')

  let sent = 0
  let failed = 0

  const allPending = campaign.recipients.filter((r) => r.status === 'pending')
  const pending = limit ? allPending.slice(0, limit) : allPending
  const baseUrl = process.env.DASHBOARD_URL || 'https://statistieken.klompjes.com'
  const utmParams = `utm_source=email&utm_medium=newsletter&utm_campaign=${encodeURIComponent(campaign.name)}&utm_content=campaign_${campaignId}`

  // Send in batches of 50 to stay within rate limits
  const BATCH_SIZE = 50
  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const batch = pending.slice(i, i + BATCH_SIZE)

    await Promise.all(batch.map(async (recipient) => {
      try {
        const token = unsubscribeToken(recipient.email)
        const unsubscribeUrl = `${baseUrl}/api/unsubscribe?email=${encodeURIComponent(recipient.email)}&token=${token}&campaign=${campaignId}`

        const renderedHtml = renderTemplate(campaign.template.bodyHtml, {
          firstName: recipient.firstName,
          email: recipient.email,
          unsubscribeUrl,
        })

        // Tag all klompjes.com links with UTM params for campaign attribution
        const html = renderedHtml.replace(
          /href="(https?:\/\/(?:www\.)?klompjes\.com[^"]*?)"/g,
          (_, url) => `href="${url}${url.includes('?') ? '&' : '?'}${utmParams}"`
        )
        const subject = renderTemplate(campaign.template.subject, {
          firstName: recipient.firstName,
          email: recipient.email,
        })

        await sendEmail({ to: recipient.email, toName: recipient.firstName, subject, html })

        await prisma.campaignRecipient.update({
          where: { id: recipient.id },
          data: { status: 'sent', sentAt: new Date() },
        })
        sent++
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err)
        await prisma.campaignRecipient.update({
          where: { id: recipient.id },
          data: { status: 'failed', error },
        })
        failed++
      }
    }))

    // Small pause between batches to avoid rate limiting
    if (i + BATCH_SIZE < pending.length) {
      await new Promise((r) => setTimeout(r, 200))
    }
  }

  const remaining = allPending.length - pending.length
  const newTotalSent = campaign.totalSent + sent
  const allDone = remaining === 0

  await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      status: allDone ? (failed === 0 ? 'sent' : 'failed') : 'sending',
      totalSent: newTotalSent,
      sentAt: allDone ? (campaign.sentAt ?? new Date()) : campaign.sentAt,
    },
  })

  return { sent, failed, remaining }
}

export async function prepareCampaign(campaignId: number): Promise<number> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
  })
  if (!campaign) throw new Error('Campagne niet gevonden')

  const customers = await getSegmentCustomers(
    campaign.segmentType as SegmentType,
    campaign.listId ?? undefined
  )

  await prisma.campaignRecipient.deleteMany({ where: { campaignId } })

  await prisma.campaignRecipient.createMany({
    data: customers.map((c) => ({
      campaignId,
      customerId: c.id,
      email: c.email,
      firstName: c.firstName,
      status: 'pending',
    })),
  })

  return customers.length
}
