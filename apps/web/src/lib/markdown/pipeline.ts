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
 * Preprocesses Obsidian wikilinks: [[Target Page]] or [[Target Page|Display Text]]
 */
export function processWikilinks(markdown: string): string {
  return markdown.replace(
    /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
    (_, target, alias) => {
      const rawTarget = target.trim()
      const label = alias ? alias.trim() : rawTarget
      const slug = slugify(rawTarget)
      return `<a href="/${slug}" class="wiki-link">${label}</a>`
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

export async function renderMarkdown(markdown: string): Promise<RenderResult> {
  const toc: TocItem[] = []

  // Pre-process wikilinks and callouts
  let processed = processCallouts(markdown)
  processed = processWikilinks(processed)

  const marked = new Marked({
    gfm: true,
    breaks: false,
  })

  // Add custom heading renderer with anchors and TOC collection
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
      code({ text, lang }) {
        const language = lang ? lang.split(/\s+/)[0] : 'text'
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
    ]),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      '*': ['class', 'id', 'data-*', 'aria-*', 'role'],
      a: ['href', 'name', 'target', 'rel', 'class', 'id', 'aria-label'],
      img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  })

  return {
    html: cleanHtml,
    toc,
  }
}
