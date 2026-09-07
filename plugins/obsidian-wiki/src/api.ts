import { requestUrl } from 'obsidian'
import {
  AUTH_DEVICE_PATH,
  PUBLISH_PATH,
  SYNC_ACK_PATH,
  SYNC_CHANGES_PATH,
  SYNC_CLAIM_PATH,
  type DeviceAuthRequest,
  type DeviceAuthResponse,
  type PublishRequest,
  type PublishResponse,
  type SyncAckRequest,
  type SyncAckResponse,
  type SyncChangesResponse,
  type SyncClaimResponse,
} from '@wikly/api-contracts'
import type { WiklyPluginSettings } from './types'

export class WiklyApiClient {
  constructor(private getSettings: () => WiklyPluginSettings) {}

  async pairDevice(pairingCode: string): Promise<DeviceAuthResponse> {
    const settings = this.getSettings()
    if (!settings.serverUrl) {
      throw new Error('Server URL is not configured.')
    }
    if (!settings.siteId) {
      throw new Error('Site ID is not configured.')
    }
    if (!pairingCode) {
      throw new Error('Pairing code is required.')
    }

    const payload: DeviceAuthRequest = {
      siteId: settings.siteId,
      pairingCode: pairingCode.trim().toUpperCase(),
    }

    const response = await requestUrl({
      url: `${settings.serverUrl}${AUTH_DEVICE_PATH}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      throw: false,
    })

    if (response.status !== 200) {
      const errorMsg =
        response.json?.error || `Pairing failed with status ${response.status}`
      throw new Error(errorMsg)
    }

    return response.json as DeviceAuthResponse
  }

  async publish(payload: PublishRequest): Promise<PublishResponse> {
    const settings = this.getSettings()
    if (!settings.serverUrl) {
      throw new Error('Server URL is not configured.')
    }
    if (!settings.deviceToken) {
      throw new Error(
        'Device is not authenticated. Please pair/register this device in plugin settings.',
      )
    }

    const response = await requestUrl({
      url: `${settings.serverUrl}${PUBLISH_PATH}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.deviceToken}`,
      },
      body: JSON.stringify(payload),
      throw: false,
    })

    if (response.status === 409) {
      throw new Error(
        'Revision conflict: note has been modified on server. Please sync changes.',
      )
    }

    if (response.status !== 200) {
      const errorMsg =
        response.json?.error || `Publish failed with status ${response.status}`
      throw new Error(errorMsg)
    }

    return response.json as PublishResponse
  }

  async checkAssets(
    assets: { path: string; hash: string }[],
  ): Promise<{ path: string; hash: string; exists: boolean; url?: string }[]> {
    const settings = this.getSettings()
    if (!settings.serverUrl || !settings.deviceToken) return []
    if (assets.length === 0) return []

    const response = await requestUrl({
      url: `${settings.serverUrl}/api/v1/assets/check`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.deviceToken}`,
      },
      body: JSON.stringify({
        siteId: settings.siteId,
        assets,
      }),
      throw: false,
    })

    if (response.status !== 200) {
      throw new Error(
        response.json?.error ||
          `Asset check failed with status ${response.status}`,
      )
    }

    return (response.json?.results || []) as {
      path: string
      hash: string
      exists: boolean
      url?: string
    }[]
  }

  async presignAsset(asset: {
    filename: string
    hash: string
    sizeBytes: number
    mimeType: string
  }): Promise<{
    uploadUrl?: string
    method?: 'PUT' | 'POST'
    assetId?: string
    url?: string
  }> {
    const settings = this.getSettings()
    if (!settings.serverUrl || !settings.deviceToken) {
      throw new Error('Device not configured or authenticated')
    }

    const response = await requestUrl({
      url: `${settings.serverUrl}/api/v1/assets/presign`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.deviceToken}`,
      },
      body: JSON.stringify({
        siteId: settings.siteId,
        filename: asset.filename,
        hash: asset.hash,
        sizeBytes: asset.sizeBytes,
        mimeType: asset.mimeType,
      }),
      throw: false,
    })

    if (response.status !== 200) {
      throw new Error(
        response.json?.error ||
          `Asset presign failed with status ${response.status}`,
      )
    }

    return response.json as {
      uploadUrl?: string
      method?: 'PUT' | 'POST'
      assetId?: string
      url?: string
    }
  }

  async uploadAssetBinary(
    uploadUrl: string,
    method: 'PUT' | 'POST',
    data: ArrayBuffer,
    mimeType: string,
  ): Promise<void> {
    const settings = this.getSettings()
    const fullUrl = uploadUrl.startsWith('http')
      ? uploadUrl
      : `${settings.serverUrl.replace(/\/+$/, '')}/${uploadUrl.replace(/^\/+/, '')}`

    const headers: Record<string, string> = {
      'Content-Type': mimeType,
    }
    if (settings.deviceToken) {
      headers.Authorization = `Bearer ${settings.deviceToken}`
    }

    const response = await requestUrl({
      url: fullUrl,
      method,
      headers,
      body: data,
      throw: false,
    })

    if (response.status < 200 || response.status >= 300) {
      throw new Error(
        response.json?.error ||
          `Asset upload failed with status ${response.status}`,
      )
    }
  }

  async fetchSyncChanges(cursor?: string): Promise<SyncChangesResponse> {
    const settings = this.getSettings()
    if (!settings.serverUrl || !settings.deviceToken) {
      return { success: false, changes: [] }
    }

    const base = settings.serverUrl.replace(/\/+$/, '')
    const url = new URL(`${base}${SYNC_CHANGES_PATH}`)
    if (cursor) {
      url.searchParams.set('cursor', cursor)
    }

    const response = await requestUrl({
      url: url.toString(),
      method: 'GET',
      headers: {
        Authorization: `Bearer ${settings.deviceToken}`,
      },
      throw: false,
    })

    if (response.status !== 200) {
      throw new Error(
        response.json?.error ||
          `Failed to fetch sync changes (${response.status})`,
      )
    }

    return response.json as SyncChangesResponse
  }

  async claimSyncChange(changeId: string): Promise<SyncClaimResponse> {
    const settings = this.getSettings()
    if (!settings.serverUrl || !settings.deviceToken) {
      throw new Error('Device not configured or authenticated')
    }

    const base = settings.serverUrl.replace(/\/+$/, '')
    const response = await requestUrl({
      url: `${base}${SYNC_CLAIM_PATH(changeId)}`,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${settings.deviceToken}`,
      },
      throw: false,
    })

    if (response.status !== 200) {
      return {
        success: false,
        error:
          response.json?.error ||
          `Failed to claim sync change (${response.status})`,
      }
    }

    return response.json as SyncClaimResponse
  }

  async ackSyncChange(
    changeId: string,
    ack: SyncAckRequest,
  ): Promise<SyncAckResponse> {
    const settings = this.getSettings()
    if (!settings.serverUrl || !settings.deviceToken) {
      throw new Error('Device not configured or authenticated')
    }

    const base = settings.serverUrl.replace(/\/+$/, '')
    const response = await requestUrl({
      url: `${base}${SYNC_ACK_PATH(changeId)}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.deviceToken}`,
      },
      body: JSON.stringify(ack),
      throw: false,
    })

    if (response.status !== 200) {
      throw new Error(
        response.json?.error ||
          `Failed to ACK sync change (${response.status})`,
      )
    }

    return response.json as SyncAckResponse
  }
}
