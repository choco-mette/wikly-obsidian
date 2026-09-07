import Link from 'next/link'
import type { Route } from 'next'
import { ExternalLink, Hash } from 'lucide-react'
import { AdminHeader } from '@/components/admin/AdminHeader'
import { sitesRepo, tagsRepo } from '@/lib/db'

export const dynamic = 'force-dynamic'

export default async function AdminTagsPage() {
  const site = await sitesRepo.getSiteBySlug('default')
  if (!site) {
    return <div className="admin-page-content">Site tidak ditemukan.</div>
  }

  const tagsList = await tagsRepo.getAllTagsWithCount(site.id)

  return (
    <div className="admin-page-content">
      <AdminHeader
        title="Manajemen Tag"
        description="Daftar tag yang diekstrak secara otomatis dari frontmatter catatan Obsidian."
      />

      <div className="admin-panel-box">
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Nama Tag</th>
                <th>Slug URL</th>
                <th>Catatan Terkait</th>
                <th className="text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {tagsList.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center text-muted py-8">
                    Belum ada tag yang terdaftar dari catatan.
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
                      <span className="count-pill">{tag.count} catatan</span>
                    </td>
                    <td className="text-right">
                      <Link
                        href={`/tags/${tag.slug}` as Route<string>}
                        target="_blank"
                        className="btn-icon"
                        title="Lihat Daftar Catatan Berdasarkan Tag Ini"
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
