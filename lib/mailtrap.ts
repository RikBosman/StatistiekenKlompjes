import axios, { AxiosError } from 'axios'

const BULK_URL = 'https://bulk.api.mailtrap.io/api/send'

export interface SendEmailOptions {
  to: string
  toName?: string
  subject: string
  html: string
}

export async function sendEmail({ to, toName, subject, html }: SendEmailOptions) {
  const token = process.env.MAILTRAP_API_TOKEN
  const fromEmail = process.env.MAILTRAP_FROM_EMAIL
  const fromName = process.env.MAILTRAP_FROM_NAME || 'Klompjes'

  if (!token || !fromEmail) {
    throw new Error('MAILTRAP_API_TOKEN en MAILTRAP_FROM_EMAIL zijn vereist')
  }

  try {
    await axios.post(
      BULK_URL,
      {
        from: { email: fromEmail, name: fromName },
        to: [{ email: to, name: toName || to }],
        subject,
        html,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      },
    )
  } catch (err) {
    const axiosErr = err as AxiosError
    const status = axiosErr.response?.status
    const detail = JSON.stringify(axiosErr.response?.data)
    throw new Error(`Mailtrap fout ${status}: ${detail}`)
  }
}
