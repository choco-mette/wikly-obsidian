import { createHash } from 'node:crypto'

export const VAULT_PUBLISH_FLAG_PATH = ['wiki', 'published'] as const

export type PageStatus = 'published' | 'unpublished'

const CROCKFORD_BASE32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

/**
 * Generate 26-character Crockford Base32 ULID-compatible source ID.
 */
export function generateSourceId(): string {
  const now = Date.now()
  let timeStr = ''
  let temp = now
  for (let i = 0; i < 10; i++) {
    timeStr = CROCKFORD_BASE32[temp % 32] + timeStr
    temp = Math.floor(temp / 32)
  }
  let randStr = ''
  for (let i = 0; i < 16; i++) {
    const rand = Math.floor(Math.random() * 32)
    randStr += CROCKFORD_BASE32[rand]
  }
  return timeStr + randStr
}

/**
 * Deterministically compute sha256 checksum with `sha256:` prefix.
 */
export function computeContentHash(
  markdown: string,
  frontmatter?: Record<string, unknown> | null,
): string {
  const normalizedMd = markdown.replace(/\r\n/g, '\n')
  let serializedFm = ''
  if (frontmatter && typeof frontmatter === 'object') {
    const sortedKeys = Object.keys(frontmatter).sort()
    const sortedObj: Record<string, unknown> = {}
    for (const key of sortedKeys) {
      sortedObj[key] = frontmatter[key]
    }
    serializedFm = JSON.stringify(sortedObj)
  }
  const hash = createHash('sha256')
    .update(serializedFm + '\n---content---\n' + normalizedMd)
    .digest('hex')
  return `sha256:${hash}`
}

/**
 * Check if frontmatter has `wiki.published = true`.
 */
export function isPublishable(
  frontmatter?: Record<string, unknown> | null,
): boolean {
  if (!frontmatter || typeof frontmatter !== 'object') return false
  const wiki = (frontmatter as Record<string, unknown>).wiki
  if (wiki && typeof wiki === 'object') {
    return (wiki as Record<string, unknown>).published === true
  }
  return false
}

/**
 * Extract `wiki.id` from frontmatter.
 */
export function extractSourceId(
  frontmatter?: Record<string, unknown> | null,
): string | null {
  if (!frontmatter || typeof frontmatter !== 'object') return null
  const wiki = (frontmatter as Record<string, unknown>).wiki
  if (wiki && typeof wiki === 'object') {
    const id = (wiki as Record<string, unknown>).id
    if (typeof id === 'string' && id.trim()) {
      return id.trim()
    }
  }
  return null
}

/**
 * Standard URL-safe slug converter.
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/\.md$/i, '')
    .replace(/[^a-z0-9\-_/]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Extract unique target page names from Markdown wikilinks: [[target|alias]].
 */
export function parseWikilinks(markdown: string): string[] {
  const regex = /\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g
  const targets = new Set<string>()
  let match: RegExpExecArray | null
  while ((match = regex.exec(markdown)) !== null) {
    const target = match[1]?.trim()
    if (target) {
      targets.add(target)
    }
  }
  return Array.from(targets)
}

export interface AssetReference {
  raw: string
  path: string
  alt?: string
  isEmbed: boolean
}

const COMMON_MIME_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  avif: 'image/avif',
  ico: 'image/x-icon',
  bmp: 'image/bmp',
  pdf: 'application/pdf',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  m4a: 'audio/mp4',
}

/**
 * Detect MIME type from filename extension.
 */
export function detectMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  return COMMON_MIME_TYPES[ext] || 'application/octet-stream'
}

/**
 * Deterministically compute sha256 checksum with `sha256:` prefix for binary data.
 */
export function computeBinaryHash(
  data: Buffer | Uint8Array | ArrayBuffer,
): string {
  let buffer: Buffer
  if (Buffer.isBuffer(data)) {
    buffer = data
  } else if (data instanceof Uint8Array) {
    buffer = Buffer.from(data.buffer, data.byteOffset, data.byteLength)
  } else {
    buffer = Buffer.from(data)
  }
  const hash = createHash('sha256').update(buffer).digest('hex')
  return `sha256:${hash}`
}

/**
 * Extract local asset references from Markdown body.
 * Supports Obsidian embeds (![[file.png]]) and standard markdown images (![alt](file.png)).
 * Ignores remote URLs (http://, https://, data:).
 */
