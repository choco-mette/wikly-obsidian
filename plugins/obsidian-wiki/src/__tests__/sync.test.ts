import { describe, expect, it, vi } from 'vitest'
import { applyFrontmatterPatch } from '@wikly/domain'

describe('Plugin Write-Back Sync Logic', () => {
  it('applies tag and property patches to frontmatter accurately', () => {
    const frontmatter = {
      title: 'DevOps Architecture',
      tags: ['linux', 'docker'],
      wiki: {
        id: '01JABC123XYZ',
        published: true,
      },
    }

    const patch = {
      tags: {
        add: ['kubernetes'],
        remove: ['linux'],
      },
      properties: {
        set: {
          'wiki.published': true,
          status: 'production',
        },
      },
    }

    const patched = applyFrontmatterPatch(frontmatter, patch)

    expect(patched.tags).toEqual(['docker', 'kubernetes'])
    expect(patched.status).toBe('production')
    const wikiObj = patched.wiki as Record<string, unknown>
    expect(wikiObj.published).toBe(true)
    expect(wikiObj.id).toBe('01JABC123XYZ')
  })

  it('handles claim and ack workflow with mocked api client', async () => {
    const mockApiClient = {
      fetchSyncChanges: vi.fn().mockResolvedValue({
        success: true,
        changes: [
          {
            id: 'change_1',
            sourceId: '01JABC123XYZ',
            operation: 'frontmatter.patch',
            patch: { tags: { add: ['network'] } },
            createdAt: new Date().toISOString(),
          },
        ],
      }),
      claimSyncChange: vi.fn().mockResolvedValue({
        success: true,
        leaseId: 'lease_abc123',
      }),
      ackSyncChange: vi.fn().mockResolvedValue({
        success: true,
        status: 'applied',
      }),
    }

    const changesRes = await mockApiClient.fetchSyncChanges()
    expect(changesRes.changes.length).toBe(1)

    const claimRes = await mockApiClient.claimSyncChange(
      changesRes.changes[0].id,
    )
    expect(claimRes.leaseId).toBe('lease_abc123')

    const ackRes = await mockApiClient.ackSyncChange(changesRes.changes[0].id, {
      success: true,
      leaseId: claimRes.leaseId,
      result: {
        sourceId: changesRes.changes[0].sourceId,
        contentHash: 'sha256:abc',
      },
    })
    expect(ackRes.status).toBe('applied')
  })
})
