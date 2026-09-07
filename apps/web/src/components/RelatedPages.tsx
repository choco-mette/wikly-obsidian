import Link from 'next/link'
import type { Route } from 'next'
import { Compass, Hash } from 'lucide-react'
import type { RelatedPageItem } from '@/lib/db/repos/pages'

interface RelatedPagesProps {
  pages: RelatedPageItem[]
}

export function RelatedPages({ pages }: RelatedPagesProps) {
  if (!pages || pages.length === 0) return null

  return (
    <section
      className="related-pages-section"
      aria-labelledby="related-heading"
    >
      <div className="related-pages-header">
        <Compass className="related-icon" size={18} />
        <h2 id="related-heading">Related Notes ({pages.length})</h2>
      </div>
      <p className="related-subtitle">
        Notes sharing similar topics or direct links:
      </p>
      <div className="related-pages-grid">
        {pages.map((item) => (
          <Link
            key={item.id}
            href={`/${item.slug}` as Route<string>}
            className="related-card"
          >
            <span className="related-title">{item.title}</span>
            {item.sharedTags.length > 0 && (
              <div className="related-tags">
                {item.sharedTags.map((tag) => (
                  <span key={tag} className="related-tag-badge">
                    <Hash size={10} />
                    <span>{tag}</span>
                  </span>
                ))}
              </div>
            )}
          </Link>
        ))}
      </div>
    </section>
  )
}
