import Link from 'next/link'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', label: 'Overzicht', icon: '📊' },
  { href: '/dashboard/products', label: 'Producten', icon: '📦' },
  { href: '/dashboard/customers', label: 'Klanten', icon: '👥' },
  { href: '/dashboard/margins', label: 'Marges', icon: '💰' },
  { href: '/dashboard/email', label: 'E-mail', icon: '✉️' },
  { href: '/dashboard/ads', label: 'Advertenties', icon: '📢' },
  { href: '/dashboard/settings', label: 'Instellingen', icon: '⚙️' },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-60 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-5 border-b border-slate-200">
          <h1 className="text-base font-semibold text-slate-900 leading-tight">
            Analytics
            <br />
            <span className="text-brand-600 text-sm font-medium">Dashboard</span>
          </h1>
        </div>
        <nav className="flex-1 p-3">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors mb-0.5"
            >
              <span className="text-base leading-none">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-200">
          <form method="POST" action="/api/auth/logout">
            <button
              type="submit"
              className="w-full text-left text-xs text-slate-400 hover:text-slate-600 transition-colors"
            >
              Uitloggen →
            </button>
          </form>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
