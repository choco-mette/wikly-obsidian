'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { Route } from 'next'
import { ExternalLink, GitCommit, Tag, X } from 'lucide-react'

interface PageRowActionsProps {
  page: {
    id: string
    title: string
    slug: string
    sourceId: string
    status: string
    revision: number
    tags: Array<{ id: string; name: string }>
  }
}

export function PageRowActions({ page }: PageRowActionsProps) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [tags, setTags] = useState<string[]>(page.tags.map((t) => t.name))
  const [newTagInput, setNewTagInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)

  const handleOpen = () => {
    setTags(page.tags.map((t) => t.name))
    setNewTagInput('')
    setMessage(null)
    setModalOpen(true)
  }

  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault()
    const clean = newTagInput.trim().replace(/^#/, '')
    if (clean && !tags.includes(clean)) {
      setTags([...tags, clean])
      setNewTagInput('')
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove))
  }

  const handleSubmitPatch = async () => {
    setLoading(true)
    setMessage(null)

    const initialTags = page.tags.map((t) => t.name)
    const add = tags.filter((t) => !initialTags.includes(t))
    const remove = initialTags.filter((t) => !tags.includes(t))

    if (add.length === 0 && remove.length === 0) {
      setMessage({
        type: 'error',
        text: 'Tidak ada perubahan tag yang dilakukan.',
      })
      setLoading(false)
      return
    }

    try {
      const res = await fetch('/api/admin/pending-changes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceId: page.sourceId,
          operation: 'frontmatter.patch',
          baseRevision: page.revision,
          patch: {
            tags: {
              add: add.length > 0 ? add : undefined,
              remove: remove.length > 0 ? remove : undefined,
            },
          },
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gagal mendaftarkan perubahan write-back')
      }

      setMessage({
        type: 'success',
        text: 'Perubahan tag berhasil didaftarkan ke antrean write-back Obsidian!',
      })
      setTimeout(() => {
        setModalOpen(false)
        router.refresh()
      }, 1200)
    } catch (err: unknown) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Terjadi kesalahan sistem',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="table-actions">
        <button
          onClick={handleOpen}
          className="btn-icon"
          title="Patch Tag Frontmatter (Write-Back)"
        >
          <Tag size={15} />
        </button>
        <Link
          href={`/admin/pages/${page.id}/revisions` as Route<string>}
          className="btn-icon"
          title="Lihat Riwayat Revisi"
        >
          <GitCommit size={15} />
        </Link>
        {page.status === 'published' && (
          <Link
            href={`/${page.slug}` as Route<string>}
            target="_blank"
            className="btn-icon"
            title="Buka Halaman Publik"
          >
            <ExternalLink size={15} />
          </Link>
        )}
      </div>

      {modalOpen && (
        <div className="modal-backdrop">
          <div className="modal-box">
            <div className="modal-header">
              <h3>Edit Tag Frontmatter (Write-Back)</h3>
              <button
                onClick={() => setModalOpen(false)}
                className="modal-close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <p className="modal-desc">
                Perubahan tag akan dikirim sebagai operasi{' '}
                <code>frontmatter.patch</code> ke antrean{' '}
                <strong>pending changes</strong> dan diaplikasikan ke catatan
                Obsidian Vault oleh plugin.
              </p>

              <div className="note-info-card">
                <div>
                  <strong>Catatan:</strong> {page.title}
                </div>
                <div>
                  <small className="text-muted font-mono">
                    Source ID: {page.sourceId}
                  </small>
                </div>
              </div>

              {message && (
                <div className={`alert-box ${message.type}`}>
                  {message.text}
                </div>
              )}

              <div className="tag-editor-section">
                <label className="form-label">Daftar Tag Aktif</label>
                <div className="tag-chips-container">
                  {tags.length === 0 ? (
                    <span className="text-muted text-xs">Belum ada tag.</span>
                  ) : (
                    tags.map((tag) => (
                      <span key={tag} className="tag-chip">
                        #{tag}
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          className="tag-chip-remove"
                        >
                          &times;
                        </button>
                      </span>
                    ))
                  )}
                </div>

                <form onSubmit={handleAddTag} className="add-tag-form">
                  <input
                    type="text"
                    value={newTagInput}
                    onChange={(e) => setNewTagInput(e.target.value)}
                    placeholder="Tambah tag baru (misal: mikrotik)..."
                    className="form-input"
                  />
                  <button type="submit" className="btn-secondary">
                    Tambah
                  </button>
                </form>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="btn-secondary"
                disabled={loading}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSubmitPatch}
                className="btn-primary"
                disabled={loading}
              >
                {loading ? 'Mengirim...' : 'Kirim Write-Back'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
