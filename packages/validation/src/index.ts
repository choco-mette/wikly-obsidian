import { z } from 'zod'

/** Shared validation schemas */
export const sourceIdSchema = z.string().min(1).max(128)

export const deviceAuthRequestSchema = z.object({
  siteId: z.string().uuid(),
  name: z.string().min(1).max(100),
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
