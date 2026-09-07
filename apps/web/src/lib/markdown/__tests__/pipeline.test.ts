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

  it('transforms Obsidian asset embeds and maps URLs', async () => {
    const input = `
Here is an image:
![[diagram.png]]

Here is an image with dimensions:
![[photo.jpg|400x300]]

Here is a standard markdown image:
![A banner](banner.webp)
`
    const assetMap = {
      'diagram.png': '/api/v1/assets/raw/sites/123/assets/hash1/diagram.png',
      'banner.webp': '/api/v1/assets/raw/sites/123/assets/hash2/banner.webp',
    }

    const result = await renderMarkdown(input, { assetMap })

    expect(result.html).toContain(
      'src="/api/v1/assets/raw/sites/123/assets/hash1/diagram.png"',
    )
    expect(result.html).toContain('width="400"')
    expect(result.html).toContain('height="300"')
    expect(result.html).toContain(
      'src="/api/v1/assets/raw/sites/123/assets/hash2/banner.webp"',
    )
  })

  it('renders inline and block KaTeX math equations', async () => {
    const input = `
Inline math: $E = mc^2$ and not currency $100.
Block math:
$$
\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}
$$
`
    const result = await renderMarkdown(input)
    expect(result.html).toContain('katex')
    expect(result.html).toContain('katex-display')
    expect(result.html).toContain('E = mc^2')
  })

  it('renders mermaid diagram container', async () => {
    const input = `
\`\`\`mermaid
graph TD;
    A-->B;
    A-->C;
\`\`\`
`
    const result = await renderMarkdown(input)
    expect(result.html).toContain('class="mermaid-diagram"')
    expect(result.html).toContain('<pre class="mermaid">')
    expect(result.html).toContain('graph TD;')
  })

  it('transforms Excalidraw embeds into read-only whiteboard container', async () => {
    const input = 'Check out this design:\n![[system-architecture.excalidraw]]'
    const result = await renderMarkdown(input)
    expect(result.html).toContain('class="excalidraw-embed"')
    expect(result.html).toContain(
      'data-src="/api/v1/assets/raw/system-architecture.excalidraw"',
    )
    expect(result.html).toContain('Excalidraw (Read-Only)')
  })

  it('transcludes embedded notes and guards against infinite recursion', async () => {
    const mockNotes: Record<
      string,
      { title: string; markdown: string; slug: string }
    > = {
      'child-note': {
        title: 'Child Note',
        markdown: 'Content of child note with ![[loop-note]]',
        slug: 'child-note',
      },
      'loop-note': {
        title: 'Loop Note',
        markdown: 'Looping back: ![[child-note]]',
        slug: 'loop-note',
      },
    }

    const input = '# Parent\n![[child-note]]'
    const result = await renderMarkdown(input, {
      getNoteContent: (target) => mockNotes[slugify(target)] || null,
    })

    expect(result.html).toContain('class="note-embed"')
    expect(result.html).toContain('Child Note')
    expect(result.html).toContain('Content of child note')
    expect(result.html).toContain('Loop Note')
    expect(result.html).toContain('rekursi dibatasi')
  })

  it('surfaces broken wikilinks and broken embeds clearly', async () => {
    const knownSlugs = new Set(['existing-note'])
    const input = `
See [[existing-note]] and [[missing-note]].
Embed missing: ![[nonexistent-page]]
`
    const result = await renderMarkdown(input, {
      knownSlugs,
      getNoteContent: () => null,
    })

    expect(result.html).toContain('wiki-link-broken')
    expect(result.html).toContain('data-broken="true"')
    expect(result.html).toContain('class="broken-reference"')
    expect(result.html).toContain('Tautan terputus:')
  })
})
