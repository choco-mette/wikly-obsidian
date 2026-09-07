/** API version shared by the Next.js server and Obsidian client. */
export const API_V1_PREFIX = '/api/v1'

export const AUTH_DEVICE_PATH = `${API_V1_PREFIX}/auth/device`
export const PUBLISH_PATH = `${API_V1_PREFIX}/publish`
export const ASSETS_CHECK_PATH = `${API_V1_PREFIX}/assets/check`
export const ASSETS_PRESIGN_PATH = `${API_V1_PREFIX}/assets/presign`
export const ASSETS_UPLOAD_PATH = `${API_V1_PREFIX}/assets/upload`
export const ASSETS_RAW_PREFIX = `${API_V1_PREFIX}/assets/raw`
export const SYNC_CHANGES_PATH = `${API_V1_PREFIX}/sync/changes`
export const SYNC_CLAIM_PATH = (id: string) =>
  `${API_V1_PREFIX}/sync/changes/${id}/claim`
export const SYNC_ACK_PATH = (id: string) =>
  `${API_V1_PREFIX}/sync/changes/${id}/ack`

export interface DeviceAuthRequest {
  siteId: string
  pairingCode: string
}

export interface DeviceAuthResponse {
  success: boolean
  deviceId?: string
  name?: string
  token?: string
  status?: string
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

export interface AssetCheckItem {
  path: string
  hash: string
}

export interface AssetCheckRequest {
  siteId: string
  assets: AssetCheckItem[]
}

export interface AssetCheckResultItem {
  path: string
  hash: string
  exists: boolean
  assetId?: string
  url?: string
}

export interface AssetCheckResponse {
  success: boolean
  results: AssetCheckResultItem[]
  error?: string
}

export interface AssetPresignRequest {
  siteId: string
  filename: string
  hash: string
  sizeBytes: number
  mimeType: string
}

export interface AssetPresignResponse {
  success: boolean
  uploadUrl?: string
  assetId?: string
  storageKey?: string
  method?: 'PUT' | 'POST'
  url?: string
  error?: string
}

export interface AssetUploadResponse {
  success: boolean
  assetId?: string
  storageKey?: string
  url?: string
  error?: string
}

export interface SyncChangeItem {
  id: string
  sourceId: string
  operation: string
  baseRevision?: number
  patch: Record<string, unknown>
  createdAt: string
}

export interface SyncChangesResponse {
  success: boolean
  changes: SyncChangeItem[]
  nextCursor?: string
  error?: string
}

export interface SyncClaimResponse {
  success: boolean
  leaseId?: string
  leaseExpiresAt?: string
  error?: string
}

export interface SyncAckRequest {
  success: boolean
  leaseId: string
  result?: {
    sourceId: string
    contentHash: string
  }
  errorCode?: string
  message?: string
}

export interface SyncAckResponse {
  success: boolean
  status: string
  error?: string
}

export const GRAPH_PATH = `${API_V1_PREFIX}/graph`

export interface GraphNodeDto {
  id: string
  slug: string
  title: string
  isCurrent?: boolean
  linkCount: number
}

export interface GraphLinkDto {
  source: string
  target: string
}

export interface GraphDataDto {
  nodes: GraphNodeDto[]
  links: GraphLinkDto[]
}

export interface GraphResponse {
  success: boolean
  data?: GraphDataDto
  error?: string
}
