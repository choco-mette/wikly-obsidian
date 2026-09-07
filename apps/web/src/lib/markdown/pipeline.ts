import katex from 'katex'
import { Marked } from 'marked'
import sanitizeHtml from 'sanitize-html'

export interface TocItem {
  id: string
  text: string
  level: number
}

export interface RenderResult {
  html: string
  toc: TocItem[]
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Protects code blocks and inline code from preprocessing (math, etc.).
 */
function protectCode(markdown: string): {
  text: string
  restore: (str: string) => string
} {
  const blocks: string[] = []
  const codeRegex = /(```[\s\S]*?```|`[^`\n]+`)/g
  const text = markdown.replace(codeRegex, (match) => {
    const idx = blocks.length
    blocks.push(match)
    return `<!--CODE_BLOCK_HOLDER_${idx}-->`
  })
  const restore = (str: string) => {
    return str.replace(/<!--CODE_BLOCK_HOLDER_(\d+)-->/g, (_, idxStr) => {
      const idx = parseInt(idxStr, 10)
      return blocks[idx] ?? ''
    })
  }
  return { text, restore }
}

/**
 * Preprocesses LaTeX math equations into KaTeX HTML:
 * - Block math: $$ ... $$
 * - Inline math: $ ... $
 */
export function processMath(markdown: string): string {
  const { text, restore } = protectCode(markdown)

  // 1. Block math: $$ math $$
  let processed = text.replace(/\$\$([\s\S]+?)\$\$/g, (_, eq) => {
    try {
      return katex.renderToString(eq.trim(), {
        displayMode: true,
        throwOnError: false,
      })
    } catch {
      return `<pre class="katex-error">${eq}</pre>`
    }
  })

  // 2. Inline math: $ math $ (not preceded/followed by $, not empty, no newlines)
  processed = processed.replace(
    /(?<!\\|\$)\$(?!\$)((?:[^\n$]|\\\$)+?)(?<!\\|\$)\$(?!\$)/g,
    (_, eq) => {
      try {
        return katex.renderToString(eq.trim(), {
          displayMode: false,
          throwOnError: false,
        })
      } catch {
        return `<code class="katex-error">${eq}</code>`
      }
    },
  )

  return restore(processed)
}

/**
 * Preprocesses Obsidian wikilinks: [[Target Page]] or [[Target Page|Display Text]]
 * Highlights broken links when knownSlugs is provided.
 */
export function processWikilinks(
  markdown: string,
  knownSlugs?: Set<string>,
): string {
  return markdown.replace(
    /\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?\]\]/g,
    (_, target, alias) => {
      const rawTarget = target.trim()
      const label = alias ? alias.trim() : rawTarget
      const slug = slugify(rawTarget)
      const isBroken = knownSlugs ? !knownSlugs.has(slug) : false
      const brokenClass = isBroken ? ' wiki-link-broken' : ''
      const brokenAttr = isBroken
        ? ' data-broken="true" title="Catatan belum tersedia"'
        : ''
      return `<a href="/${slug}" class="wiki-link${brokenClass}"${brokenAttr}>${label}</a>`
    },
  )
}

/**
 * Preprocesses Obsidian callouts:
 * > [!NOTE] Optional title
 * > Callout body
 */
export function processCallouts(markdown: string): string {
  const lines = markdown.split('\n')
  const resultLines: string[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const calloutHeaderMatch = line.match(
      /^>\s*\[!([a-zA-Z0-9_-]+)\](?:\s+(.*))?$/,
    )

    if (calloutHeaderMatch) {
      const calloutType = calloutHeaderMatch[1].toLowerCase()
      const rawTitle = calloutHeaderMatch[2]?.trim()
      const title =
        rawTitle || calloutType.charAt(0).toUpperCase() + calloutType.slice(1)

      const bodyLines: string[] = []
      i++

      while (i < lines.length) {
        const nextLine = lines[i]
        if (nextLine.startsWith('>')) {
          bodyLines.push(nextLine.replace(/^>\s?/, ''))
          i++
        } else if (nextLine.trim() === '') {
          // Allow empty lines within callout if followed by >
          if (i + 1 < lines.length && lines[i + 1].startsWith('>')) {
            bodyLines.push('')
            i++
          } else {
            break
          }
        } else {
          break
        }
      }

      const bodyContent = bodyLines.join('\n')
      resultLines.push(
        `<div class="callout callout-${calloutType}" data-callout="${calloutType}">` +
          `<div class="callout-header">` +
          `<span class="callout-icon" aria-hidden="true"></span>` +
          `<span class="callout-title">${title}</span>` +
          `</div>` +
          `<div class="callout-body">\n\n${bodyContent}\n\n</div>` +
          `</div>`,
      )
    } else {
      resultLines.push(line)
      i++
    }
  }

  return resultLines.join('\n')
}

const MEDIA_EXTENSIONS = new Set([
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'svg',
  'avif',
  'ico',
  'bmp',
  'pdf',
  'mp4',
  'webm',
  'mp3',
  'wav',
  'ogg',
  'm4a',
  'excalidraw',
])

function isMediaTarget(target: string): boolean {
  const ext = target.split('.').pop()?.toLowerCase() || ''
  return MEDIA_EXTENSIONS.has(ext)
}

/**
 * Preprocesses Obsidian asset & Excalidraw embeds:
 * ![[image.png]] or ![[diagram.excalidraw]]
 */
export function processAssetEmbeds(
  markdown: string,
  options?: {
    assetMap?: Record<string, string>
    knownAssets?: Set<string>
    checkMissingAssets?: boolean
  },
): string {
  return markdown.replace(
    /!\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?\]\]/g,
    (match, target, alias) => {
      const rawTarget = target.trim()
      if (!isMediaTarget(rawTarget)) {
        return match // note transclusion, handled by processNoteEmbeds
      }

      const cleanTarget = rawTarget.replace(/^\/+/, '')
      const fileName = cleanTarget.split('/').pop() || cleanTarget
      const isExcalidraw = cleanTarget.toLowerCase().endsWith('.excalidraw')

      // Check missing assets if requested
      if (
        options?.checkMissingAssets &&
        options.knownAssets &&
        !options.knownAssets.has(cleanTarget) &&
        !options.knownAssets.has(fileName) &&
        !options.assetMap?.[cleanTarget] &&
        !options.assetMap?.[fileName]
      ) {
        return `<div class="broken-asset" data-asset="${fileName}"><span class="broken-icon">⚠️</span> <span class="broken-text">Berkas media tidak ditemukan: <code>${fileName}</code></span></div>`
      }

      const resolvedUrl =
        options?.assetMap?.[cleanTarget] ||
        options?.assetMap?.[fileName] ||
        options?.assetMap?.[rawTarget] ||
        `/api/v1/assets/raw/${encodeURI(cleanTarget)}`

      if (isExcalidraw) {
        return (
          `<div class="excalidraw-embed" data-src="${resolvedUrl}" data-title="${fileName}">` +
          `<div class="excalidraw-placeholder">` +
          `<span class="excalidraw-icon" aria-hidden="true">🎨</span> ` +
          `<span class="excalidraw-title">${fileName}</span> ` +
          `<span class="excalidraw-badge">Excalidraw (Read-Only)</span>` +
          `</div>` +
          `</div>`
        )
      }

      const extra = alias ? alias.trim() : ''
      let sizeAttrs = ''
      let altText = fileName

      if (/^\d+$/.test(extra)) {
        sizeAttrs = ` width="${extra}"`
      } else if (/^(\d+)x(\d+)$/.test(extra)) {
        const m = extra.match(/^(\d+)x(\d+)$/)
        if (m) {
          sizeAttrs = ` width="${m[1]}" height="${m[2]}"`
        }
      } else if (extra) {
        altText = extra
      }

      return `<img src="${resolvedUrl}" alt="${altText}"${sizeAttrs} class="wiki-asset-img" loading="lazy" />`
    },
  )
}

/**
 * Resolves note transclusions ![[Note Name]] or ![[Note Name#Header]].
 * Enforces recursion guard (max depth 2).
 */
export async function processNoteEmbeds(
  markdown: string,
  options?: RenderMarkdownOptions,
): Promise<string> {
  const currentDepth = options?.currentDepth ?? 0
  const visitedSlugs = new Set(options?.visitedSlugs ?? [])

  const embedRegex = /!\[\[([^\]|#]+)(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]/g
  const matches: Array<{
    fullMatch: string
    target: string
    heading?: string
  }> = []

  let m: RegExpExecArray | null
  while ((m = embedRegex.exec(markdown)) !== null) {
    const rawTarget = m[1]?.trim() || ''
    if (!isMediaTarget(rawTarget)) {
      matches.push({
        fullMatch: m[0],
        target: rawTarget,
        heading: m[2]?.trim(),
      })
    }
  }

  if (matches.length === 0) return markdown

  let result = markdown

  for (const item of matches) {
    const targetSlug = slugify(item.target)

    if (currentDepth >= 2 || visitedSlugs.has(targetSlug)) {
      result = result.replace(
        item.fullMatch,
        `<div class="note-embed-recursion"><a href="/${targetSlug}">📄 ${item.target}</a> <span class="recursion-warning">(rekursi dibatasi)</span></div>`,
      )
      continue
    }

    if (options?.getNoteContent) {
      const note = await options.getNoteContent(item.target)
      if (note) {
        const nextVisited = new Set(visitedSlugs)
        nextVisited.add(targetSlug)
        nextVisited.add(note.slug)

        const childResult = await renderMarkdown(note.markdown, {
          ...options,
          currentDepth: currentDepth + 1,
          visitedSlugs: nextVisited,
        })

        const embedHtml =
          `<div class="note-embed" data-note-slug="${note.slug}">` +
          `<div class="note-embed-header"><a href="/${note.slug}" class="note-embed-title">📄 ${note.title}</a></div>` +
          `<div class="note-embed-body">${childResult.html}</div>` +
          `</div>`

        result = result.replace(item.fullMatch, embedHtml)
      } else {
        result = result.replace(
          item.fullMatch,
          `<div class="broken-reference" data-target="${item.target}"><span class="broken-icon">⚠️</span> <span class="broken-text">Tautan terputus: <strong>${item.target}</strong></span></div>`,
        )
      }
    } else if (options?.knownSlugs && !options.knownSlugs.has(targetSlug)) {
      result = result.replace(
        item.fullMatch,
        `<div class="broken-reference" data-target="${item.target}"><span class="broken-icon">⚠️</span> <span class="broken-text">Tautan terputus: <strong>${item.target}</strong></span></div>`,
      )
    } else {
      result = result.replace(
        item.fullMatch,
        `<div class="note-embed" data-note-slug="${targetSlug}"><div class="note-embed-header"><a href="/${targetSlug}" class="note-embed-title">📄 ${item.target}</a></div></div>`,
      )
    }
  }

  return result
}

export interface RenderMarkdownOptions {
  assetMap?: Record<string, string>
  knownSlugs?: Set<string>
  knownAssets?: Set<string>
  checkMissingAssets?: boolean
  getNoteContent?: (
    target: string,
  ) =>
    | Promise<{ title: string; markdown: string; slug: string } | null>
    | { title: string; markdown: string; slug: string }
    | null
  currentDepth?: number
  visitedSlugs?: Set<string>
}

export async function renderMarkdown(
  markdown: string,
  options?: RenderMarkdownOptions,
): Promise<RenderResult> {
  const toc: TocItem[] = []
  const assetMap = options?.assetMap

  // 1. Math preprocessing (KaTeX)
  let processed = processMath(markdown)

  // 2. Callouts preprocessing
  processed = processCallouts(processed)

  // 3. Asset & Excalidraw embeds preprocessing
  processed = processAssetEmbeds(processed, {
    assetMap,
    knownAssets: options?.knownAssets,
    checkMissingAssets: options?.checkMissingAssets,
  })

  // 4. Note embeds / Transclusions preprocessing
  processed = await processNoteEmbeds(processed, options)

  // 5. Wikilinks preprocessing (broken link aware)
  processed = processWikilinks(processed, options?.knownSlugs)

  const marked = new Marked({
    gfm: true,
    breaks: false,
  })

  // Add custom renderer
  marked.use({
    renderer: {
      heading({ tokens, depth }) {
        const text = this.parser.parseInline(tokens)
        const plainText = text.replace(/<[^>]*>/g, '').trim()
        const id = slugify(plainText) || `heading-${toc.length + 1}`

        toc.push({
          id,
          text: plainText,
          level: depth,
        })

        return `<h${depth} id="${id}" class="heading-anchor"><a href="#${id}" class="anchor-link" aria-label="Anchor">#</a> ${text}</h${depth}>\n`
      },
      image({ href, title, text }) {
        const cleanHref = href?.trim() || ''
        const fileName = cleanHref.split('/').pop() || cleanHref
        const resolvedUrl =
          assetMap?.[cleanHref] || assetMap?.[fileName] || cleanHref

        const titleAttr = title ? ` title="${title}"` : ''
        return `<img src="${resolvedUrl}" alt="${text || ''}"${titleAttr} class="wiki-asset-img" loading="lazy" />`
      },
      code({ text, lang }) {
        const language = lang ? lang.split(/\s+/)[0] : 'text'

        // Render Mermaid diagram container
        if (language === 'mermaid') {
          return (
            `<div class="mermaid-diagram" data-language="mermaid">` +
            `<pre class="mermaid">${text}</pre>` +
            `</div>`
          )
        }

        return (
          `<div class="code-block-wrapper" data-language="${language}">` +
          `<div class="code-block-header"><span class="code-lang">${language}</span></div>` +
          `<pre><code class="language-${language}">${text}</code></pre>` +
          `</div>`
        )
      },
    },
  })

  const rawHtml = await marked.parse(processed)

  // Sanitize generated HTML safely
  const cleanHtml = sanitizeHtml(rawHtml, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      'h1',
      'h2',
      'span',
      'div',
      'pre',
      'code',
      'table',
      'thead',
      'tbody',
      'tr',
      'th',
      'td',
      'img',
      'math',
      'semantics',
      'mrow',
      'mi',
      'mo',
      'mn',
      'msup',
      'msub',
      'mfrac',
      'annotation',
      'svg',
      'path',
      'g',
      'rect',
      'circle',
      'line',
      'polyline',
      'polygon',
    ]),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      '*': ['class', 'id', 'data-*', 'aria-*', 'role', 'style', 'tabindex'],
      a: [
        'href',
        'name',
        'target',
        'rel',
        'class',
        'id',
        'aria-label',
        'title',
      ],
      img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
      svg: [
        'viewBox',
        'width',
        'height',
        'xmlns',
        'fill',
        'stroke',
        'stroke-width',
      ],
      path: ['d', 'fill', 'stroke'],
      annotation: ['encoding'],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  })

  return {
    html: cleanHtml,
    toc,
  }
}
