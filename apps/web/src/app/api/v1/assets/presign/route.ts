import { NextResponse } from 'next/server'
import { assetPresignSchema } from '@wikly/validation'
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
    const parsed = assetPresignSchema.safeParse(json)

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues.map((i) => i.message).join(', '),
        },
        { status: 400 },
      )
    }

    const { siteId, filename, hash, sizeBytes, mimeType } = parsed.data

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

    // 1. Check if asset already exists in DB
    const existing = await assetsRepo.findAssetByHash(siteId, hash)
    if (existing) {
      return NextResponse.json({
        success: true,
        assetId: existing.id,
        storageKey: existing.storageKey,
        url: storageDriver.getPublicUrl(existing.storageKey),
      })
    }

    // 2. Generate storage key
    const rawHash = hash.replace(/^sha256:/, '')
    // Sanitize filename
    const cleanFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
    const storageKey = `sites/${siteId}/assets/${rawHash}/${cleanFilename}`

    // 3. Register asset metadata in DB
    const asset = await assetsRepo.createOrUpdateAsset({
      siteId,
      hash,
      filename: cleanFilename,
      mimeType,
      sizeBytes,
      storageKey,
    })

    // 4. Generate presigned URL or direct upload fallback
    if (storageDriver.createPresignedUploadUrl) {
      const uploadUrl = await storageDriver.createPresignedUploadUrl(
        storageKey,
        mimeType,
      )
      return NextResponse.json({
        success: true,
        uploadUrl,
        method: 'PUT',
        assetId: asset.id,
        storageKey,
        url: storageDriver.getPublicUrl(storageKey),
      })
    }

    // Direct upload URL for local storage driver
    const uploadUrl = `/api/v1/assets/upload?siteId=${encodeURIComponent(siteId)}&hash=${encodeURIComponent(hash)}&filename=${encodeURIComponent(cleanFilename)}&mimeType=${encodeURIComponent(mimeType)}`

    return NextResponse.json({
      success: true,
      uploadUrl,
      method: 'POST',
      assetId: asset.id,
      storageKey,
      url: storageDriver.getPublicUrl(storageKey),
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
