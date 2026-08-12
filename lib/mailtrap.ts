import { MailtrapClient } from 'mailtrap'

let client: MailtrapClient | null = null

function getClient(): MailtrapClient {
  if (!client) {
    const token = process.env.MAILTRAP_API_TOKEN
    if (!token) throw new Error('MAILTRAP_API_TOKEN not configured')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    client = new MailtrapClient({ token, bulk: true } as any)
  }
  return client
}

export interface SendEmailOptions {
  to: string
  toName?: string
  subject: string
  html: string
}

export async function sendEmail({ to, toName, subject, html }: SendEmailOptions) {
  const mailtrap = getClient()

  const fromEmail = process.env.MAILTRAP_FROM_EMAIL || 'noreply@example.com'
  const fromName = process.env.MAILTRAP_FROM_NAME || 'Dashboard'

  await mailtrap.send({
    from: { email: fromEmail, name: fromName },
    to: [{ email: to, name: toName || to }],
    subject,
    html,
  })
}
