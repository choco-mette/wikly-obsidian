import { extractSourceId, generateSourceId, isPublishable } from '@wikly/domain'

export { extractSourceId, generateSourceId, isPublishable }

/**
 * Ensures frontmatter has a valid wiki.id. Generates a new one if missing.
 */
export function ensureSourceId(frontmatter: Record<string, unknown>): string {
  const existing = extractSourceId(frontmatter)
  if (existing) {
    return existing
  }

  const newId = generateSourceId()
  const wiki =
    frontmatter.wiki && typeof frontmatter.wiki === 'object'
      ? (frontmatter.wiki as Record<string, unknown>)
      : {}
  wiki.id = newId
  frontmatter.wiki = wiki
  return newId
}

/**
 * Simple parser for Markdown frontmatter delimiter (`---`).
 */
export function splitFrontmatterAndBody(fileContent: string): {
  rawFrontmatter: string | null
  body: string
} {
  const match = fileContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/)
  if (!match) {
    return {
      rawFrontmatter: null,
      body: fileContent,
    }
  }

  return {
    rawFrontmatter: match[1] ?? '',
    body: match[2] ?? '',
  }
}
