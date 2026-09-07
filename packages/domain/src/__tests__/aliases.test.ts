import { describe, expect, it } from 'vitest'
import { extractAliases } from '../index'

describe('extractAliases', () => {
  it('returns empty array when frontmatter is null, undefined, or empty', () => {
    expect(extractAliases(null)).toEqual([])
    expect(extractAliases(undefined)).toEqual([])
    expect(extractAliases({})).toEqual([])
  })

  it('returns empty array when aliases property is missing or not string/array', () => {
    expect(extractAliases({ title: 'Note' })).toEqual([])
    expect(extractAliases({ aliases: 123 as unknown as string })).toEqual([])
    expect(extractAliases({ aliases: null as unknown as string })).toEqual([])
  })

  it('extracts aliases from string array', () => {
    const fm = {
      aliases: ['VLAN MikroTik', 'MikroTik VLAN Setup', '  '],
    }
    expect(extractAliases(fm)).toEqual(['VLAN MikroTik', 'MikroTik VLAN Setup'])
  })

  it('extracts alias from single string', () => {
    const fm = {
      aliases: 'Single Alias Name',
    }
    expect(extractAliases(fm)).toEqual(['Single Alias Name'])
  })

  it('handles empty string cleanly', () => {
    expect(extractAliases({ aliases: '   ' })).toEqual([])
  })
})
