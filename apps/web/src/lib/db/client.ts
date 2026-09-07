import path from 'node:path'
import { config } from 'dotenv'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

if (!process.env.DATABASE_URL) {
  config({ path: path.resolve(process.cwd(), '../../.env') })
  if (!process.env.DATABASE_URL) {
    config({ path: path.resolve(process.cwd(), '.env') })
  }
}

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL must be set')

export const pool = new Pool({ connectionString })
export const db = drizzle({ client: pool, schema })

