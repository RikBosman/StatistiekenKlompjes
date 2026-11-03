import { Resend } from 'resend'

export interface SendEmailOptions {
  to: string
  toName?: string
  subject: string
  html: string
}

export async function sendEmail({ to, toName, subject, html }: SendEmailOptions) {
  const apiKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.RESEND_FROM_EMAIL
  const fromName = process.env.RESEND_FROM_NAME || 'Klompjes'

  if (!apiKey || !fromEmail) {
    throw new Error('RESEND_API_KEY en RESEND_FROM_EMAIL zijn vereist')
  }

  const resend = new Resend(apiKey)
  const from = `${fromName} <${fromEmail}>`

  const { error } = await resend.emails.send({ from, to, subject, html })
  if (error) throw new Error(`Resend fout: ${error.message}`)
}
