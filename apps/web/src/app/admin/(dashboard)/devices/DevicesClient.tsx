'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { Route } from 'next'

import {
  AlertTriangle,
  Check,
  Copy,
  Key,
  PlusCircle,
  Radio,
  RefreshCw,
  ShieldAlert,
  X,
} from 'lucide-react'
import type { DeviceRecord } from '@/lib/db/repos/devices'

interface DevicesClientProps {
  initialDevices: DeviceRecord[]
  siteId: string
  currentFilter: string
}

export function DevicesClient({
  initialDevices,
  siteId,
  currentFilter,
}: DevicesClientProps) {
  const router = useRouter()
  const [devices, setDevices] = useState(initialDevices)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [deviceName, setDeviceName] = useState('')
  const [createdCode, setCreatedCode] = useState<string | null>(null)
  const [createdName, setCreatedName] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!deviceName.trim()) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/admin/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          siteId,
          name: deviceName.trim(),
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        setError(data.error || 'Gagal mendaftarkan perangkat')
        setLoading(false)
        return
      }

      setCreatedCode(data.device.pairingCode)
      setCreatedName(data.device.name)
      setDeviceName('')
      setLoading(false)
      router.refresh()
    } catch {
      setError('Terjadi kesalahan jaringan')
      setLoading(false)
    }
  }

  const handleRevoke = async (deviceId: string, name: string) => {
    if (
      !confirm(
        `Cabut akses untuk perangkat "${name}"? Token perangkat akan segera tidak valid dan tidak dapat mempublikasikan catatan lagi.`,
      )
    ) {
      return
    }

    try {
      const res = await fetch('/api/admin/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revoke', deviceId }),
      })

      const data = await res.json()
      if (res.ok && data.success) {
        setDevices((prev) =>
          prev.map((d) =>
            d.id === deviceId ? { ...d, status: 'revoked' } : d,
          ),
        )
        router.refresh()
      } else {
        alert(data.error || 'Gagal mencabut akses')
      }
    } catch {
      alert('Terjadi kesalahan jaringan')
    }
  }

  const handleRegenerate = async (deviceId: string, name: string) => {
    try {
      const res = await fetch('/api/admin/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'regenerate', deviceId }),
      })

      const data = await res.json()
      if (res.ok && data.success) {
        setCreatedCode(data.pairingCode)
        setCreatedName(name)
        setIsModalOpen(true)
        router.refresh()
      } else {
        alert(data.error || 'Gagal membuat kode baru')
      }
    } catch {
      alert('Terjadi kesalahan jaringan')
    }
  }

  const copyToClipboard = () => {
    if (createdCode) {
      navigator.clipboard.writeText(createdCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setCreatedCode(null)
    setCreatedName(null)
    setError(null)
    setDeviceName('')
  }

  return (
    <>
      <div className="admin-toolbar">
        <div className="admin-filter-tabs">
          <Link
            href={'/admin/devices' as Route<string>}
            className={`filter-tab ${currentFilter === 'all' ? 'active' : ''}`}
          >
            Semua
          </Link>
          <Link
            href={'/admin/devices?status=approved' as Route<string>}
            className={`filter-tab ${currentFilter === 'approved' ? 'active' : ''}`}
          >
            Terverifikasi (Approved)
          </Link>
          <Link
            href={'/admin/devices?status=pending' as Route<string>}
            className={`filter-tab ${currentFilter === 'pending' ? 'active' : ''}`}
          >
            Menunggu Pairing
          </Link>
          <Link
            href={'/admin/devices?status=revoked' as Route<string>}
            className={`filter-tab ${currentFilter === 'revoked' ? 'active' : ''}`}
          >
            Dicabut (Revoked)
          </Link>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="btn-primary"
          type="button"
        >
          <PlusCircle size={15} />
          <span>Daftarkan Perangkat Baru</span>
        </button>
      </div>

      {/* Devices Table */}
      <div className="admin-panel-box">
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Nama Perangkat</th>
                <th>Status</th>
                <th>Terakhir Terlihat</th>
                <th>Disetujui Pada</th>
                <th>Dibuat</th>
                <th className="text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {devices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center text-muted py-8">
                    Belum ada perangkat terdaftar untuk filter ini.
                  </td>
                </tr>
              ) : (
                devices.map((device) => (
                  <tr key={device.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <Radio size={16} className="text-muted" />
                        <span className="font-medium text-foreground">
                          {device.name}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          device.status === 'approved'
                            ? 'badge-success'
                            : device.status === 'revoked'
                              ? 'badge-danger'
                              : 'badge-warning'
                        }`}
                      >
                        {device.status === 'approved'
                          ? 'Approved'
                          : device.status === 'revoked'
                            ? 'Revoked'
                            : 'Pending Pairing'}
                      </span>
                    </td>
                    <td className="text-muted text-sm">
                      {device.lastSeenAt
                        ? new Date(device.lastSeenAt).toLocaleString('id-ID', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })
                        : '—'}
                    </td>
                    <td className="text-muted text-sm">
                      {device.approvedAt
                        ? new Date(device.approvedAt).toLocaleDateString(
                            'id-ID',
                            {
                              dateStyle: 'medium',
                            },
                          )
                        : '—'}
                    </td>
                    <td className="text-muted text-sm">
                      {new Date(device.createdAt).toLocaleDateString('id-ID', {
                        dateStyle: 'medium',
                      })}
                    </td>
                    <td className="text-right">
                      <div className="table-actions">
                        {device.status === 'approved' && (
                          <button
                            type="button"
                            onClick={() => handleRevoke(device.id, device.name)}
                            className="btn-danger-outline btn-sm"
                            title="Cabut Akses Perangkat"
                          >
                            <ShieldAlert size={14} />
                            <span>Cabut Akses</span>
                          </button>
                        )}
                        {(device.status === 'pending' ||
                          device.status === 'revoked') && (
                          <button
                            type="button"
                            onClick={() =>
                              handleRegenerate(device.id, device.name)
                            }
                            className="btn-secondary btn-sm"
                            title="Buat Kode Pairing Baru"
                          >
                            <RefreshCw size={14} />
                            <span>Buat Kode Baru</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Dialog for Device Registration & Pairing Code */}
      {isModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-dialog">
            <div className="modal-header">
              <div className="modal-title">
                <Key size={18} />
                <span>
                  {createdCode
                    ? 'Kode Pairing One-Time'
                    : 'Daftarkan Perangkat Baru'}
                </span>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="modal-close-btn"
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              {createdCode ? (
                <div className="pairing-result-box">
                  <p className="text-sm text-muted mb-3">
                    Perangkat <strong>{createdName}</strong> berhasil
                    didaftarkan. Masukkan kode pairing ini pada pengaturan
                    plugin Obsidian:
                  </p>

                  <div className="pairing-code-display">
                    <span className="pairing-code-text">{createdCode}</span>
                    <button
                      type="button"
                      onClick={copyToClipboard}
                      className="btn-copy"
                    >
                      {copied ? (
                        <>
                          <Check size={16} />
                          <span>Tersalin!</span>
                        </>
                      ) : (
                        <>
                          <Copy size={16} />
                          <span>Salin</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="pairing-instructions">
                    <AlertTriangle size={15} />
                    <span>
                      Kode ini hanya berlaku selama <strong>15 menit</strong>{' '}
                      dan langsung dihanguskan setelah pertama kali dipasangkan.
                    </span>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleCreate}>
                  {error && (
                    <div className="admin-alert error mb-4">
                      <span>{error}</span>
                    </div>
                  )}

                  <div className="form-group">
                    <label htmlFor="deviceNameInput" className="form-label">
                      Nama Perangkat
                    </label>
                    <input
                      id="deviceNameInput"
                      type="text"
                      required
                      placeholder="Contoh: MacBook Pro Vault, iPad Obsidian"
                      value={deviceName}
                      onChange={(e) => setDeviceName(e.target.value)}
                      className="form-input"
                      autoFocus
                    />
                    <small className="form-help">
                      Beri nama yang mudah dikenali untuk perangkat ini.
                    </small>
                  </div>

                  <div className="modal-footer">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="btn-secondary"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="btn-primary"
                    >
                      {loading ? 'Mendaftarkan...' : 'Buat Kode Pairing'}
                    </button>
                  </div>
                </form>
              )}

              {createdCode && (
                <div className="modal-footer">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="btn-primary w-full"
                  >
                    Selesai
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
