export interface WiklyPluginSettings {
  serverUrl: string
  siteId: string
  pairingCode: string
  deviceName: string
  deviceToken: string
  debounceMs: number
  syncIntervalMinutes: number
}

export const DEFAULT_SETTINGS: WiklyPluginSettings = {
  serverUrl: '',
  siteId: '',
  pairingCode: '',
  deviceName: '',
  deviceToken: '',
  debounceMs: 3_000,
  syncIntervalMinutes: 5,
}

export interface PublishedFileState {
  sourceId: string
  path: string
  lastPublishedHash: string
  serverRevision: number
  lastPublishedAt?: string
}

export interface PluginStorageData {
  settings: WiklyPluginSettings
  files: Record<string, PublishedFileState>
  syncCursor?: string
}

export const DEFAULT_STORAGE_DATA: PluginStorageData = {
  settings: DEFAULT_SETTINGS,
  files: {},
}

export interface QueueItem {
  sourceId: string
  path: string
  scheduledAt: number
  attempts: number
  lastError?: string
}

export type QueueState = 'idle' | 'debouncing' | 'publishing' | 'error'
