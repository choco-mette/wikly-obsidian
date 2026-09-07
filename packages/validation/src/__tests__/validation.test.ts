import { describe, expect, it } from 'vitest'
import {
  createPendingChangeSchema,
  deviceAuthRequestSchema,
  publishRequestSchema,
  syncAckSchema,
  syncChangesQuerySchema,
} from '../index'

describe('Validation schemas', () => {
  it('validates deviceAuthRequestSchema', () => {
    const valid = {
      siteId: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
      pairingCode: 'WIK-8821',
    }
    expect(deviceAuthRequestSchema.safeParse(valid).success).toBe(true)

    const invalidSiteId = {
      siteId: 'not-a-uuid',
      pairingCode: 'WIK-8821',
    }
    expect(deviceAuthRequestSchema.safeParse(invalidSiteId).success).toBe(false)

    const invalidCode = {
      siteId: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
      pairingCode: '12', // Too short
    }
    expect(deviceAuthRequestSchema.safeParse(invalidCode).success).toBe(false)
  })

  it('validates publishRequestSchema', () => {
    const valid = {
      siteId: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
      sourceId: '01JABC123XYZ',
      path: 'Networking/MikroTik.md',
      title: 'MikroTik VLAN',
      slug: 'mikrotik-vlan',
      markdown: '# Content',
      frontmatter: { title: 'MikroTik VLAN', tags: ['net'] },
      contentHash: `sha256:${'a'.repeat(64)}`,
      serverRevision: 1,
    }
    expect(publishRequestSchema.safeParse(valid).success).toBe(true)

    // Invalid hash format
    const invalidHash = {
      ...valid,
      contentHash: 'not-a-sha256-hash',
    }
    expect(publishRequestSchema.safeParse(invalidHash).success).toBe(false)
  })

  it('validates syncChangesQuerySchema', () => {
    const valid = { cursor: '123', limit: '20' }
    const parsed = syncChangesQuerySchema.safeParse(valid)
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.limit).toBe(20)
    }

    const invalidLimit = { limit: '999' }
    expect(syncChangesQuerySchema.safeParse(invalidLimit).success).toBe(false)
  })

  it('validates syncAckSchema', () => {
    const successAck = {
      success: true,
      leaseId: 'lease_abc123',
      result: {
        sourceId: '01JABC123XYZ',
        contentHash: 'sha256:abc',
      },
    }
    expect(syncAckSchema.safeParse(successAck).success).toBe(true)

    const failureAck = {
      success: false,
      leaseId: 'lease_abc123',
      errorCode: 'FILE_NOT_FOUND',
      message: 'File not found in Vault',
    }
    expect(syncAckSchema.safeParse(failureAck).success).toBe(true)

    const missingLease = {
      success: true,
    }
    expect(syncAckSchema.safeParse(missingLease).success).toBe(false)
  })

  it('validates createPendingChangeSchema', () => {
    const valid = {
      sourceId: '01JABC123XYZ',
      operation: 'frontmatter.patch',
      baseRevision: 2,
      patch: {
        tags: { add: ['network'], remove: ['old'] },
        properties: { set: { 'wiki.published': false } },
      },
    }
    expect(createPendingChangeSchema.safeParse(valid).success).toBe(true)

    const invalidOp = {
      ...valid,
      operation: 'invalid.operation',
    }
    expect(createPendingChangeSchema.safeParse(invalidOp).success).toBe(false)
  })
})
