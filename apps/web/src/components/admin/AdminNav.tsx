'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import type { Route } from 'next'
import {
  ExternalLink,
  FileText,
  Hash,
  Image as ImageIcon,
  LayoutDashboard,
  LogOut,
  Radio,
  RefreshCw,
} from 'lucide-react'

interface AdminNavProps {
  userEmail?: string
}

export function AdminNav({ userEmail }: AdminNavProps) {
  const pathname = usePathname()
  const router = useRouter()

  const navItems = [
    { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
    { href: '/admin/pages', label: 'Notes', icon: FileText },
    { href: '/admin/tags', label: 'Tags', icon: Hash },
    { href: '/admin/assets', label: 'Media Assets', icon: ImageIcon },
    { href: '/admin/devices', label: 'Devices & Pairing', icon: Radio },
    {
      href: '/admin/pending-changes',
      label: 'Pending Changes',
      icon: RefreshCw,
    },
  ]

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/auth', { method: 'DELETE' })
      router.push('/admin/login')
      router.refresh()
    } catch {
      router.push('/admin/login')
    }
  }

  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar-header">
        <div className="admin-logo-badge">W</div>
        <div className="admin-logo-info">
          <span className="admin-logo-title">Wikly Admin</span>
          <span className="admin-logo-sub">Management Panel</span>
        </div>
      </div>

      <nav className="admin-sidebar-nav">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href)

          return (
            <Link
              key={item.href}
              href={item.href as Route<string>}
              className={`admin-nav-item ${isActive ? 'active' : ''}`}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="admin-sidebar-footer">
        <Link href="/" target="_blank" className="admin-nav-item secondary">
          <ExternalLink size={16} />
          <span>Open Public Wiki</span>
        </Link>

        {userEmail && (
          <div className="admin-user-profile">
            <div className="admin-user-avatar">
              {userEmail.charAt(0).toUpperCase()}
            </div>
            <div className="admin-user-info">
              <span className="admin-user-email">{userEmail}</span>
            </div>
          </div>
        )}

        <button
          onClick={handleLogout}
          className="admin-nav-item logout-btn"
          type="button"
        >
          <LogOut size={16} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  )
}
