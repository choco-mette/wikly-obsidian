/**
 * Framework-independent business rules belong here. The Vault remains the
 * source of truth; this package must not depend on database or UI code.
 */
export const VAULT_PUBLISH_FLAG_PATH = ['wiki', 'published'] as const

export type PageStatus = 'published' | 'unpublished'
