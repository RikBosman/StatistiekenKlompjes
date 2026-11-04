import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import EmailTemplateBuilder from '@/components/EmailTemplateBuilder'

export const revalidate = 0

export default async function EditTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

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
    template = await prisma.emailTemplate.findUnique({ where: { id: Number(id) } })
    products = await prisma.product.findMany({
      where: { status: 'publish' },
      select: { id: true, name: true, imageUrl: true, price: true, permalink: true, sku: true },
      orderBy: { name: 'asc' },
    })
  } catch {
    // DB not ready
  }

  if (!template) return notFound()

  return (
    <div className="p-8 max-w-7xl">
      <div className="mb-8">
        <a href="/dashboard/settings/email-template" className="text-sm text-brand-600 hover:underline mb-2 inline-block">
          ← Terug naar sjablonen
        </a>
        <h2 className="text-2xl font-semibold text-slate-900">Sjabloon bewerken: {template.name}</h2>
        <p className="text-slate-500 text-sm mt-1">
          Gebruik <code className="bg-slate-100 px-1 rounded text-xs">{'{{first_name}}'}</code> of{' '}
          <code className="bg-slate-100 px-1 rounded text-xs">{'{{name}}'}</code> als variabelen.
        </p>
      </div>
      <EmailTemplateBuilder template={template} products={products} />
    </div>
  )
}
