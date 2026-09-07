import Link from 'next/link'
import type { Route } from 'next'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  Calendar,
  Clock,
  ExternalLink,
  GitCommit,
  Hash,
  ShieldCheck,
} from 'lucide-react'
import { AdminHeader } from '@/components/admin/AdminHeader'
import { pagesRepo } from '@/lib/db'

export const dynamic = 'force-dynamic'

interface RevisionsPageProps {
  params: Promise<{ id: string }>
}

export default async function PageRevisionsPage({
  params,
}: RevisionsPageProps) {
  const { id } = await params
  const { page, revisions } = await pagesRepo.getPageWithRevisions(id)

  if (!page) {
    notFound()
  }

  return (
    <div className="admin-page-content">
      <div className="mb-4">
        <Link href="/admin/pages" className="back-link">
          <ArrowLeft size={14} />
          <span>Kembali ke Daftar Catatan</span>
        </Link>
      </div>

      <AdminHeader
        title={`Riwayat Revisi: ${page.title}`}
        description={`Menampilkan ${revisions.length} revisi untuk catatan ini.`}
      >
        {page.status === 'published' && (
          <Link
            href={`/${page.slug}` as Route<string>}
            target="_blank"
            className="btn-secondary"
          >
            <ExternalLink size={14} />
            <span>Buka Halaman Publik</span>
          </Link>
        )}
      </AdminHeader>

      {/* Metadata Overview Card */}
      <div className="admin-meta-summary">
        <div className="meta-col">
          <span className="meta-label">Source ID (wiki.id)</span>
          <code className="meta-val font-mono">{page.sourceId}</code>
        </div>
        <div className="meta-col">
          <span className="meta-label">Path Vault</span>
          <code className="meta-val">{page.path}</code>
        </div>
        <div className="meta-col">
          <span className="meta-label">Slug Publik</span>
          <span className="meta-val">/{page.slug}</span>
        </div>
        <div className="meta-col">
          <span className="meta-label">Status</span>
          <span
            className={`badge ${page.status === 'published' ? 'badge-success' : 'badge-warning'}`}
          >
            {page.status}
          </span>
        </div>
      </div>

      {/* Revision Timeline */}
      <div className="revisions-timeline">
        {revisions.map((rev) => (
          <div key={rev.id} className="revision-card">
            <div className="revision-card-header">
              <div className="revision-title-row">
                <div className="revision-badge">
                  <GitCommit size={15} />
                  <span>rev {rev.revision}</span>
                </div>
                {rev.revision === page.revision && (
                  <span className="badge badge-success">Revisi Terkini</span>
                )}
              </div>

              <div className="revision-meta-items">
                <div className="revision-meta-item">
                  <Clock size={13} />
                  <span>
                    {new Date(rev.createdAt).toLocaleString('id-ID', {
                      dateStyle: 'medium',
                      timeStyle: 'medium',
                    })}
                  </span>
                </div>
                <div className="revision-meta-item">
                  <ShieldCheck size={13} />
                  <span className="font-mono text-xs">
                    {rev.contentHash.slice(0, 19)}...
                  </span>
                </div>
              </div>
            </div>

            <div className="revision-body">
              <pre className="revision-markdown-preview">
                <code>{rev.markdown}</code>
              </pre>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
