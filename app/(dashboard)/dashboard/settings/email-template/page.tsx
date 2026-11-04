import { prisma } from '@/lib/db'
import TemplateListClient from './TemplateListClient'

export const revalidate = 0

export default async function EmailTemplatePage() {
  let templates: Array<{ id: number; name: string; subject: string; isDefault: boolean; updatedAt: Date }> = []

  try {
    templates = await prisma.emailTemplate.findMany({
      select: { id: true, name: true, subject: true, isDefault: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    })
  } catch {
    // DB not ready
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <a href="/dashboard/settings" className="text-sm text-brand-600 hover:underline mb-2 inline-block">
          ← Terug naar instellingen
        </a>
        <h2 className="text-2xl font-semibold text-slate-900">E-mailsjablonen</h2>
        <p className="text-slate-500 text-sm mt-1">
          Beheer je e-mailsjablonen. Je kunt meerdere sjablonen maken en per campagne een sjabloon kiezen.
        </p>
      </div>

      <div className="mb-4 flex justify-end">
        <a
          href="/dashboard/settings/email-template/new"
          className="px-4 py-2 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700 transition-colors"
        >
          + Nieuw sjabloon
        </a>
      </div>

      <TemplateListClient templates={templates} />
    </div>
  )
}
