import { eq } from 'drizzle-orm'
import { db } from '../client'
import { users } from '../schema'
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'

export type User = InferSelectModel<typeof users>
export type InsertUser = InferInsertModel<typeof users>

export async function createUser(user: InsertUser): Promise<User> {
  const [created] = await db.insert(users).values(user).returning()
  return created
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const [user] = await db.select().from(users).where(eq(users.email, email))
  return user ?? null
}
