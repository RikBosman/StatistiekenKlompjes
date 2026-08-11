import { prisma } from './db'
import { sendEmail } from './mailtrap'
import { subMonths } from 'date-fns'

export async function processReminders(): Promise<{ sent: number; errors: string[] }> {
  const reminderMonths = parseInt(process.env.REMINDER_MONTHS || '3', 10)
  const cutoffDate = subMonths(new Date(), reminderMonths)

  // Find customers tagged as logo_buyer
  const customers = await prisma.customer.findMany({
    where: { tags: { contains: 'logo_buyer' } },
  })

  let sent = 0
  const errors: string[] = []

  for (const customer of customers) {
    // Find their last logo/tekst order
    const lastLogoOrder = await prisma.order.findFirst({
      where: {
        customerId: customer.id,
        status: { notIn: ['cancelled', 'refunded'] },
        lineItems: {
          some: {
            OR: [
              { name: { contains: 'logo' } },
              { name: { contains: 'tekst' } },
              { name: { contains: 'Logo' } },
              { name: { contains: 'Tekst' } },
            ],
          },
        },
      },
      orderBy: { date: 'desc' },
      include: { lineItems: true },
    })

    if (!lastLogoOrder) continue

    // Check if it's old enough for a reminder
    if (lastLogoOrder.date > cutoffDate) continue

    // Check if we already sent a reminder for this order
    const existingReminder = await prisma.reminder.findFirst({
      where: {
        customerId: customer.id,
        orderId: lastLogoOrder.id,
        status: { in: ['sent', 'pending'] },
      },
    })

    if (existingReminder) continue

    // Find the default email template
    const template = await prisma.emailTemplate.findFirst({
      where: { isDefault: true },
      orderBy: { createdAt: 'desc' },
    })

    if (!template) {
      errors.push(`No email template found for customer ${customer.email}`)
      continue
    }

    // Create reminder record
    const reminder = await prisma.reminder.create({
      data: {
        customerId: customer.id,
        campaign: 'logo_tekst_reorder',
        orderId: lastLogoOrder.id,
        status: 'pending',
      },
    })

    // Build personalised email
    const html = template.bodyHtml
      .replace(/\{\{name\}\}/g, `${customer.firstName} ${customer.lastName}`.trim())
      .replace(/\{\{first_name\}\}/g, customer.firstName)
      .replace(/\{\{email\}\}/g, customer.email)

    try {
      await sendEmail({
        to: customer.email,
        toName: `${customer.firstName} ${customer.lastName}`.trim(),
        subject: template.subject,
        html,
      })

      await prisma.reminder.update({
        where: { id: reminder.id },
        data: { status: 'sent', sentAt: new Date() },
      })

      sent++
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      errors.push(`Failed to send to ${customer.email}: ${message}`)

      await prisma.reminder.update({
        where: { id: reminder.id },
        data: { status: 'failed' },
      })
    }
  }

  await prisma.syncLog.create({
    data: {
      type: 'reminders',
      status: errors.length === 0 ? 'success' : 'failed',
      itemCount: sent,
      message: errors.length > 0 ? errors.join('; ') : undefined,
    },
  })

  return { sent, errors }
}

export async function seedDefaultTemplate() {
  const existing = await prisma.emailTemplate.findFirst({ where: { isDefault: true } })
  if (existing) return

  await prisma.emailTemplate.create({
    data: {
      name: 'Logo/Tekst Herinnering',
      subject: 'Tijd voor een nieuw logo of tekst product?',
      isDefault: true,
      bodyHtml: `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <h2>Hoi {{first_name}},</h2>
  <p>
    Het is alweer een tijdje geleden dat je bij ons een logo of tekst product hebt besteld.
    Misschien is het tijd voor een nieuwe ronde?
  </p>
  <p>
    We hebben onze collectie uitgebreid en we denken dat je er iets leuks bij kunt vinden.
  </p>
  <p style="margin: 30px 0;">
    <a href="{{shop_url}}" style="background: #0e8ee7; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
      Bekijk ons assortiment
    </a>
  </p>
  <p>Met vriendelijke groet,<br>Het team</p>
</body>
</html>
      `.trim(),
    },
  })
}
