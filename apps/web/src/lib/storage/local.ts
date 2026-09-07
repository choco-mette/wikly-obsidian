import { access, mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import type { GetObjectResult, PutObjectResult, StorageDriver } from './types'

export class LocalStorageDriver implements StorageDriver {
  private basePath: string

  constructor(basePath?: string) {
    this.basePath =
      basePath || process.env.STORAGE_LOCAL_PATH || './data/wiki-assets'
  }

  private resolvePath(key: string): string {
    // Prevent path traversal
    const safeKey = key.replace(/\.\./g, '').replace(/^\/+/, '')
    return resolve(/*turbopackIgnore: true*/ process.cwd(), this.basePath, safeKey)
  }

  async put(
    key: string,
    data: Buffer | Uint8Array,
    _mimeType: string,
  ): Promise<PutObjectResult> {
    const fullPath = this.resolvePath(key)
    await mkdir(dirname(fullPath), { recursive: true })
    await writeFile(fullPath, data)
    return {
      storageKey: key,
      sizeBytes: data.length,
    }
  }

  async get(key: string): Promise<GetObjectResult | null> {
    const fullPath = this.resolvePath(key)
    try {
      const data = await readFile(fullPath)
      return {
        data,
        sizeBytes: data.length,
      }
    } catch {
      return null
    }
  }

  async delete(key: string): Promise<void> {
    const fullPath = this.resolvePath(key)
    try {
      await unlink(fullPath)
    } catch {
      // Ignore if not exists
    }
  }

  async exists(key: string): Promise<boolean> {
    const fullPath = this.resolvePath(key)
    try {
      await access(fullPath)
      return true
    } catch {
      return false
    }
  }

  getPublicUrl(key: string): string {
    const cleanKey = key.replace(/^\/+/, '')
    return `/api/v1/assets/raw/${cleanKey}`
  }
}
