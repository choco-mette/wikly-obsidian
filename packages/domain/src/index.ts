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
