import { describe, expect, it } from 'vitest'
import {
  computeBinaryHash,
  detectMimeType,
  extractAssetReferences,
} from '../index'

describe('Asset Domain Helpers', () => {
  it('detects MIME types properly', () => {
    expect(detectMimeType('image.png')).toBe('image/png')
    expect(detectMimeType('photo.jpg')).toBe('image/jpeg')
    expect(detectMimeType('photo.JPEG')).toBe('image/jpeg')
    expect(detectMimeType('doc.pdf')).toBe('application/pdf')
    expect(detectMimeType('movie.mp4')).toBe('video/mp4')
    expect(detectMimeType('unknown.xyz')).toBe('application/octet-stream')
  })

  it('computes binary hash deterministically', () => {
    const data = Buffer.from('hello world binary test')
    const hash1 = computeBinaryHash(data)
    const hash2 = computeBinaryHash(new Uint8Array(data))

    expect(hash1).toMatch(/^sha256:[a-f0-9]{64}$/)
    expect(hash1).toBe(hash2)
  })

  it('extracts Obsidian embeds and Markdown images', () => {
    const md = `
# Sample Note

Here is an embedded diagram:
![[assets/diagram.png]]
And with size:
![[attachments/photo.jpg|300x200]]

Here is note transclusion (should NOT be an asset):
![[Another Note.md]]

Standard markdown image:
![Alternative text](images/banner.webp)

Standard markdown image with title:
![Logo](images/logo.svg "Company Logo")

Remote image (should be ignored):
![Remote](https://example.com/pic.png)
`

    const refs = extractAssetReferences(md)

    expect(refs).toHaveLength(4)
    expect(refs[0]).toEqual({
      raw: '![[assets/diagram.png]]',
      path: 'assets/diagram.png',
      alt: undefined,
      isEmbed: true,
    })
    expect(refs[1]).toEqual({
      raw: '![[attachments/photo.jpg|300x200]]',
      path: 'attachments/photo.jpg',
      alt: '300x200',
      isEmbed: true,
    })
    expect(refs[2]).toEqual({
      raw: '![Alternative text](images/banner.webp)',
      path: 'images/banner.webp',
      alt: 'Alternative text',
      isEmbed: false,
    })
    expect(refs[3]).toEqual({
      raw: '![Logo](images/logo.svg "Company Logo")',
      path: 'images/logo.svg',
      alt: 'Logo',
      isEmbed: false,
    })
  })
})
