import { describe, expect, it } from 'vitest'
import { renderMarkdown, slugify } from '../pipeline'

describe('Markdown Pipeline', () => {
  it('slugifies titles into valid URLs', () => {
    expect(slugify('Hello World')).toBe('hello-world')
    expect(slugify('Obsidian & Wikly: 100% Awesome!')).toBe(
      'obsidian-wikly-100-awesome',
    )
  })

  it('transforms wikilinks with and without aliases', async () => {
    const input = 'Check [[Second Note]] or [[Second Note|Alternative Label]].'
    const result = await renderMarkdown(input)

    expect(result.html).toContain(
      '<a href="/second-note" class="wiki-link">Second Note</a>',
    )
    expect(result.html).toContain(
      '<a href="/second-note" class="wiki-link">Alternative Label</a>',
    )
  })

  it('renders Obsidian callouts with types and titles', async () => {
    const input = `> [!tip] Quick Tip
> This is a helpful tip.`

    const result = await renderMarkdown(input)
    expect(result.html).toContain('class="callout callout-tip"')
    expect(result.html).toContain('Quick Tip')
    expect(result.html).toContain('This is a helpful tip.')
  })

  it('extracts table of contents from headings', async () => {
    const input = `# Introduction
Some text
## Getting Started
More text
### Configuration
Even more text`

    const result = await renderMarkdown(input)
    expect(result.toc).toHaveLength(3)
    expect(result.toc[0]).toEqual({
      id: 'introduction',
      text: 'Introduction',
      level: 1,
    })
    expect(result.toc[1]).toEqual({
      id: 'getting-started',
      text: 'Getting Started',
      level: 2,
    })
    expect(result.toc[2]).toEqual({
      id: 'configuration',
      text: 'Configuration',
      level: 3,
    })
  })

  it('sanitizes dangerous script injections', async () => {
    const malicious = `Hello <script>alert("xss")</script> <img src="x" onerror="alert(1)" />`
    const result = await renderMarkdown(malicious)

    expect(result.html).not.toContain('<script>')
    expect(result.html).not.toContain('onerror')
  })
})
