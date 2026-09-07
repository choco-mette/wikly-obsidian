import React from 'react'
import { AdminNav } from '@/components/admin/AdminNav'
import { requireAdminSession } from '@/lib/auth/session'

export const dynamic = 'force-dynamic'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await requireAdminSession()

  return (
    <div className="admin-wrapper">
      <AdminNav userEmail={session.email} />
      <main className="admin-content-area">{children}</main>
    </div>
  )
}
