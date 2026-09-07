import { NextResponse } from 'next/server'
import { assetsRepo } from '@/lib/db'
import { getStorageDriver } from '@/lib/storage'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string[] }> },
) {
  try {
    const { key } = await params
    const storageKey = key.join('/')

    const asset = await assetsRepo.findAssetByStorageKey(storageKey)
    if (!asset) {
      return new NextResponse('Asset not found', { status: 404 })
    }

    // Check if asset is public (referenced by a published page)
    const isPublic = await assetsRepo.isAssetPublic(asset.id)
    if (!isPublic) {
      return new NextResponse('Asset is private or unpublished', {
        status: 403,
      })
    }

    const storageDriver = getStorageDriver()
    const object = await storageDriver.get(storageKey)
    if (!object) {
      return new NextResponse('Asset content not found in storage', {
        status: 404,
      })
    }

    const body = new Uint8Array(object.data)

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': asset.mimeType || 'application/octet-stream',
        'Content-Length': String(asset.sizeBytes),
        'Cache-Control': 'public, max-age=31536000, immutable',
        ETag: `"${asset.hash}"`,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new NextResponse(message, { status: 500 })
  }
}
