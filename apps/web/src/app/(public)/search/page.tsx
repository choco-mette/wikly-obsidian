import Link from 'next/link'
import type { Metadata } from 'next'
import { Calendar, Search } from 'lucide-react'
import { sitesRepo, pagesRepo } from '@/lib/db'

interface SearchPageProps {
  searchParams: Promise<{ q?: string }>
}

export async function generateMetadata({
  searchParams,
}: SearchPageProps): Promise<Metadata> {
  const { q } = await searchParams
  return {
    title: q ? `Pencarian: "${q}"` : 'Pencarian Catatan',
    description: 'Cari catatan dan pengetahuan di dalam Wikly vault.',
  }
}

export const dynamic = 'force-dynamic'

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q } = await searchParams
  const query = q?.trim() || ''

  const site = await sitesRepo.getSiteBySlug('default')
  const results =
    site && query ? await pagesRepo.searchPages(site.id, query) : []

  return (
    <div className="content-inner">
      <div className="article-container">
        <header className="page-header">
          <h1 className="page-title">Pencarian Catatan</h1>
          <form action="/search" method="GET" style={{ marginTop: '1.25rem' }}>
            <div className="search-input-wrapper">
              <Search size={18} className="search-icon" />
              <input
                type="text"
                name="q"
                defaultValue={query}
                placeholder="Ketik kata kunci untuk mencari..."
                className="search-input"
                style={{
                  padding: '0.85rem 1rem 0.85rem 2.75rem',
                  fontSize: '1rem',
                }}
                autoFocus
              />
            </div>
          </form>
        </header>

        {query && (
          <div
            style={{
              marginBottom: '1rem',
              color: 'var(--text-muted)',
              fontSize: '0.9rem',
            }}
          >
            Ditemukan {results.length} hasil untuk &ldquo;{query}&rdquo;:
          </div>
        )}

        {query && results.length === 0 && (
          <div
            style={{
              padding: '2.5rem 1rem',
              textAlign: 'center',
              background: 'var(--bg-card)',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-muted)',
            }}
          >
            Tidak ada catatan yang cocok dengan kata kunci tersebut.
          </div>
        )}

        <div className="search-results-list">
          {results.map((page) => {
            const formattedDate = new Intl.DateTimeFormat('id-ID', {
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
                  {page.markdown.replace(/^[#\s>*-]+/gm, '').slice(0, 180)}...
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
                  <span>Diperbarui {formattedDate}</span>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
