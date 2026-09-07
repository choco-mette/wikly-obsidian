import Link from 'next/link'
import type { Route } from 'next'
import { ExternalLink, Hash } from 'lucide-react'
import { AdminHeader } from '@/components/admin/AdminHeader'
import { sitesRepo, tagsRepo } from '@/lib/db'

export const dynamic = 'force-dynamic'

export default async function AdminTagsPage() {
  const site = await sitesRepo.getSiteBySlug('default')
  if (!site) {
    return <div className="admin-page-content">Site not found.</div>
  }

  const tagsList = await tagsRepo.getAllTagsWithCount(site.id)

  return (
    <div className="admin-page-content">
      <AdminHeader
        title="Tag Management"
        description="Tags automatically extracted from Obsidian note frontmatter."
      />

      <div className="admin-panel-box">
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Tag Name</th>
                <th>URL Slug</th>
                <th>Tagged Notes</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tagsList.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center text-muted py-8">
                    No tags registered from notes yet.
                  </td>
                </tr>
              ) : (
                tagsList.map((tag) => (
                  <tr key={tag.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="tag-badge">
                          <Hash size={12} />
                          <span>{tag.name}</span>
                        </span>
                      </div>
                    </td>
                    <td>
                      <code className="text-xs text-muted">
                        /tags/{tag.slug}
                      </code>
                    </td>
                    <td>
                      <span className="count-pill">
                        {tag.count} {tag.count === 1 ? 'note' : 'notes'}
                      </span>
                    </td>
                    <td className="text-right">
                      <Link
                        href={`/tags/${tag.slug}` as Route<string>}
                        target="_blank"
                        className="btn-icon"
                        title="View notes with this tag"
                      >
                        <ExternalLink size={15} />
                      </Link>
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
