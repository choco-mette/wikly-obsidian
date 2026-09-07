import { NextResponse } from 'next/server'
import { computeBinaryHash } from '@wikly/domain'
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
    const url = new URL(request.url)

    // Check query params or form data
    const querySiteId = url.searchParams.get('siteId')
    const queryHash = url.searchParams.get('hash')
    const queryFilename = url.searchParams.get('filename')
    const queryMimeType = url.searchParams.get('mimeType')

    let siteId = querySiteId || ''
    let hash = queryHash || ''
    let filename = queryFilename || ''
    let mimeType = queryMimeType || 'application/octet-stream'
    let fileBuffer: Buffer

    const contentType = request.headers.get('content-type') || ''

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const file = formData.get('file') as File | null
      if (!file) {
        return NextResponse.json(
          { success: false, error: 'Missing file in form data' },
          { status: 400 },
        )
      }
      siteId = (formData.get('siteId') as string) || siteId
      filename = file.name || filename || 'unnamed-asset'
      mimeType = file.type || mimeType
      const arrayBuffer = await file.arrayBuffer()
      fileBuffer = Buffer.from(arrayBuffer)
    } else {
      // Raw binary body
      const arrayBuffer = await request.arrayBuffer()
      fileBuffer = Buffer.from(arrayBuffer)
      if (contentType && !contentType.includes('application/octet-stream')) {
        mimeType = contentType
      }
    }

    if (!siteId) {
      return NextResponse.json(
        { success: false, error: 'siteId is required' },
        { status: 400 },
      )
    }

    // Authenticate device
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

    // Compute binary hash to verify integrity
    const computedHash = computeBinaryHash(fileBuffer)
    if (hash && hash !== computedHash) {
      return NextResponse.json(
        {
          success: false,
          error: `Hash mismatch: expected ${hash} but got ${computedHash}`,
        },
        { status: 400 },
      )
    }
    hash = computedHash

    const cleanFilename =
      filename.replace(/[^a-zA-Z0-9._-]/g, '_') || 'asset.bin'
    const rawHash = hash.replace(/^sha256:/, '')
    const storageKey = `sites/${siteId}/assets/${rawHash}/${cleanFilename}`

    const storageDriver = getStorageDriver()
    await storageDriver.put(storageKey, fileBuffer, mimeType)

    const asset = await assetsRepo.createOrUpdateAsset({
      siteId,
      hash,
      filename: cleanFilename,
      mimeType,
      sizeBytes: fileBuffer.length,
      storageKey,
    })

    return NextResponse.json({
      success: true,
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
