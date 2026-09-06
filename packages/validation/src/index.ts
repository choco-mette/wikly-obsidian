import { z } from 'zod'

/** Shared validation starts here; endpoint schemas are added alongside each API. */
export const sourceIdSchema = z.string().min(1).max(128)
