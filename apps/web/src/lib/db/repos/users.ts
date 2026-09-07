import { createHash, timingSafeEqual } from 'node:crypto'
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

export async function verifyAdminCredentials(
  email: string,
  password: string,
): Promise<User | null> {
  const user = await getUserByEmail(email)
  if (!user || !user.passwordHash) {
    return null
  }

  const computedHash = createHash('sha256').update(password).digest('hex')
  const userHashBuf = Buffer.from(user.passwordHash, 'hex')
  const compHashBuf = Buffer.from(computedHash, 'hex')

  if (
    userHashBuf.length !== compHashBuf.length ||
    !timingSafeEqual(userHashBuf, compHashBuf)
  ) {
    return null
  }

  return user
}
