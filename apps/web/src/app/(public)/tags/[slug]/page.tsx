import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { Calendar, ChevronRight, Hash } from 'lucide-react'
import { sitesRepo, tagsRepo } from '@/lib/db'

interface TagPageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({
  params,
}: TagPageProps): Promise<Metadata> {
  const { slug } = await params
  return {
    title: `Tag: #${slug}`,
    description: `Notes tagged #${slug} on Wikly`,
  }
}

export const dynamic = 'force-dynamic'

export default async function TagSinglePage({ params }: TagPageProps) {
  const { slug } = await params
  const site = await sitesRepo.getSiteBySlug('default')
  if (!site) notFound()

  const { tag, pages } = await tagsRepo.getPagesByTagSlug(site.id, slug)
  if (!tag) notFound()

  return (
    <div className="content-inner">
      <div className="article-container">
        <header className="page-header">
          <nav className="breadcrumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <ChevronRight size={14} />
            <Link href="/tags">Tags</Link>
            <ChevronRight size={14} />
            <span>#{tag.name}</span>
          </nav>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              marginBottom: '0.5rem',
            }}
          >
            <Hash size={28} color="var(--accent-green)" />
            <h1 className="page-title" style={{ marginBottom: 0 }}>
              {tag.name}
            </h1>
          </div>
          <p className="page-meta">
            {pages.length} {pages.length === 1 ? 'note' : 'notes'} tagged with this topic.
          </p>
        </header>

        <div className="search-results-list">
          {pages.map((page) => {
            const formattedDate = new Intl.DateTimeFormat('en-US', {
              dateStyle: 'medium',
            }).format(page.updatedAt)

            return (
              <Link
                key={page.id}
                href={`/${page.slug}`}
                className="search-result-card"
              >
                <div className="search-result-title">{page.title}</div>
                <p className="search-result-excerpt">
                  {page.markdown.replace(/^[#\s>*-]+/gm, '').slice(0, 160)}...
                </p>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    marginTop: '0.75rem',
                    fontSize: '0.8rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  <Calendar size={13} />
                  <span>Updated {formattedDate}</span>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
