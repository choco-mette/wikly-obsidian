import type { QueueItem, QueueState } from './types'

export interface PublishQueueOptions {
  getDebounceMs: () => number
  onPublish: (item: QueueItem) => Promise<boolean>
  onStateChange?: (state: QueueState, pendingCount: number) => void
  maxRetries?: number
}

interface InternalQueueEntry {
  item: QueueItem
  timerId: ReturnType<typeof setTimeout> | null
}

export class PublishQueue {
  private queue = new Map<string, InternalQueueEntry>()
  private isProcessing = false
  private getDebounceMs: () => number
  private onPublish: (item: QueueItem) => Promise<boolean>
  private onStateChange?: (state: QueueState, pendingCount: number) => void
  private maxRetries: number

  constructor(options: PublishQueueOptions) {
    this.getDebounceMs = options.getDebounceMs
    this.onPublish = options.onPublish
    this.onStateChange = options.onStateChange
    this.maxRetries = options.maxRetries ?? 3
  }

  get pendingCount(): number {
    return this.queue.size
  }

  has(sourceId: string): boolean {
    return this.queue.has(sourceId)
  }

  enqueue(sourceId: string, path: string, bypassDebounce = false): void {
    const existing = this.queue.get(sourceId)
    if (existing?.timerId) {
      clearTimeout(existing.timerId)
    }

    const item: QueueItem = {
      sourceId,
      path,
      scheduledAt: Date.now(),
      attempts: existing?.item.attempts ?? 0,
    }

    const delay = bypassDebounce ? 0 : this.getDebounceMs()

    const timerId = setTimeout(() => {
      void this.executeItem(sourceId)
    }, delay)

    this.queue.set(sourceId, { item, timerId })
    this.notifyState('debouncing')
  }

  cancel(sourceId: string): void {
    const entry = this.queue.get(sourceId)
    if (entry) {
      if (entry.timerId) {
        clearTimeout(entry.timerId)
      }
      this.queue.delete(sourceId)
      this.notifyState(this.queue.size > 0 ? 'debouncing' : 'idle')
    }
  }

  async processNow(sourceId?: string): Promise<void> {
    if (sourceId) {
      const entry = this.queue.get(sourceId)
      if (entry) {
        if (entry.timerId) clearTimeout(entry.timerId)
        await this.executeItem(sourceId)
      }
    } else {
      await this.flushAll()
    }
  }

  async flushAll(): Promise<void> {
    const sourceIds = Array.from(this.queue.keys())
    for (const id of sourceIds) {
      const entry = this.queue.get(id)
      if (entry?.timerId) {
        clearTimeout(entry.timerId)
      }
      await this.executeItem(id)
    }
  }

  clear(): void {
    for (const entry of this.queue.values()) {
      if (entry.timerId) {
        clearTimeout(entry.timerId)
      }
    }
    this.queue.clear()
    this.notifyState('idle')
  }

  private async executeItem(sourceId: string): Promise<void> {
    const entry = this.queue.get(sourceId)
    if (!entry) return

    this.notifyState('publishing')
    this.isProcessing = true

    try {
      const success = await this.onPublish(entry.item)
      if (success) {
        this.queue.delete(sourceId)
        this.notifyState(this.queue.size > 0 ? 'debouncing' : 'idle')
      } else {
        this.handleFailure(sourceId, 'Publish rejected by server')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      this.handleFailure(sourceId, message)
    } finally {
      this.isProcessing = false
    }
  }

  private handleFailure(sourceId: string, error: string): void {
    const entry = this.queue.get(sourceId)
    if (!entry) return

    entry.item.attempts += 1
    entry.item.lastError = error

    if (entry.item.attempts >= this.maxRetries) {
      // Exceeded max retries, remove from active queue
      this.queue.delete(sourceId)
      this.notifyState('error')
    } else {
      // Exponential backoff: 1s, 2s, 4s...
      const backoffMs = Math.min(
        30_000,
        1_000 * Math.pow(2, entry.item.attempts),
      )
      entry.timerId = setTimeout(() => {
        void this.executeItem(sourceId)
      }, backoffMs)
      this.notifyState('debouncing')
    }
  }

  private notifyState(state: QueueState): void {
    this.onStateChange?.(state, this.queue.size)
  }
}
