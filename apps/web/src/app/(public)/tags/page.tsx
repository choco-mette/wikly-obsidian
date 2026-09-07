import Link from 'next/link'
import type { Metadata } from 'next'
import { Hash } from 'lucide-react'
import { sitesRepo, tagsRepo } from '@/lib/db'

export const metadata: Metadata = {
  title: 'Tags',
  description: 'Explore all note categories based on Obsidian tags.',
}

export const dynamic = 'force-dynamic'

export default async function TagsPage() {
  const site = await sitesRepo.getSiteBySlug('default')
  const tags = site ? await tagsRepo.getAllTagsWithCount(site.id) : []

  return (
    <div className="content-inner">
      <div className="article-container">
        <header className="page-header">
          <h1 className="page-title">Tags</h1>
          <p className="page-meta">
            Discover topics and notes categorized by tags from Obsidian.
          </p>
        </header>

        {tags.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>
            No tags published yet.
          </p>
        ) : (
          <div className="tags-grid">
            {tags.map((tag) => (
              <Link
                key={tag.id}
                href={`/tags/${tag.slug}`}
                className="tag-card"
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <Hash size={18} color="var(--accent-green)" />
                  <span style={{ fontWeight: 600 }}>{tag.name}</span>
                </div>
                <span className="tag-card-count">
                  {tag.count} {tag.count === 1 ? 'note' : 'notes'}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
