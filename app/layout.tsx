import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'WooCommerce Analytics Dashboard',
  description: 'Product performance, customer segmentation & margin visibility',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl">
      <body>{children}</body>
    </html>
  )
}
