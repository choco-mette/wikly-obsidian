import React from 'react'

interface AdminHeaderProps {
  title: string
  description?: string
  children?: React.ReactNode
}

export function AdminHeader({
  title,
  description,
  children,
}: AdminHeaderProps) {
  return (
    <header className="admin-page-header">
      <div className="admin-page-header-text">
        <h1 className="admin-page-title">{title}</h1>
        {description && <p className="admin-page-description">{description}</p>}
      </div>
      {children && <div className="admin-page-header-actions">{children}</div>}
    </header>
  )
}
