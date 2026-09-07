import { Notice, Plugin, TFile, type TAbstractFile } from 'obsidian'
import {
  computeContentHash,
  extractSourceId,
  isPublishable,
  slugify,
} from '@wikly/domain'
import type { PublishRequest } from '@wikly/api-contracts'
import { WiklyApiClient } from './api'
import { ensureSourceId, splitFrontmatterAndBody } from './frontmatter'
import { PublishQueue } from './queue'
import { WiklySettingTab } from './settings'
import {
  DEFAULT_SETTINGS,
  DEFAULT_STORAGE_DATA,
  type PluginStorageData,
  type QueueItem,
  type QueueState,
  type WiklyPluginSettings,
} from './types'

export default class WiklyPublisherPlugin extends Plugin {
  settings: WiklyPluginSettings = DEFAULT_SETTINGS
  storageData: PluginStorageData = DEFAULT_STORAGE_DATA
  api!: WiklyApiClient
  queue!: PublishQueue
  private statusBarItem!: HTMLElement

  async onload(): Promise<void> {
    await this.loadPluginData()

    this.api = new WiklyApiClient(() => this.settings)
    this.queue = new PublishQueue({
      getDebounceMs: () => this.settings.debounceMs,
      onPublish: async (item) => this.publishItem(item),
      onStateChange: (state, count) => this.updateStatusBar(state, count),
    })

    this.statusBarItem = this.addStatusBarItem()
    this.updateStatusBar('idle', 0)

    this.addRibbonIcon(
      'upload-cloud',
      'Wikly: Publish active note',
      async () => {
        await this.publishActiveNote()
      },
    )

    this.addSettingTab(new WiklySettingTab(this.app, this))

    // Commands
    this.addCommand({
      id: 'wikly-publish-active',
      name: 'Publish active note',
      callback: async () => {
        await this.publishActiveNote()
      },
    })

    this.addCommand({
      id: 'wikly-unpublish-active',
      name: 'Unpublish active note',
      callback: async () => {
        await this.unpublishActiveNote()
      },
    })

    this.addCommand({
      id: 'wikly-ensure-id',
      name: 'Generate / ensure Wiki ID for active note',
      callback: async () => {
        await this.ensureActiveNoteSourceId()
      },
    })

    this.addCommand({
      id: 'wikly-sync-now',
      name: 'Sync now (flush publish queue)',
      callback: async () => {
        new Notice('Wikly: Processing publish queue...')
        await this.queue.flushAll()
      },
    })

    // Register Vault event listeners
    this.registerEvent(
      this.app.vault.on('modify', async (file) => {
        await this.handleVaultFileChange(file)
      }),
    )

    this.registerEvent(
      this.app.vault.on('create', async (file) => {
        await this.handleVaultFileChange(file)
      }),
    )

    this.registerEvent(
      this.app.vault.on('rename', async (file, oldPath) => {
        await this.handleVaultFileRename(file, oldPath)
      }),
    )

    this.registerEvent(
      this.app.vault.on('delete', (file) => {
        this.handleVaultFileDelete(file)
      }),
    )
  }

  onunload(): void {
    this.queue.clear()
  }

  async loadPluginData(): Promise<void> {
    const loaded = (await this.loadData()) as Partial<PluginStorageData> | null
    this.storageData = {
      ...DEFAULT_STORAGE_DATA,
      ...(loaded || {}),
      settings: {
        ...DEFAULT_STORAGE_DATA.settings,
        ...(loaded?.settings || {}),
      },
      files: {
        ...DEFAULT_STORAGE_DATA.files,
        ...(loaded?.files || {}),
      },
    }
    this.settings = this.storageData.settings
  }

  async savePluginData(): Promise<void> {
    await this.saveData(this.storageData)
  }

  async saveSettings(): Promise<void> {
    this.storageData.settings = this.settings
    await this.savePluginData()
  }

  private updateStatusBar(state: QueueState, pendingCount: number): void {
    switch (state) {
      case 'publishing':
        this.statusBarItem.setText(`Wikly: Publishing (${pendingCount})...`)
        break
      case 'debouncing':
        this.statusBarItem.setText(`Wikly: Queued (${pendingCount})`)
        break
      case 'error':
        this.statusBarItem.setText(`Wikly: Error`)
        break
      case 'idle':
      default:
        this.statusBarItem.setText('Wikly: Ready')
        break
    }
  }

  private async handleVaultFileChange(
    abstractFile: TAbstractFile,
  ): Promise<void> {
    if (!(abstractFile instanceof TFile) || abstractFile.extension !== 'md') {
      return
    }

    const cache = this.app.metadataCache.getFileCache(abstractFile)
    const frontmatter = cache?.frontmatter

    // Only process notes marked with wiki.published === true
    if (!isPublishable(frontmatter)) {
      return
    }

    let sourceId = extractSourceId(frontmatter)
    if (!sourceId) {
      await this.app.fileManager.processFrontMatter(abstractFile, (fm) => {
        sourceId = ensureSourceId(fm)
      })
    }

    if (!sourceId) return

    // Quick content hash check to suppress duplicate publish
    const fileContent = await this.app.vault.read(abstractFile)
    const { body } = splitFrontmatterAndBody(fileContent)
    const hash = computeContentHash(body, frontmatter)

    const known = this.storageData.files[sourceId]
    if (
      known &&
      known.lastPublishedHash === hash &&
      known.path === abstractFile.path
    ) {
      // Content has not changed, suppress queueing
      return
    }

    this.queue.enqueue(sourceId, abstractFile.path)
  }

