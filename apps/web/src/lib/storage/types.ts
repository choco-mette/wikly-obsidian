export interface PutObjectResult {
  storageKey: string
  sizeBytes: number
}

export interface GetObjectResult {
  data: Buffer
  mimeType?: string
  sizeBytes?: number
}

export interface StorageDriver {
  put(
    key: string,
    data: Buffer | Uint8Array,
    mimeType: string,
  ): Promise<PutObjectResult>
  get(key: string): Promise<GetObjectResult | null>
  delete(key: string): Promise<void>
  exists(key: string): Promise<boolean>
  getPublicUrl(key: string): string
  createPresignedUploadUrl?(
    key: string,
    mimeType: string,
    expiresInSeconds?: number,
  ): Promise<string>
}
