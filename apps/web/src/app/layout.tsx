import type { Metadata } from 'next'
import './globals.css'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: {
    template: '%s | Wikly',
    default: 'Wikly — Obsidian Knowledge Platform',
  },
  description:
    'Publish curated Obsidian notes to a lightning-fast public wiki.',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
