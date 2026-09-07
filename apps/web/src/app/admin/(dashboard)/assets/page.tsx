import Link from 'next/link'
import type { Route } from 'next'
import { ExternalLink, File, Image as ImageIcon, Search } from 'lucide-react'
import { AdminHeader } from '@/components/admin/AdminHeader'
import { assetsRepo, sitesRepo } from '@/lib/db'

export const dynamic = 'force-dynamic'

interface AssetsAdminPageProps {
  searchParams: Promise<{ q?: string; orphaned?: string }>
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export default async function AdminAssetsPage({
  searchParams,
}: AssetsAdminPageProps) {
  const { q, orphaned } = await searchParams
  const site = await sitesRepo.getSiteBySlug('default')

  if (!site) {
    return <div className="admin-page-content">Site not found.</div>
  }

  const isOrphanedOnly = orphaned === 'true'
  const assetsList = await assetsRepo.getAllAssetsAdmin(site.id, {
    search: q,
    orphanedOnly: isOrphanedOnly,
  })

  return (
    <div className="admin-page-content">
      <AdminHeader
        title="Media Assets & Attachments"
        description="List of images, diagrams, and binary media files uploaded from the Obsidian Vault."
      />

      {/* Toolbar */}
      <div className="admin-toolbar">
        <form method="GET" className="admin-search-form">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            name="q"
            defaultValue={q || ''}
            placeholder="Search file name or hash..."
            className="admin-search-input"
          />
          {orphaned && <input type="hidden" name="orphaned" value={orphaned} />}
        </form>

        <div className="admin-filter-tabs">
          <Link
            href={
              `/admin/assets${q ? `?q=${encodeURIComponent(q)}` : ''}` as Route<string>
            }
            className={`filter-tab ${!isOrphanedOnly ? 'active' : ''}`}
          >
            All Assets
          </Link>
          <Link
            href={
              `/admin/assets?orphaned=true${q ? `&q=${encodeURIComponent(q)}` : ''}` as Route<string>
            }
            className={`filter-tab ${isOrphanedOnly ? 'active' : ''}`}
          >
            Orphan Assets (Unreferenced)
          </Link>
        </div>
      </div>

      {/* Assets Table */}
      <div className="admin-panel-box">
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Preview & File Name</th>
                <th>Content Type</th>
                <th>Size</th>
                <th>SHA-256 Hash</th>
                <th>Status</th>
                <th>References</th>
                <th>Created</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {assetsList.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center text-muted py-8">
                    No media assets uploaded yet.
                  </td>
                </tr>
              ) : (
                assetsList.map((asset) => {
                  const isImage = asset.mimeType.startsWith('image/')
                  const isOrphan = asset.orphanedAt !== null

                  return (
                    <tr key={asset.id}>
                      <td>
                        <div className="table-asset-preview-cell">
                          {isImage ? (
                            <div className="asset-thumbnail-wrapper">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={asset.publicUrl}
                                alt={asset.filename}
                                className="asset-thumbnail"
                                loading="lazy"
                              />
                            </div>
                          ) : (
                            <div className="asset-file-icon">
                              <File size={20} className="text-muted" />
                            </div>
                          )}
                          <div className="asset-info">
                            <span className="asset-name">{asset.filename}</span>
                            <span className="asset-storage-key text-xs text-muted">
                              {asset.storageKey}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <code className="text-xs">{asset.mimeType}</code>
                      </td>
                      <td className="text-sm">
                        {formatBytes(asset.sizeBytes)}
                      </td>
                      <td>
                        <span
                          className="font-mono text-xs text-muted"
                          title={asset.hash}
                        >
                          {asset.hash.slice(0, 16)}...
                        </span>
                      </td>
                      <td>
                        <span
                          className={`badge ${isOrphan ? 'badge-danger' : 'badge-success'}`}
                        >
                          {isOrphan ? 'Orphan' : 'Active'}
                        </span>
                      </td>
                      <td>
                        <span className="count-pill">
                          {asset.referencedPagesCount}{' '}
                          {asset.referencedPagesCount === 1 ? 'page' : 'pages'}
                        </span>
                      </td>
                      <td className="text-muted text-sm">
                        {new Date(asset.createdAt).toLocaleDateString('en-US', {
                          dateStyle: 'medium',
                        })}
                      </td>
                      <td className="text-right">
                        <Link
                          href={asset.publicUrl as Route<string>}
                          target="_blank"
                          className="btn-icon"
                          title="Open Asset File"
                        >
                          <ExternalLink size={15} />
                        </Link>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
