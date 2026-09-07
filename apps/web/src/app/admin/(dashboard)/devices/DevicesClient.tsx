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
        setError(data.error || 'Failed to register device')
        setLoading(false)
        return
      }

      setCreatedCode(data.device.pairingCode)
      setCreatedName(data.device.name)
      setDeviceName('')
      setLoading(false)
      router.refresh()
    } catch {
      setError('A network error occurred')
      setLoading(false)
    }
  }

  const handleRevoke = async (deviceId: string, name: string) => {
    if (
      !confirm(
        `Revoke access for device "${name}"? Device token will become invalid immediately and will no longer be able to publish notes.`,
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
        alert(data.error || 'Failed to revoke access')
      }
    } catch {
      alert('A network error occurred')
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
        alert(data.error || 'Failed to generate new code')
      }
    } catch {
      alert('A network error occurred')
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
            All
          </Link>
          <Link
            href={'/admin/devices?status=approved' as Route<string>}
            className={`filter-tab ${currentFilter === 'approved' ? 'active' : ''}`}
          >
            Approved
          </Link>
          <Link
            href={'/admin/devices?status=pending' as Route<string>}
            className={`filter-tab ${currentFilter === 'pending' ? 'active' : ''}`}
          >
            Pending Pairing
          </Link>
          <Link
            href={'/admin/devices?status=revoked' as Route<string>}
            className={`filter-tab ${currentFilter === 'revoked' ? 'active' : ''}`}
          >
            Revoked
          </Link>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="btn-primary"
          type="button"
        >
          <PlusCircle size={15} />
          <span>Register New Device</span>
        </button>
      </div>

      {/* Devices Table */}
      <div className="admin-panel-box">
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Device Name</th>
                <th>Status</th>
                <th>Last Seen</th>
                <th>Approved At</th>
                <th>Created</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {devices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center text-muted py-8">
                    No devices registered for this filter.
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
                        ? new Date(device.lastSeenAt).toLocaleString('en-US', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })
                        : '—'}
                    </td>
                    <td className="text-muted text-sm">
                      {device.approvedAt
                        ? new Date(device.approvedAt).toLocaleDateString(
                            'en-US',
                            {
                              dateStyle: 'medium',
                            },
                          )
                        : '—'}
                    </td>
                    <td className="text-muted text-sm">
                      {new Date(device.createdAt).toLocaleDateString('en-US', {
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
                            title="Revoke Device Access"
                          >
                            <ShieldAlert size={14} />
                            <span>Revoke Access</span>
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
                            title="Generate New Pairing Code"
                          >
                            <RefreshCw size={14} />
                            <span>Generate Code</span>
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
                    ? 'One-Time Pairing Code'
                    : 'Register New Device'}
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
                    Device <strong>{createdName}</strong> was successfully
                    registered. Enter this pairing code in the Obsidian
                    plugin settings:
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
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy size={16} />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="pairing-instructions">
                    <AlertTriangle size={15} />
                    <span>
                      This code is only valid for <strong>15 minutes</strong>{' '}
                      and will be invalidated immediately after the first pairing.
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
                      Device Name
                    </label>
                    <input
                      id="deviceNameInput"
                      type="text"
                      required
                      placeholder="e.g. MacBook Pro Vault, iPad Obsidian"
                      value={deviceName}
                      onChange={(e) => setDeviceName(e.target.value)}
                      className="form-input"
                      autoFocus
                    />
                    <small className="form-help">
                      Give this device a recognizable name.
                    </small>
                  </div>

                  <div className="modal-footer">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="btn-secondary"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="btn-primary"
                    >
                      {loading ? 'Registering...' : 'Generate Pairing Code'}
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
                    Done
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
