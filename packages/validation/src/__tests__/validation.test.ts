import { describe, expect, it } from 'vitest'
import { deviceAuthRequestSchema, publishRequestSchema } from '../index'

describe('Validation schemas', () => {
  it('validates deviceAuthRequestSchema', () => {
    const valid = {
      siteId: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
      name: 'MacBook Pro Obsidian',
    }
    expect(deviceAuthRequestSchema.safeParse(valid).success).toBe(true)

    const invalidSiteId = {
      siteId: 'not-a-uuid',
      name: 'MacBook',
    }
    expect(deviceAuthRequestSchema.safeParse(invalidSiteId).success).toBe(false)
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
})
