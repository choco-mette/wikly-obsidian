import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth/session'
import { devicesRepo, sitesRepo } from '@/lib/db'

export async function POST(request: Request) {
  try {
    const session = await getSessionUser(request)

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 },
      )
    }

    const body = await request.json()
    const { action } = body

    if (action === 'create') {
      const { siteId, name } = body
      if (!name || typeof name !== 'string' || !name.trim()) {
        return NextResponse.json(
          { success: false, error: 'Nama perangkat wajib diisi' },
          { status: 400 },
        )
      }

      let resolvedSiteId = siteId
      if (!resolvedSiteId) {
        const defaultSite = await sitesRepo.getSiteBySlug('default')
        if (!defaultSite) {
          return NextResponse.json(
            { success: false, error: 'Site default tidak ditemukan' },
            { status: 404 },
          )
        }
        resolvedSiteId = defaultSite.id
      }

      const result = await devicesRepo.createPendingDevice(
        resolvedSiteId,
        name.trim(),
      )

      return NextResponse.json({
        success: true,
        device: result,
      })
    }

    if (action === 'regenerate') {
      const { deviceId } = body
      if (!deviceId) {
        return NextResponse.json(
          { success: false, error: 'deviceId wajib diisi' },
          { status: 400 },
        )
      }

      const result = await devicesRepo.regeneratePairingCode(deviceId)
      return NextResponse.json({
        success: true,
        pairingCode: result.pairingCode,
        expiresAt: result.expiresAt,
      })
    }

    if (action === 'revoke') {
      const { deviceId } = body
      if (!deviceId) {
        return NextResponse.json(
          { success: false, error: 'deviceId wajib diisi' },
          { status: 400 },
        )
      }

      await devicesRepo.revokeDevice(deviceId)
      return NextResponse.json({
        success: true,
      })
    }

    return NextResponse.json(
      { success: false, error: 'Aksi tidak dikenali' },
      { status: 400 },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    )
  }
}
