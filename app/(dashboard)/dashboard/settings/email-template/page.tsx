import { prisma } from '@/lib/db'
import EmailTemplateForm from '@/components/EmailTemplateForm'

export const revalidate = 0

export default async function EmailTemplatePage() {
  let template = null

  try {
    template = await prisma.emailTemplate.findFirst({ where: { isDefault: true } })
  } catch {
    // DB not ready
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <a href="/dashboard/settings" className="text-sm text-brand-600 hover:underline mb-2 inline-block">
          ← Terug naar instellingen
        </a>
        <h2 className="text-2xl font-semibold text-slate-900">E-mailtemplate</h2>
        <p className="text-slate-500 text-sm mt-1">
          Herinnerings-e-mail voor logo/tekst klanten. Gebruik {'{{first_name}}'}, {'{{name}}'}, {'{{email}}'} als variabelen.
        </p>
      </div>
      <EmailTemplateForm template={template} />
    </div>
  )
}
