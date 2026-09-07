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

    if (!this.plugin.settings.deviceToken) {
      new Setting(containerEl)
        .setName('Pairing Code')
        .setDesc(
          'Enter the temporary one-time pairing code generated from Wikly Admin (e.g. WIK-8821).',
        )
        .addText((text) =>
          text
            .setPlaceholder('WIK-XXXXXX')
            .setValue(this.plugin.settings.pairingCode)
            .onChange(async (value) => {
              this.plugin.settings.pairingCode = value.trim()
              await this.plugin.saveSettings()
            }),
        )

      new Setting(containerEl)
        .setName('Device Pairing')
        .setDesc('Pair this Obsidian vault with your Wikly site.')
        .addButton((button) =>
          button
            .setButtonText('Pair Device')
            .setCta()
            .onClick(async () => {
              try {
                button.setDisabled(true)
                button.setButtonText('Pairing...')
                const res = await this.plugin.api.pairDevice(
                  this.plugin.settings.pairingCode,
                )
                if (res.token) {
                  this.plugin.settings.deviceToken = res.token
                  if (res.name) {
                    this.plugin.settings.deviceName = res.name
                  }
                  this.plugin.settings.pairingCode = ''
                  await this.plugin.saveSettings()
                  new Notice(
                    `Wikly: Device paired successfully as "${this.plugin.settings.deviceName || 'Obsidian Client'}"!`,
                  )
                  this.display()
                }
              } catch (err) {
                const msg = err instanceof Error ? err.message : 'Unknown error'
                new Notice(`Wikly pairing error: ${msg}`)
              } finally {
                button.setDisabled(false)
              }
            }),
        )
    } else {
      new Setting(containerEl)
        .setName('Device Status')
        .setDesc(
          `Paired as "${this.plugin.settings.deviceName || 'Obsidian Client'}". Token securely stored.`,
        )
        .addButton((button) =>
          button
            .setButtonText('Unpair Device')
            .setWarning()
            .onClick(async () => {
              this.plugin.settings.deviceToken = ''
              this.plugin.settings.pairingCode = ''
              await this.plugin.saveSettings()
              new Notice('Wikly: Device has been unpaired.')
              this.display()
            }),
        )
    }

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

    new Setting(containerEl)
      .setName('Manual Sync')
      .setDesc('Pull write-back changes from Admin and flush publish queue.')
      .addButton((button) =>
        button
          .setButtonText('Sync Now')
          .setCta()
          .onClick(async () => {
            button.setDisabled(true)
            button.setButtonText('Syncing...')
            try {
              const applied = await this.plugin.syncPendingChanges()
              await this.plugin.queue.flushAll()
              new Notice(
                `Wikly: Sync complete.${applied > 0 ? ` Applied ${applied} change(s).` : ' Up to date.'}`,
              )
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : 'Failed'
              new Notice(`Wikly sync error: ${msg}`)
            } finally {
              button.setDisabled(false)
              button.setButtonText('Sync Now')
            }
          }),
      )
  }
}
