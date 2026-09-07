import { NextResponse } from 'next/server'
import { assetCheckSchema } from '@wikly/validation'
import { assetsRepo, devicesRepo } from '@/lib/db'
import { getStorageDriver } from '@/lib/storage'

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing or malformed Authorization header',
        },
        { status: 401 },
      )
    }

    const token = authHeader.slice(7).trim()
    const json = await request.json()
    const parsed = assetCheckSchema.safeParse(json)

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues.map((i) => i.message).join(', '),
        },
        { status: 400 },
      )
    }

    const { siteId, assets } = parsed.data

    const device = await devicesRepo.validateDeviceToken(siteId, token)
    if (!device) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid or unauthorized device token for this site',
        },
        { status: 401 },
      )
    }

    const storageDriver = getStorageDriver()
    const hashes = assets.map((a) => a.hash)
    const existingAssets = await assetsRepo.findAssetsByHashes(siteId, hashes)
    const existingMap = new Map(existingAssets.map((a) => [a.hash, a]))

    const results = assets.map((item) => {
      const found = existingMap.get(item.hash)
      if (found) {
        return {
          path: item.path,
          hash: item.hash,
          exists: true,
          assetId: found.id,
          url: storageDriver.getPublicUrl(found.storageKey),
        }
      }
      return {
        path: item.path,
        hash: item.hash,
        exists: false,
      }
    })

    return NextResponse.json({
      success: true,
      results,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 },
    )
  }
}
