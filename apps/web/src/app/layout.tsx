import type { Metadata } from 'next'
import './globals.css'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: {
    template: '%s | Wikly',
    default: 'Wikly — Obsidian Knowledge Platform',
  },
  description:
    'Publikasikan catatan Obsidian pilihan ke web publik berkecepatan tinggi.',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  )
}
