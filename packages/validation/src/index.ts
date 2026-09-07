import { z } from 'zod'

/** Shared validation schemas */
export const sourceIdSchema = z.string().min(1).max(128)

export const deviceAuthRequestSchema = z.object({
  siteId: z.string().uuid(),
  pairingCode: z.string().min(4).max(32),
})

export type DeviceAuthRequestInput = z.infer<typeof deviceAuthRequestSchema>

export const publishAssetReferenceSchema = z.object({
  assetId: z.string().optional(),
  path: z.string().min(1),
  hash: z.string().min(1),
})

export const publishRequestSchema = z.object({
  siteId: z.string().uuid(),
  sourceId: sourceIdSchema,
  path: z.string().min(1),
  title: z.string().min(1),
  slug: z.string().min(1),
  markdown: z.string(),
  frontmatter: z.record(z.string(), z.unknown()),
  contentHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  serverRevision: z.number().int().positive().optional(),
  assets: z.array(publishAssetReferenceSchema).optional().default([]),
})

export type PublishRequestInput = z.infer<typeof publishRequestSchema>

export const assetCheckItemSchema = z.object({
  path: z.string().min(1),
  hash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
})

export const assetCheckSchema = z.object({
  siteId: z.string().uuid(),
  assets: z.array(assetCheckItemSchema),
})

export type AssetCheckInput = z.infer<typeof assetCheckSchema>

export const assetPresignSchema = z.object({
  siteId: z.string().uuid(),
  filename: z.string().min(1),
  hash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  sizeBytes: z.number().int().nonnegative(),
  mimeType: z.string().min(1),
})

export type AssetPresignInput = z.infer<typeof assetPresignSchema>

export const syncChangesQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

export type SyncChangesQueryInput = z.infer<typeof syncChangesQuerySchema>

export const syncAckSchema = z.object({
  success: z.boolean(),
  leaseId: z.string().min(1),
  result: z
    .object({
      sourceId: z.string().min(1),
      contentHash: z.string().min(1),
    })
    .optional(),
  errorCode: z.string().optional(),
  message: z.string().optional(),
})

export type SyncAckInput = z.infer<typeof syncAckSchema>

export const frontmatterPatchSchema = z.object({
  tags: z
    .object({
      add: z.array(z.string()).optional(),
      remove: z.array(z.string()).optional(),
    })
    .optional(),
  properties: z
    .object({
      set: z.record(z.string(), z.unknown()).optional(),
      unset: z.array(z.string()).optional(),
    })
    .optional(),
})

export type FrontmatterPatchInput = z.infer<typeof frontmatterPatchSchema>

export const createPendingChangeSchema = z.object({
  siteId: z.string().uuid().optional(),
  sourceId: sourceIdSchema,
  operation: z.enum(['frontmatter.patch']),
  baseRevision: z.number().int().positive().optional(),
  patch: frontmatterPatchSchema,
})

export type CreatePendingChangeInput = z.infer<typeof createPendingChangeSchema>
