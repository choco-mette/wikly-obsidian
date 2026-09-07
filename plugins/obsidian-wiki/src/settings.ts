import { Notice, PluginSettingTab, Setting, type App } from 'obsidian'
import type WiklyPublisherPlugin from './main'

export class WiklySettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private readonly plugin: WiklyPublisherPlugin,
  ) {
    super(app, plugin)
  }

  display(): void {
    const { containerEl } = this
    containerEl.empty()
    containerEl.createEl('h2', { text: 'Wikly Publisher Settings' })

    new Setting(containerEl)
      .setName('Server URL')
      .setDesc(
        'Base URL of the Wikly web application (e.g. http://localhost:3000).',
      )
      .addText((text) =>
        text
          .setPlaceholder('https://wiki.example.com')
          .setValue(this.plugin.settings.serverUrl)
          .onChange(async (value) => {
            this.plugin.settings.serverUrl = value.trim().replace(/\/$/, '')
            await this.plugin.saveSettings()
          }),
      )

    new Setting(containerEl)
      .setName('Site ID')
      .setDesc('The UUID of the Wikly site to publish notes to.')
      .addText((text) =>
        text
          .setPlaceholder('xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx')
          .setValue(this.plugin.settings.siteId)
          .onChange(async (value) => {
            this.plugin.settings.siteId = value.trim()
            await this.plugin.saveSettings()
          }),
      )

    new Setting(containerEl)
      .setName('Device Name')
      .setDesc('A friendly name to identify this Obsidian device/client.')
      .addText((text) =>
        text
          .setValue(this.plugin.settings.deviceName)
          .onChange(async (value) => {
            this.plugin.settings.deviceName = value.trim()
            await this.plugin.saveSettings()
          }),
      )

    new Setting(containerEl)
      .setName('Device Authentication')
      .setDesc(
        this.plugin.settings.deviceToken
          ? 'Device is paired. Token is securely stored.'
          : 'Device is not paired yet. Click Register Device to generate a scoped token.',
      )
      .addButton((button) =>
        button
          .setButtonText(
            this.plugin.settings.deviceToken
              ? 'Re-pair Device'
              : 'Register Device',
          )
          .setCta()
          .onClick(async () => {
            try {
              button.setDisabled(true)
              button.setButtonText('Registering...')
              const res = await this.plugin.api.registerDevice(
                this.plugin.settings.deviceName,
              )
              if (res.token) {
                this.plugin.settings.deviceToken = res.token
                await this.plugin.saveSettings()
                new Notice('Wikly: Device registered and paired successfully!')
                this.display()
              }
            } catch (err) {
              const msg = err instanceof Error ? err.message : 'Unknown error'
              new Notice(`Wikly error: ${msg}`)
            } finally {
              button.setDisabled(false)
            }
          }),
      )

    new Setting(containerEl)
      .setName('Publish debounce (ms)')
      .setDesc(
        'Milliseconds to wait after note editing before queuing publish.',
      )
      .addText((text) =>
        text
          .setValue(String(this.plugin.settings.debounceMs))
          .onChange(async (value) => {
            const parsed = Number(value)
            if (
              Number.isFinite(parsed) &&
              parsed >= 1_000 &&
              parsed <= 30_000
            ) {
              this.plugin.settings.debounceMs = parsed
              await this.plugin.saveSettings()
            }
          }),
      )

    new Setting(containerEl)
      .setName('Sync interval (minutes)')
      .setDesc('Minutes between periodic background sync checks.')
      .addText((text) =>
        text
          .setValue(String(this.plugin.settings.syncIntervalMinutes))
          .onChange(async (value) => {
            const parsed = Number(value)
            if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 60) {
              this.plugin.settings.syncIntervalMinutes = parsed
              await this.plugin.saveSettings()
            }
          }),
      )
  }
}
