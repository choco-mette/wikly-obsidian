import { Notice, Plugin, PluginSettingTab, Setting } from 'obsidian'

interface WiklyPluginSettings {
  serverUrl: string
  siteId: string
  debounceMs: number
  syncIntervalMinutes: number
}

const DEFAULT_SETTINGS: WiklyPluginSettings = {
  serverUrl: '',
  siteId: '',
  debounceMs: 3_000,
  syncIntervalMinutes: 5,
}

export default class WiklyPublisherPlugin extends Plugin {
  settings: WiklyPluginSettings = DEFAULT_SETTINGS

  async onload(): Promise<void> {
    await this.loadSettings()
    this.addSettingTab(new WiklySettingTab(this.app, this))
    this.addCommand({
      id: 'sync-now',
      name: 'Sync now',
      callback: () =>
        new Notice(
          'Wikly sync will be available after the publishing API is implemented.',
        ),
    })
  }

  async loadSettings(): Promise<void> {
    this.settings = { ...DEFAULT_SETTINGS, ...(await this.loadData()) }
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings)
  }
}

class WiklySettingTab extends PluginSettingTab {
  constructor(
    app: WiklyPublisherPlugin['app'],
    private readonly plugin: WiklyPublisherPlugin,
  ) {
    super(app, plugin)
  }

  display(): void {
    const { containerEl } = this
    containerEl.empty()
    containerEl.createEl('h2', { text: 'Wikly Publisher' })

    new Setting(containerEl)
      .setName('Server URL')
      .setDesc('Base URL for the Wikly application.')
      .addText((text) =>
        text
          .setValue(this.plugin.settings.serverUrl)
          .onChange(async (value) => {
            this.plugin.settings.serverUrl = value.trim().replace(/\/$/, '')
            await this.plugin.saveSettings()
          }),
      )

    new Setting(containerEl)
      .setName('Site ID')
      .setDesc('The site this device is authorized to publish to.')
      .addText((text) =>
        text.setValue(this.plugin.settings.siteId).onChange(async (value) => {
          this.plugin.settings.siteId = value.trim()
          await this.plugin.saveSettings()
        }),
      )

    new Setting(containerEl)
      .setName('Publish debounce')
      .setDesc('Milliseconds to wait after an edit before queuing a publish.')
      .addText((text) =>
        text
          .setValue(String(this.plugin.settings.debounceMs))
          .onChange(async (value) => {
            const parsed = Number(value)
            if (Number.isFinite(parsed) && parsed >= 2_000 && parsed <= 5_000) {
              this.plugin.settings.debounceMs = parsed
              await this.plugin.saveSettings()
            }
          }),
      )
  }
}
