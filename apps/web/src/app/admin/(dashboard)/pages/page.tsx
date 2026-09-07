import Link from 'next/link'
import type { Route } from 'next'
import { FileText, Hash, Search } from 'lucide-react'
import { AdminHeader } from '@/components/admin/AdminHeader'
import { pagesRepo, sitesRepo } from '@/lib/db'
import { PageRowActions } from './PageRowActions'

export const dynamic = 'force-dynamic'

interface PagesAdminPageProps {
  searchParams: Promise<{ q?: string; status?: string }>
}

export default async function AdminPagesPage({
  searchParams,
}: PagesAdminPageProps) {
  const { q, status } = await searchParams
  const site = await sitesRepo.getSiteBySlug('default')

  if (!site) {
    return <div className="admin-page-content">Site tidak ditemukan.</div>
  }

  const pagesList = await pagesRepo.getAllPagesAdmin(site.id, {
    search: q,
    status,
  })

  return (
    <div className="admin-page-content">
      <AdminHeader
        title="Note Management"
        description="List of Obsidian notes registered and projected to the server."
      />

      {/* Filter and Search Bar */}
      <div className="admin-toolbar">
        <form method="GET" className="admin-search-form">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            name="q"
            defaultValue={q || ''}
            placeholder="Search title, slug, or vault path..."
            className="admin-search-input"
          />
          {status && <input type="hidden" name="status" value={status} />}
        </form>

        <div className="admin-filter-tabs">
          <Link
            href={
              `/admin/pages${q ? `?q=${encodeURIComponent(q)}` : ''}` as Route<string>
            }
            className={`filter-tab ${!status || status === 'all' ? 'active' : ''}`}
          >
            All
          </Link>
          <Link
            href={
              `/admin/pages?status=published${q ? `&q=${encodeURIComponent(q)}` : ''}` as Route<string>
            }
            className={`filter-tab ${status === 'published' ? 'active' : ''}`}
          >
            Published
          </Link>
          <Link
            href={
              `/admin/pages?status=unpublished${q ? `&q=${encodeURIComponent(q)}` : ''}` as Route<string>
            }
            className={`filter-tab ${status === 'unpublished' ? 'active' : ''}`}
          >
            Draft / Inactive
          </Link>
        </div>
      </div>

      {/* Pages Table */}
      <div className="admin-panel-box">
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Note Title</th>
                <th>Vault Path</th>
                <th>Status</th>
                <th>Tags</th>
                <th>Revision</th>
                <th>Updated</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pagesList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center text-muted py-8">
                    No notes matched your search or filter.
                  </td>
                </tr>
              ) : (
                pagesList.map((page) => (
                  <tr key={page.id}>
                    <td>
                      <div className="table-page-cell">
                        <FileText size={16} className="text-muted" />
                        <Link
                          href={
                            `/admin/pages/${page.id}/revisions` as Route<string>
                          }
                          className="table-link-title"
                        >
                          {page.title}
                        </Link>
                      </div>
                    </td>
                    <td>
                      <code className="text-xs text-muted">{page.path}</code>
                    </td>
                    <td>
                      <span
                        className={`badge ${page.status === 'published' ? 'badge-success' : 'badge-warning'}`}
                      >
                        {page.status}
                      </span>
                    </td>
                    <td>
                      <div className="tag-badges-inline">
                        {page.tags.length === 0 ? (
                          <span className="text-muted text-xs">—</span>
                        ) : (
                          page.tags.map((t) => (
                            <span key={t.id} className="tag-badge small">
                              <Hash size={10} />
                              {t.name}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    <td>
                      <span className="revision-pill">rev {page.revision}</span>
                    </td>
                    <td className="text-muted text-sm">
                      {new Date(page.updatedAt).toLocaleDateString('en-US', {
                        dateStyle: 'medium',
                      })}
                    </td>
                    <td className="text-right">
                      <PageRowActions page={page} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
