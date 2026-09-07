import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type { GetObjectResult, PutObjectResult, StorageDriver } from './types'

export interface S3StorageConfig {
  endpoint?: string
  region?: string
  bucket: string
  accessKeyId: string
  secretAccessKey: string
  publicUrl?: string
  forcePathStyle?: boolean
}

export class S3StorageDriver implements StorageDriver {
  private client: S3Client
  private bucket: string
  private publicUrl?: string
  private endpoint?: string

  constructor(config?: Partial<S3StorageConfig>) {
    this.bucket = config?.bucket || process.env.S3_BUCKET || 'wikly-assets'
    this.endpoint = config?.endpoint || process.env.S3_ENDPOINT
    this.publicUrl = config?.publicUrl || process.env.S3_PUBLIC_URL

    const region = config?.region || process.env.S3_REGION || 'us-east-1'
    const accessKeyId =
      config?.accessKeyId ||
      process.env.S3_ACCESS_KEY ||
      process.env.AWS_ACCESS_KEY_ID ||
      ''
    const secretAccessKey =
      config?.secretAccessKey ||
      process.env.S3_SECRET_KEY ||
      process.env.AWS_SECRET_ACCESS_KEY ||
      ''
    const forcePathStyle =
      config?.forcePathStyle ??
      (process.env.S3_FORCE_PATH_STYLE === 'true' || Boolean(this.endpoint))

    this.client = new S3Client({
      region,
      endpoint: this.endpoint,
      forcePathStyle,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    })
  }

  async put(
    key: string,
    data: Buffer | Uint8Array,
    mimeType: string,
  ): Promise<PutObjectResult> {
    const cleanKey = key.replace(/^\/+/, '')
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: cleanKey,
        Body: data,
        ContentType: mimeType,
      }),
    )

    return {
      storageKey: cleanKey,
      sizeBytes: data.length,
    }
  }

  async get(key: string): Promise<GetObjectResult | null> {
    const cleanKey = key.replace(/^\/+/, '')
    try {
      const response = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: cleanKey,
        }),
      )

      if (!response.Body) {
        return null
      }

      const bytes = await response.Body.transformToByteArray()
      return {
        data: Buffer.from(bytes),
        mimeType: response.ContentType,
        sizeBytes: response.ContentLength,
      }
    } catch {
      return null
    }
  }

  async delete(key: string): Promise<void> {
    const cleanKey = key.replace(/^\/+/, '')
    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: cleanKey,
        }),
      )
    } catch {
      // Ignore if error or not found
    }
  }

  async exists(key: string): Promise<boolean> {
    const cleanKey = key.replace(/^\/+/, '')
    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: cleanKey,
        }),
      )
      return true
    } catch {
      return false
    }
  }

  getPublicUrl(key: string): string {
    const cleanKey = key.replace(/^\/+/, '')
    if (this.publicUrl) {
      return `${this.publicUrl.replace(/\/+$/, '')}/${cleanKey}`
    }
    if (this.endpoint) {
      return `${this.endpoint.replace(/\/+$/, '')}/${this.bucket}/${cleanKey}`
    }
    return `https://${this.bucket}.s3.amazonaws.com/${cleanKey}`
  }

  async createPresignedUploadUrl(
    key: string,
    mimeType: string,
    expiresInSeconds = 900,
  ): Promise<string> {
    const cleanKey = key.replace(/^\/+/, '')
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: cleanKey,
      ContentType: mimeType,
    })

    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds })
  }
}
