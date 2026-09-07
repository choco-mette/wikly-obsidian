import { describe, expect, it } from 'vitest'
import {
  computeContentHash,
  extractSourceId,
  generateSourceId,
  isPublishable,
  parseWikilinks,
  slugify,
} from '../index'

describe('Domain helpers', () => {
  it('generates valid 26-char Crockford Base32 sourceId', () => {
    const id1 = generateSourceId()
    const id2 = generateSourceId()
    expect(id1).toHaveLength(26)
    expect(id2).toHaveLength(26)
    expect(id1).not.toBe(id2)
    expect(id1).toMatch(/^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$/)
  })

  it('computes consistent contentHash and handles frontmatter key ordering', () => {
    const md = '# Title\n\nHello world'
    const fm1 = { b: 2, a: 1, tags: ['x', 'y'] }
    const fm2 = { a: 1, tags: ['x', 'y'], b: 2 }

    const hash1 = computeContentHash(md, fm1)
    const hash2 = computeContentHash(md, fm2)
    expect(hash1).toMatch(/^sha256:[a-f0-9]{64}$/)
    expect(hash1).toBe(hash2)

    // Changed content changes hash
    const hashDiff = computeContentHash('# Title\n\nHello world!', fm1)
    expect(hashDiff).not.toBe(hash1)
  })

  it('detects isPublishable correctly', () => {
    expect(isPublishable(null)).toBe(false)
    expect(isPublishable({})).toBe(false)
    expect(isPublishable({ wiki: { published: false } })).toBe(false)
    expect(isPublishable({ wiki: { published: true } })).toBe(true)
  })

  it('extracts sourceId correctly', () => {
    expect(extractSourceId(null)).toBeNull()
    expect(extractSourceId({})).toBeNull()
    expect(extractSourceId({ wiki: { id: '01JABC123XYZ' } })).toBe(
      '01JABC123XYZ',
    )
  })

  it('slugifies titles and paths properly', () => {
    expect(slugify('MikroTik VLAN.md')).toBe('mikrotik-vlan')
    expect(slugify('Networking/MikroTik VLAN')).toBe('networking/mikrotik-vlan')
    expect(slugify('  My Awesome Note!  ')).toBe('my-awesome-note')
  })

  it('parses wikilinks including aliases and headers', () => {
    const markdown = `
Check out [[Getting Started]] and [[Networking/VLAN|VLAN Setup]].
Also see [[FAQ#Questions]] and another [[Getting Started]].
`
    const links = parseWikilinks(markdown)
    expect(links).toEqual(['Getting Started', 'Networking/VLAN', 'FAQ'])
  })
})
