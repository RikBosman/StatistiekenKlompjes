import { prisma } from '@/lib/db'
import EmailTemplateBuilder from '@/components/EmailTemplateBuilder'

export const revalidate = 0

export default async function EmailTemplatePage() {
  let template = null
  let products: Array<{
    id: number
    name: string
    imageUrl: string | null
    price: number | null
    permalink: string | null
    sku: string | null
  }> = []

  try {
    template = await prisma.emailTemplate.findFirst({ where: { isDefault: true } })
    products = await prisma.product.findMany({
      where: { status: 'publish' },
      select: { id: true, name: true, imageUrl: true, price: true, permalink: true, sku: true },
      orderBy: { name: 'asc' },
    })
  } catch {
    // DB not ready
  }

  return (
    <div className="p-8 max-w-7xl">
      <div className="mb-8">
        <a href="/dashboard/settings" className="text-sm text-brand-600 hover:underline mb-2 inline-block">
          ← Terug naar instellingen
        </a>
        <h2 className="text-2xl font-semibold text-slate-900">E-mailtemplate</h2>
        <p className="text-slate-500 text-sm mt-1">
          Bouw een mooie HTML-mail met je logo, uitgelicht product en productgrid. Gebruik{' '}
          <code className="bg-slate-100 px-1 rounded text-xs">{'{{first_name}}'}</code> of{' '}
          <code className="bg-slate-100 px-1 rounded text-xs">{'{{name}}'}</code> als variabelen.
        </p>
      </div>
      <EmailTemplateBuilder template={template} products={products} />
    </div>
  )
}
