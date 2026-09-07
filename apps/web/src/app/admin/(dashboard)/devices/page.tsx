import { AdminHeader } from '@/components/admin/AdminHeader'
import { devicesRepo, sitesRepo } from '@/lib/db'
import { DevicesClient } from './DevicesClient'

export const dynamic = 'force-dynamic'

interface AdminDevicesPageProps {
  searchParams: Promise<{ status?: string }>
}

export default async function AdminDevicesPage({
  searchParams,
}: AdminDevicesPageProps) {
  const { status } = await searchParams
  const site = await sitesRepo.getSiteBySlug('default')

  if (!site) {
    return <div className="admin-page-content">Site not found.</div>
  }

  const currentFilter = status || 'all'
  const devicesList = await devicesRepo.getDevicesBySite(site.id, currentFilter)

  return (
    <div className="admin-page-content">
      <AdminHeader
        title="Devices & Pairing"
        description="Manage Obsidian plugin devices authorized to publish notes to this server."
      />

      <DevicesClient
        initialDevices={devicesList}
        siteId={site.id}
        currentFilter={currentFilter}
      />
    </div>
  )
}