  private async handleVaultFileRename(
    abstractFile: TAbstractFile,
    oldPath: string,
  ): Promise<void> {
    if (!(abstractFile instanceof TFile) || abstractFile.extension !== 'md') {
      return
    }

    // Find tracked file by old path
    for (const tracked of Object.values(this.storageData.files)) {
      if (tracked.path === oldPath) {
        // SourceId remains constant upon rename
        tracked.path = abstractFile.path
        await this.savePluginData()
        break
      }
    }

    await this.handleVaultFileChange(abstractFile)
  }

  private handleVaultFileDelete(abstractFile: TAbstractFile): void {
    if (!(abstractFile instanceof TFile)) return
    for (const [sourceId, tracked] of Object.entries(this.storageData.files)) {
      if (tracked.path === abstractFile.path) {
        this.queue.cancel(sourceId)
        break
      }
    }
  }

  async publishActiveNote(): Promise<void> {
    const activeFile = this.app.workspace.getActiveFile()
    if (!activeFile || activeFile.extension !== 'md') {
      new Notice('Wikly: Please open a Markdown note first.')
      return
    }

    let sourceId: string | null = null
    await this.app.fileManager.processFrontMatter(activeFile, (fm) => {
      if (!fm.wiki || typeof fm.wiki !== 'object') {
        fm.wiki = {}
      }
      fm.wiki.published = true
      sourceId = ensureSourceId(fm)
    })

    if (!sourceId) {
      new Notice('Wikly: Failed to assign source ID.')
      return
    }

    new Notice('Wikly: Publishing active note...')
    this.queue.enqueue(sourceId, activeFile.path, true)
    await this.queue.processNow(sourceId)
  }

  async unpublishActiveNote(): Promise<void> {
    const activeFile = this.app.workspace.getActiveFile()
    if (!activeFile || activeFile.extension !== 'md') {
      new Notice('Wikly: Please open a Markdown note first.')
      return
    }

    await this.app.fileManager.processFrontMatter(activeFile, (fm) => {
      if (fm.wiki && typeof fm.wiki === 'object') {
        fm.wiki.published = false
      }
    })

    const cache = this.app.metadataCache.getFileCache(activeFile)
    const sourceId = extractSourceId(cache?.frontmatter)
    if (sourceId) {
      this.queue.cancel(sourceId)
    }

    new Notice('Wikly: Note marked as unpublished.')
  }

  async ensureActiveNoteSourceId(): Promise<void> {
    const activeFile = this.app.workspace.getActiveFile()
    if (!activeFile || activeFile.extension !== 'md') {
      new Notice('Wikly: Please open a Markdown note first.')
      return
    }

    let assignedId = ''
    await this.app.fileManager.processFrontMatter(activeFile, (fm) => {
      assignedId = ensureSourceId(fm)
    })

    new Notice(`Wikly: Note Wiki ID is ${assignedId}`)
  }

  private async publishItem(item: QueueItem): Promise<boolean> {
    const file = this.app.vault.getAbstractFileByPath(item.path)
    if (!(file instanceof TFile)) {
      throw new Error(`File at ${item.path} not found in Vault.`)
    }

    const content = await this.app.vault.read(file)
    const cache = this.app.metadataCache.getFileCache(file)
    const frontmatter = cache?.frontmatter || {}
    const { body } = splitFrontmatterAndBody(content)

    const sourceId = extractSourceId(frontmatter) || item.sourceId
    const contentHash = computeContentHash(body, frontmatter)
    const known = this.storageData.files[sourceId]

    const title =
      (typeof frontmatter.title === 'string' && frontmatter.title.trim()) ||
      file.basename
    const slug = slugify(
      (typeof frontmatter.slug === 'string' && frontmatter.slug.trim()) ||
        title,
    )

    const req: PublishRequest = {
      siteId: this.settings.siteId,
      sourceId,
      path: file.path,
      title,
      slug,
      markdown: body,
      frontmatter,
      contentHash,
      serverRevision: known?.serverRevision,
    }

    const res = await this.api.publish(req)

    if (res.success) {
      const newRevision = res.page?.revision ?? known?.serverRevision ?? 1

      this.storageData.files[sourceId] = {
        sourceId,
        path: file.path,
        lastPublishedHash: contentHash,
        serverRevision: newRevision,
        lastPublishedAt: new Date().toISOString(),
      }

      await this.savePluginData()

      if (res.changed) {
        new Notice(`Wikly: Published "${title}" (rev ${newRevision})`)
      } else {
        new Notice(`Wikly: "${title}" is already up to date.`)
      }

      return true
    }

    return false
  }
}
