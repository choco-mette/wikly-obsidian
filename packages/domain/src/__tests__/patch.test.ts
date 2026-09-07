import { describe, expect, it } from 'vitest'
import { applyFrontmatterPatch } from '../index'

describe('applyFrontmatterPatch', () => {
  it('adds tags to existing array tags without duplicates', () => {
    const fm = {
      title: 'Test Note',
      tags: ['network', 'cisco'],
    }

    const updated = applyFrontmatterPatch(fm, {
      tags: {
        add: ['router', '#network', 'bgp'],
      },
    })

    expect(updated.title).toBe('Test Note')
    expect(updated.tags).toEqual(['network', 'cisco', 'router', 'bgp'])
  })

  it('removes specified tags from array', () => {
    const fm = {
      title: 'Test Note',
      tags: ['network', 'cisco', 'deprecated'],
    }

    const updated = applyFrontmatterPatch(fm, {
      tags: {
        remove: ['deprecated', '#cisco'],
      },
    })

    expect(updated.tags).toEqual(['network'])
  })

  it('converts string tag or string tags into array and unifies tag/tags key', () => {
    const fm = {
      tag: 'network, hardware',
    }

    const updated = applyFrontmatterPatch(fm, {
      tags: {
        add: ['cisco'],
        remove: ['hardware'],
      },
    })

    expect(updated.tags).toEqual(['network', 'cisco'])
    expect(updated.tag).toBeUndefined()
  })

  it('sets top-level and nested properties (dot paths)', () => {
    const fm: Record<string, unknown> = {
      title: 'Old Title',
      wiki: {
        id: '01JABC123',
        published: true,
      },
    }

    const updated = applyFrontmatterPatch(fm, {
      properties: {
        set: {
          title: 'New Title',
          'wiki.published': false,
          'meta.author': 'Admin',
        },
      },
    })

    expect(updated.title).toBe('New Title')
    expect((updated.wiki as Record<string, unknown>).id).toBe('01JABC123')
    expect((updated.wiki as Record<string, unknown>).published).toBe(false)
    expect((updated.meta as Record<string, unknown>).author).toBe('Admin')
  })

  it('unsets top-level and nested properties', () => {
    const fm: Record<string, unknown> = {
      title: 'Title',
      tempKey: 'to-remove',
      wiki: {
        id: '01JABC123',
        obsolete: true,
      },
    }

    const updated = applyFrontmatterPatch(fm, {
      properties: {
        unset: ['tempKey', 'wiki.obsolete'],
      },
    })

    expect(updated.tempKey).toBeUndefined()
    expect((updated.wiki as Record<string, unknown>).id).toBe('01JABC123')
    expect((updated.wiki as Record<string, unknown>).obsolete).toBeUndefined()
  })

  it('preserves unknown fields and does not mutate original object', () => {
    const original = {
      title: 'Immutable',
      customNumber: 42,
      customList: [1, 2, 3],
      nestedObj: { a: 'b' },
    }

    const updated = applyFrontmatterPatch(original, {
      tags: { add: ['test'] },
    })

    expect(updated).not.toBe(original)
    expect(original.customNumber).toBe(42)
    expect(updated.customNumber).toBe(42)
    expect(updated.customList).toEqual([1, 2, 3])
    expect(updated.nestedObj).toEqual({ a: 'b' })
    expect(updated.tags).toEqual(['test'])
  })
})
