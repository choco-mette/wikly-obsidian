import type { Metadata } from 'next'
import './globals.css'
import { WikiNav } from '../components/WikiNav'
import { sitesRepo, pagesRepo } from '../lib/db'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: {
    template: '%s | Wikly',
    default: 'Wikly — Obsidian Knowledge Platform',
  },
  description:
    'Publikasikan catatan Obsidian pilihan ke web publik berkecepatan tinggi.',
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  let siteName = 'Wikly'
  let pages: Array<{ id: string; title: string; slug: string }> = []

  try {
    const site = await sitesRepo.getSiteBySlug('default')
    if (site) {
      siteName = site.name
      const published = await pagesRepo.getPublishedPages(site.id, 100)
      pages = published.map((p) => ({
        id: p.id,
        title: p.title,
        slug: p.slug,
      }))
    }
  } catch (error) {
    console.error('Failed to load navigation data:', error)
  }

  return (
    <html lang="id">
      <body>
        <div className="app-container">
          <WikiNav siteName={siteName} pages={pages} />
          <div className="main-content-wrapper">{children}</div>
        </div>
      </body>
    </html>
  )
}
