import { eq } from 'drizzle-orm'
import { db } from '../client'
import { sites } from '../schema'
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'

export type Site = InferSelectModel<typeof sites>
export type InsertSite = InferInsertModel<typeof sites>

export async function createSite(site: InsertSite): Promise<Site> {
  const [created] = await db.insert(sites).values(site).returning()
  return created
}

export async function getSiteById(id: string): Promise<Site | null> {
  const [site] = await db.select().from(sites).where(eq(sites.id, id))
  return site ?? null
}

export async function getSiteBySlug(slug: string): Promise<Site | null> {
  const [site] = await db.select().from(sites).where(eq(sites.slug, slug))
  return site ?? null
}
