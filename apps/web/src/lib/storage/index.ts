import { LocalStorageDriver } from './local'
import { S3StorageDriver } from './s3'
import type { StorageDriver } from './types'

export * from './types'
export * from './local'
export * from './s3'

let storageInstance: StorageDriver | null = null

export function getStorageDriver(): StorageDriver {
  if (storageInstance) {
    return storageInstance
  }

  const driverType = process.env.STORAGE_DRIVER || 'local'

  if (driverType === 's3') {
    storageInstance = new S3StorageDriver()
  } else {
    storageInstance = new LocalStorageDriver()
  }

  return storageInstance
}

export function resetStorageDriver(): void {
  storageInstance = null
}
