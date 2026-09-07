import { requestUrl } from 'obsidian'
import {
  AUTH_DEVICE_PATH,
  PUBLISH_PATH,
  type DeviceAuthRequest,
  type DeviceAuthResponse,
  type PublishRequest,
  type PublishResponse,
} from '@wikly/api-contracts'
import type { WiklyPluginSettings } from './types'

export class WiklyApiClient {
  constructor(private getSettings: () => WiklyPluginSettings) {}

  async registerDevice(deviceName?: string): Promise<DeviceAuthResponse> {
    const settings = this.getSettings()
    if (!settings.serverUrl) {
      throw new Error('Server URL is not configured.')
    }
    if (!settings.siteId) {
      throw new Error('Site ID is not configured.')
    }

    const payload: DeviceAuthRequest = {
      siteId: settings.siteId,
      name: deviceName || settings.deviceName || 'Obsidian Device',
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

    if (response.status !== 201) {
      const errorMsg =
        response.json?.error ||
        `Registration failed with status ${response.status}`
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
}
