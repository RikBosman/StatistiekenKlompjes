import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'

let transporter: Transporter | null = null

function getTransporter(): Transporter {
  if (!transporter) {
    const host = process.env.SMTP_HOST
    const port = parseInt(process.env.SMTP_PORT || '587', 10)
    const user = process.env.SMTP_USER
    const pass = process.env.SMTP_PASS

    if (!host || !user || !pass) {
      throw new Error('SMTP niet geconfigureerd — stel SMTP_HOST, SMTP_USER en SMTP_PASS in')
    }

    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
      pool: true,
      maxConnections: 5,
      rateDelta: 1000,
      rateLimit: 10,
    })
  }
  return transporter
}

export interface SendEmailOptions {
  to: string
  toName?: string
  subject: string
  html: string
}

export async function sendEmail({ to, toName, subject, html }: SendEmailOptions) {
  const transport = getTransporter()

  const fromEmail = process.env.SMTP_FROM_EMAIL || ''
  const fromName = process.env.SMTP_FROM_NAME || 'Klompjes'

  await transport.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to: toName ? `"${toName}" <${to}>` : to,
    subject,
    html,
  })
}