export function extractAssetReferences(markdown: string): AssetReference[] {
  const refs: AssetReference[] = []
  const seenRaw = new Set<string>()

  // 1. Obsidian Embeds: ![[path/to/asset.png|alt or dimensions]]
  const embedRegex = /!\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?\]\]/g
  let match: RegExpExecArray | null
  while ((match = embedRegex.exec(markdown)) !== null) {
    const raw = match[0]
    const targetPath = match[1]?.trim()
    const alt = match[2]?.trim()

    if (!targetPath || targetPath.toLowerCase().endsWith('.md')) {
      continue
    }

    if (!seenRaw.has(raw)) {
      seenRaw.add(raw)
      refs.push({
        raw,
        path: targetPath,
        alt: alt || undefined,
        isEmbed: true,
      })
    }
  }

  // 2. Standard Markdown Images: ![alt](path "optional title")
  const mdImgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g
  while ((match = mdImgRegex.exec(markdown)) !== null) {
    const raw = match[0]
    const alt = match[1]?.trim()
    let rawPath = match[2]?.trim() || ''

    // Strip optional quotes at the end, e.g. "path" "title"
    const titleMatch = rawPath.match(/^(\S+)(?:\s+["'].*["'])?$/)
    if (titleMatch && titleMatch[1]) {
      rawPath = titleMatch[1]
    }

    // Ignore remote URLs and base64 data URIs
    if (
      rawPath.startsWith('http://') ||
      rawPath.startsWith('https://') ||
      rawPath.startsWith('data:') ||
      rawPath.startsWith('//')
    ) {
      continue
    }

    if (!seenRaw.has(raw)) {
      seenRaw.add(raw)
      refs.push({
        raw,
        path: rawPath,
        alt: alt || undefined,
        isEmbed: false,
      })
    }
  }

  return refs
}

export interface FrontmatterTagsPatch {
  add?: string[]
  remove?: string[]
}

export interface FrontmatterPropertiesPatch {
  set?: Record<string, unknown>
  unset?: string[]
}

export interface FrontmatterPatch {
  tags?: FrontmatterTagsPatch
  properties?: FrontmatterPropertiesPatch
}

/**
 * Apply targeted mutations to note frontmatter while preserving untouched fields.
 * Handles string vs array tags, '#' stripping, and nested property dot paths (e.g. 'wiki.published').
 */
export function applyFrontmatterPatch(
  frontmatter: Record<string, unknown>,
  patch: FrontmatterPatch,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...frontmatter }

  // 1. Tags patch
  if (patch.tags) {
    let currentTags: string[] = []
    if (Array.isArray(result.tags)) {
      currentTags = result.tags.map(String)
    } else if (typeof result.tags === 'string') {
      currentTags = result.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
    } else if (Array.isArray(result.tag)) {
      currentTags = result.tag.map(String)
    } else if (typeof result.tag === 'string') {
      currentTags = result.tag
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
    }

    const tagSet = new Set(
      currentTags.map((t) => t.replace(/^#/, '').trim()).filter(Boolean),
    )

    if (patch.tags.remove && Array.isArray(patch.tags.remove)) {
      for (const t of patch.tags.remove) {
        const clean = t.replace(/^#/, '').trim()
        tagSet.delete(clean)
      }
    }

    if (patch.tags.add && Array.isArray(patch.tags.add)) {
      for (const t of patch.tags.add) {
        const clean = t.replace(/^#/, '').trim()
        if (clean) {
          tagSet.add(clean)
        }
      }
    }

    result.tags = Array.from(tagSet)
    if ('tag' in result && 'tags' in result) {
      delete result.tag
    }
  }

  // 2. Properties patch
  if (patch.properties) {
    if (patch.properties.set && typeof patch.properties.set === 'object') {
      for (const [key, value] of Object.entries(patch.properties.set)) {
        if (key.includes('.')) {
          const parts = key.split('.')
          let curr: Record<string, unknown> = result
          for (let i = 0; i < parts.length - 1; i++) {
            const p = parts[i]
            if (
              !p ||
              !curr[p] ||
              typeof curr[p] !== 'object' ||
              Array.isArray(curr[p])
            ) {
              curr[p!] = {}
            } else {
              curr[p!] = { ...(curr[p] as Record<string, unknown>) }
            }
            curr = curr[p!] as Record<string, unknown>
          }
          const lastPart = parts[parts.length - 1]
          if (lastPart) {
            curr[lastPart] = value
          }
        } else {
          result[key] = value
        }
      }
    }

    if (patch.properties.unset && Array.isArray(patch.properties.unset)) {
      for (const key of patch.properties.unset) {
        if (key.includes('.')) {
          const parts = key.split('.')
          let curr: Record<string, unknown> = result
          for (let i = 0; i < parts.length - 1; i++) {
            const p = parts[i]
            if (
              !p ||
              !curr[p] ||
              typeof curr[p] !== 'object' ||
              Array.isArray(curr[p])
            ) {
              break
            }
            curr[p!] = { ...(curr[p] as Record<string, unknown>) }
            curr = curr[p!] as Record<string, unknown>
          }
          const lastPart = parts[parts.length - 1]
          if (lastPart && curr) {
            delete curr[lastPart]
          }
        } else {
          delete result[key]
        }
      }
    }
  }

  return result
}

/**
 * Extract aliases from frontmatter.
 * Supports string array `aliases: ['a', 'b']` or string `aliases: 'a'`.
 */
export function extractAliases(
  frontmatter?: Record<string, unknown> | null,
): string[] {
  if (!frontmatter || typeof frontmatter !== 'object') return []
  const raw = frontmatter.aliases
  if (!raw) return []

  if (Array.isArray(raw)) {
    return raw
      .filter(
        (item): item is string =>
          typeof item === 'string' && item.trim().length > 0,
      )
      .map((item) => item.trim())
  }

  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    return trimmed ? [trimmed] : []
  }

  return []
}
