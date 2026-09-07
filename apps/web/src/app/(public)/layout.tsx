import { WikiNav } from '@/components/WikiNav'
import { pagesRepo, sitesRepo } from '@/lib/db'

export const dynamic = 'force-dynamic'

export default async function PublicLayout({
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
    <div className="app-container">
      <WikiNav siteName={siteName} pages={pages} />
      <div className="main-content-wrapper">{children}</div>
    </div>
  )
}
