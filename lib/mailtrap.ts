import { Resend } from 'resend'

export interface SendEmailOptions {
  to: string
  toName?: string
  subject: string
  html: string
}

function getResend() {
  const apiKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.RESEND_FROM_EMAIL
  const fromName = process.env.RESEND_FROM_NAME || 'Klompjes'
  if (!apiKey || !fromEmail) throw new Error('RESEND_API_KEY en RESEND_FROM_EMAIL zijn vereist')
  return { resend: new Resend(apiKey), from: `${fromName} <${fromEmail}>` }
}

export async function sendEmail({ to, subject, html }: SendEmailOptions) {
  const { resend, from } = getResend()
  const { error } = await resend.emails.send({ from, to, subject, html })
  if (error) throw new Error(`Resend fout: ${error.message}`)
}

export async function sendEmailBatch(emails: SendEmailOptions[]): Promise<{ ok: number; failed: number }> {
  const { resend, from } = getResend()
  const { data, error } = await resend.batch.send(
    emails.map(({ to, subject, html }) => ({ from, to, subject, html }))
  )
  if (error) throw new Error(`Resend batch fout: ${error.message}`)
  return { ok: data?.length ?? 0, failed: 0 }
}
