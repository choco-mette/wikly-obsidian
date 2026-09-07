'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { BookOpen, FileText, Hash, Menu, Search, Share2, X } from 'lucide-react'

interface WikiNavProps {
  siteName: string
  pages: Array<{ id: string; title: string; slug: string }>
}

export function WikiNav({ siteName, pages }: WikiNavProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const pathname = usePathname()
  const router = useRouter()

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`)
      setIsOpen(false)
    }
  }

  return (
    <>
      {/* Mobile Bar */}
      <div className="mobile-header">
        <button
          className="mobile-menu-btn"
          onClick={() => setIsOpen(!isOpen)}
          aria-label={isOpen ? 'Close navigation' : 'Open navigation'}
        >
          {isOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        <Link href="/" className="mobile-title">
          <BookOpen size={18} className="brand-icon" />
          <span>{siteName}</span>
        </Link>
      </div>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside className={`wiki-sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <Link
            href="/"
            onClick={() => setIsOpen(false)}
            className="brand-link"
          >
            <div className="brand-logo-box">
              <BookOpen size={22} className="brand-icon" />
            </div>
            <div>
              <div className="brand-title">{siteName}</div>
              <div className="brand-subtitle">Obsidian Public Vault</div>
            </div>
          </Link>
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="sidebar-search-form">
          <div className="search-input-wrapper">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Search notes..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="search-input"
            />
          </div>
        </form>

        {/* Navigation Sections */}
        <nav className="sidebar-nav">
          <div className="nav-group">
            <div className="nav-group-title">Main Menu</div>
            <Link
              href="/"
              onClick={() => setIsOpen(false)}
              className={`nav-link ${pathname === '/' || pathname === '/home' ? 'active' : ''}`}
            >
              <FileText size={16} />
              <span>Home</span>
            </Link>
            <Link
              href="/tags"
              onClick={() => setIsOpen(false)}
              className={`nav-link ${pathname.startsWith('/tags') ? 'active' : ''}`}
            >
              <Hash size={16} />
              <span>Tags</span>
            </Link>
            <Link
              href="/graph"
              onClick={() => setIsOpen(false)}
              className={`nav-link ${pathname === '/graph' ? 'active' : ''}`}
            >
              <Share2 size={16} />
              <span>Graph View</span>
            </Link>
          </div>

          <div className="nav-group">
            <div className="nav-group-title">
              All Notes ({pages.length})
            </div>
            <ul className="pages-list">
              {pages.map((page) => {
                const isActive = pathname === `/${page.slug}`
                return (
                  <li key={page.id}>
                    <Link
                      href={`/${page.slug}`}
                      onClick={() => setIsOpen(false)}
                      className={`nav-page-link ${isActive ? 'active' : ''}`}
                    >
                      <span className="page-dot" />
                      <span className="page-title">{page.title}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        </nav>
      </aside>
    </>
  )
}
