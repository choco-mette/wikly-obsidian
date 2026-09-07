/** API version shared by the Next.js server and Obsidian client. */
export const API_V1_PREFIX = '/api/v1'

export const AUTH_DEVICE_PATH = `${API_V1_PREFIX}/auth/device`
export const PUBLISH_PATH = `${API_V1_PREFIX}/publish`
export const ASSETS_CHECK_PATH = `${API_V1_PREFIX}/assets/check`
export const ASSETS_PRESIGN_PATH = `${API_V1_PREFIX}/assets/presign`

export interface DeviceAuthRequest {
  siteId: string
  name: string
}

export interface DeviceAuthResponse {
  success: boolean
  deviceId?: string
  token?: string
  error?: string
}

export interface PublishAssetReference {
  assetId?: string
  path: string
  hash: string
}

export interface PublishRequest {
  siteId: string
  sourceId: string
  path: string
  title: string
  slug: string
  markdown: string
  frontmatter: Record<string, unknown>
  contentHash: string
  serverRevision?: number
  assets?: PublishAssetReference[]
}

export interface PublishedPageSummary {
  id: string
  sourceId: string
  revision: number
  slug: string
}

export interface PublishResponse {
  success: boolean
  changed: boolean
  page?: PublishedPageSummary
  contentHash?: string
  error?: string
}
