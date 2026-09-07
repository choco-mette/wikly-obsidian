import Link from 'next/link'
import {
  Clock,
  ExternalLink,
  FileEdit,
  FileText,
  Hash,
  Image as ImageIcon,
  PlusCircle,
  Radio,
  RefreshCw,
} from 'lucide-react'
import { AdminHeader } from '@/components/admin/AdminHeader'
import { dashboardRepo, sitesRepo } from '@/lib/db'

export const dynamic = 'force-dynamic'

export default async function AdminDashboardPage() {
  const site = await sitesRepo.getSiteBySlug('default')
  if (!site) {
    return (
      <div className="admin-page-content">
        <p>Site default belum dikonfigurasi.</p>
      </div>
    )
  }

  const stats = await dashboardRepo.getDashboardStats(site.id)

  return (
    <div className="admin-page-content">
      <AdminHeader
        title="Dashboard Ringkasan"
        description="Gambaran status catatan Obsidian, aset lampiran, dan perangkat terhubung."
      >
        <Link href="/admin/devices" className="btn-secondary">
          <PlusCircle size={15} />
          <span>Tambah Perangkat</span>
        </Link>
        <Link href="/" target="_blank" className="btn-primary">
          <ExternalLink size={15} />
          <span>Lihat Wiki Publik</span>
        </Link>
      </AdminHeader>

      {/* Metric Cards Grid */}
      <div className="admin-stats-grid">
        <div className="stat-card">
          <div className="stat-card-icon blue">
            <FileText size={22} />
          </div>
          <div className="stat-card-body">
            <span className="stat-card-label">Catatan Publik</span>
            <span className="stat-card-value">{stats.publishedPagesCount}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-icon yellow">
            <FileEdit size={22} />
          </div>
          <div className="stat-card-body">
            <span className="stat-card-label">Draft / Belum Terbit</span>
            <span className="stat-card-value">{stats.draftPagesCount}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-icon purple">
            <Hash size={22} />
          </div>
          <div className="stat-card-body">
            <span className="stat-card-label">Total Tag Topik</span>
            <span className="stat-card-value">{stats.tagsCount}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-icon cyan">
            <ImageIcon size={22} />
          </div>
          <div className="stat-card-body">
            <span className="stat-card-label">Aset Lampiran</span>
            <span className="stat-card-value">
              {stats.assetsCount}
              {stats.orphanedAssetsCount > 0 && (
                <small className="stat-card-sub">
                  ({stats.orphanedAssetsCount} orphan)
                </small>
              )}
            </span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-icon green">
            <Radio size={22} />
          </div>
          <div className="stat-card-body">
            <span className="stat-card-label">Perangkat Aktif</span>
            <span className="stat-card-value">{stats.activeDevicesCount}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-icon orange">
            <RefreshCw size={22} />
          </div>
          <div className="stat-card-body">
            <span className="stat-card-label">Pending Changes</span>
            <span className="stat-card-value">{stats.pendingChangesCount}</span>
          </div>
        </div>
      </div>

      {/* Split Details Section */}
      <div className="admin-split-grid">
        {/* Recent Pages */}
        <section className="admin-panel-box">
          <div className="admin-panel-header">
            <div className="admin-panel-title">
              <Clock size={16} />
              <span>Catatan Terakhir Diperbarui</span>
            </div>
            <Link href="/admin/pages" className="panel-more-link">
              Lihat Semua
            </Link>
          </div>

          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Judul</th>
                  <th>Status</th>
                  <th>Revisi</th>
                  <th>Diperbarui</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentPages.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center text-muted">
                      Belum ada catatan yang tersimpan.
                    </td>
                  </tr>
                ) : (
                  stats.recentPages.map((page) => (
                    <tr key={page.id}>
                      <td>
                        <Link
                          href={`/admin/pages/${page.id}/revisions`}
                          className="table-link-title"
                        >
                          {page.title}
                        </Link>
                      </td>
                      <td>
                        <span
                          className={`badge ${page.status === 'published' ? 'badge-success' : 'badge-warning'}`}
                        >
                          {page.status}
                        </span>
                      </td>
                      <td>
                        <span className="revision-pill">
                          rev {page.revision}
                        </span>
                      </td>
                      <td className="text-muted text-sm">
                        {new Date(page.updatedAt).toLocaleDateString('id-ID', {
                          dateStyle: 'medium',
                        })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Recent Pending Changes */}
        <section className="admin-panel-box">
          <div className="admin-panel-header">
            <div className="admin-panel-title">
              <RefreshCw size={16} />
              <span>Antrian Perubahan (Write-Back)</span>
            </div>
            <Link href="/admin/pending-changes" className="panel-more-link">
              Lihat Semua
            </Link>
          </div>

          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Operasi</th>
                  <th>Target Note ID</th>
                  <th>Status</th>
                  <th>Waktu</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentPendingChanges.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center text-muted">
                      Tidak ada antrian perubahan pending.
                    </td>
                  </tr>
                ) : (
                  stats.recentPendingChanges.map((change) => (
                    <tr key={change.id}>
                      <td>
                        <span className="code-tag">{change.operation}</span>
                      </td>
                      <td className="text-sm font-mono">{change.sourceId}</td>
                      <td>
                        <span
                          className={`badge ${
                            change.status === 'applied'
                              ? 'badge-success'
                              : change.status === 'failed'
                                ? 'badge-danger'
                                : 'badge-warning'
                          }`}
                        >
                          {change.status}
                        </span>
                      </td>
                      <td className="text-muted text-sm">
                        {new Date(change.createdAt).toLocaleTimeString(
                          'id-ID',
                          {
                            timeStyle: 'short',
                          },
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}
