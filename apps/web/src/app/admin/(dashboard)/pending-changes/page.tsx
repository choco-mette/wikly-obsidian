import Link from 'next/link'
import type { Route } from 'next'
import { AlertCircle } from 'lucide-react'
import { AdminHeader } from '@/components/admin/AdminHeader'
import { pendingChangesRepo, sitesRepo } from '@/lib/db'
import { RetryChangeButton } from './RetryChangeButton'

export const dynamic = 'force-dynamic'

interface PendingChangesPageProps {
  searchParams: Promise<{ status?: string }>
}

export default async function AdminPendingChangesPage({
  searchParams,
}: PendingChangesPageProps) {
  const { status } = await searchParams
  const site = await sitesRepo.getSiteBySlug('default')

  if (!site) {
    return <div className="admin-page-content">Site tidak ditemukan.</div>
  }

  const currentStatus = status || 'all'
  const changes = await pendingChangesRepo.getPendingChanges(
    site.id,
    currentStatus,
  )

  return (
    <div className="admin-page-content">
      <AdminHeader
        title="Pending Changes (Write-Back)"
        description="Daftar operasi perubahan yang menunggu diklaim dan diaplikasikan oleh plugin Obsidian."
      />

      {/* Toolbar filter */}
      <div className="admin-toolbar">
        <div className="admin-filter-tabs">
          <Link
            href={'/admin/pending-changes' as Route<string>}
            className={`filter-tab ${currentStatus === 'all' ? 'active' : ''}`}
          >
            Semua
          </Link>
          <Link
            href={'/admin/pending-changes?status=pending' as Route<string>}
            className={`filter-tab ${currentStatus === 'pending' ? 'active' : ''}`}
          >
            Pending
          </Link>
          <Link
            href={'/admin/pending-changes?status=claimed' as Route<string>}
            className={`filter-tab ${currentStatus === 'claimed' ? 'active' : ''}`}
          >
            Sedang Diklaim
          </Link>
          <Link
            href={'/admin/pending-changes?status=applied' as Route<string>}
            className={`filter-tab ${currentStatus === 'applied' ? 'active' : ''}`}
          >
            Berhasil Diaplikasikan
          </Link>
          <Link
            href={'/admin/pending-changes?status=failed' as Route<string>}
            className={`filter-tab ${currentStatus === 'failed' ? 'active' : ''}`}
          >
            Gagal
          </Link>
        </div>
      </div>

      {/* Table */}
      <div className="admin-panel-box">
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Operasi</th>
                <th>Target Source ID</th>
                <th>Status</th>
                <th>Percobaan</th>
                <th>Detail Payload</th>
                <th>Dibuat</th>
                <th className="text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {changes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center text-muted py-8">
                    Tidak ada antrian perubahan untuk filter ini.
                  </td>
                </tr>
              ) : (
                changes.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <span className="code-tag">{item.operation}</span>
                    </td>
                    <td>
                      <code className="text-xs font-mono">{item.sourceId}</code>
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          item.status === 'applied'
                            ? 'badge-success'
                            : item.status === 'failed'
                              ? 'badge-danger'
                              : item.status === 'claimed'
                                ? 'badge-info'
                                : 'badge-warning'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td>
                      <span className="text-sm">{item.attemptCount}x</span>
                    </td>
                    <td>
                      <div className="payload-preview-cell">
                        <pre className="payload-json">
                          <code>{JSON.stringify(item.payload, null, 2)}</code>
                        </pre>
                        {item.lastError && (
                          <div className="payload-error-note">
                            <AlertCircle size={12} />
                            <span>{item.lastError}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="text-muted text-sm">
                      {new Date(item.createdAt).toLocaleString('id-ID', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </td>
                    <td className="text-right">
                      {item.status === 'failed' ? (
                        <RetryChangeButton changeId={item.id} />
                      ) : (
                        <span className="text-muted text-xs">—</span>
                      )}
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
