import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PublishQueue } from '../queue'

describe('PublishQueue', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('deduplicates queued items with same sourceId', async () => {
    const onPublish = vi.fn().mockResolvedValue(true)
    const queue = new PublishQueue({
      getDebounceMs: () => 3000,
      onPublish,
    })

    queue.enqueue('01JABC', 'Path/A.md')
    expect(queue.pendingCount).toBe(1)

    // Second enqueue with same sourceId should deduplicate
    queue.enqueue('01JABC', 'Path/A-renamed.md')
    expect(queue.pendingCount).toBe(1)

    // Advance timer past debounce asynchronously to resolve promises
    await vi.advanceTimersByTimeAsync(3000)

    expect(onPublish).toHaveBeenCalledTimes(1)
    expect(onPublish).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceId: '01JABC',
        path: 'Path/A-renamed.md',
      }),
    )
    expect(queue.pendingCount).toBe(0)
  })

  it('cancels scheduled item', async () => {
    const onPublish = vi.fn().mockResolvedValue(true)
    const queue = new PublishQueue({
      getDebounceMs: () => 3000,
      onPublish,
    })

    queue.enqueue('01JABC', 'Path/A.md')
    expect(queue.pendingCount).toBe(1)

    queue.cancel('01JABC')
    expect(queue.pendingCount).toBe(0)

    await vi.advanceTimersByTimeAsync(5000)
    expect(onPublish).not.toHaveBeenCalled()
  })

  it('retries with backoff on failure', async () => {
    let callCount = 0
    const onPublish = vi.fn().mockImplementation(async () => {
      callCount++
      if (callCount === 1) {
        throw new Error('Network timeout')
      }
      return true
    })

    const queue = new PublishQueue({
      getDebounceMs: () => 1000,
      onPublish,
      maxRetries: 3,
    })

    queue.enqueue('01RETRY', 'Path/Retry.md')
    expect(queue.pendingCount).toBe(1)

    // 1st attempt: after 1000ms debounce
    await vi.advanceTimersByTimeAsync(1000)
    expect(onPublish).toHaveBeenCalledTimes(1)

    // Failed, scheduled retry with backoff 2000ms
    expect(queue.pendingCount).toBe(1)
    await vi.advanceTimersByTimeAsync(2000)
    expect(onPublish).toHaveBeenCalledTimes(2)
    expect(queue.pendingCount).toBe(0)
  })
})
