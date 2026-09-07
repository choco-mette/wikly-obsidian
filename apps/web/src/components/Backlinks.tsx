import Link from 'next/link'
import { Link2 } from 'lucide-react'
import type { BacklinkItem } from '../lib/db/repos/pages'

interface BacklinksProps {
  backlinks: BacklinkItem[]
}

export function Backlinks({ backlinks }: BacklinksProps) {
  if (!backlinks.length) return null

  return (
    <section className="backlinks-section" aria-labelledby="backlinks-heading">
      <div className="backlinks-header">
        <Link2 className="backlinks-icon" size={18} />
        <h2 id="backlinks-heading">Backlinks ({backlinks.length})</h2>
      </div>
      <p className="backlinks-subtitle">
        Other notes linking to this page:
      </p>
      <div className="backlinks-grid">
        {backlinks.map((link) => (
          <Link key={link.id} href={`/${link.slug}`} className="backlink-card">
            <span className="backlink-title">{link.title}</span>
            {link.linkText && (
              <span className="backlink-context">
                as &ldquo;{link.linkText}&rdquo;
              </span>
            )}
          </Link>
        ))}
      </div>
    </section>
  )
}
