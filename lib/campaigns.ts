import { prisma } from './db'
import { sendEmail } from './mailtrap'
import { getSegmentCustomers, SegmentType } from './segments'

export function renderTemplate(html: string, customer: { firstName: string; email: string }): string {
  return html
    .replace(/\{\{voornaam\}\}/gi, customer.firstName || 'klant')
    .replace(/\{\{email\}\}/gi, customer.email)
    .replace(/\{\{naam\}\}/gi, customer.firstName || 'klant')
}

export async function sendCampaign(campaignId: number): Promise<{ sent: number; failed: number }> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { template: true, recipients: true },
  })
  if (!campaign) throw new Error('Campagne niet gevonden')

  let sent = 0
  let failed = 0

  const pending = campaign.recipients.filter((r) => r.status === 'pending')

  for (const recipient of pending) {
    try {
      const html = renderTemplate(campaign.template.bodyHtml, {
        firstName: recipient.firstName,
        email: recipient.email,
      })
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
  }

  await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      status: failed === 0 ? 'sent' : 'failed',
      totalSent: sent,
      sentAt: new Date(),
    },
  })

  return { sent, failed }
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
