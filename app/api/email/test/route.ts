import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendEmail } from '@/lib/mailtrap'

export async function POST(req: NextRequest) {
  const { emails, templateId } = await req.json()

  if (!emails?.length || !templateId) {
    return NextResponse.json({ error: 'emails en templateId zijn vereist' }, { status: 400 })
  }

  const template = await prisma.emailTemplate.findUnique({ where: { id: templateId } })
  if (!template) return NextResponse.json({ error: 'Sjabloon niet gevonden' }, { status: 404 })

  const results: { email: string; ok: boolean; error?: string }[] = []

  for (const email of emails as string[]) {
    const trimmed = email.trim()
    if (!trimmed) continue
    try {
      await sendEmail({
        to: trimmed,
        subject: `[TEST] ${template.subject}`,
        html: template.bodyHtml,
      })
      results.push({ email: trimmed, ok: true })
    } catch (err) {
      results.push({ email: trimmed, ok: false, error: err instanceof Error ? err.message : String(err) })
    }
  }

  return NextResponse.json({ results })
}
