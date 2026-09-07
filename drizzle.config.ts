import { config } from 'dotenv'
import { defineConfig } from 'drizzle-kit'
import { fileURLToPath } from 'node:url'

config({ path: fileURLToPath(new URL('./.env', import.meta.url)) })

const schema = fileURLToPath(
  new URL('./apps/web/src/lib/db/schema.ts', import.meta.url),
)
const out = fileURLToPath(new URL('./drizzle', import.meta.url))

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL must be set')

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/lib/db/schema.ts',
  out: '../../drizzle',
  dbCredentials: { url: process.env.DATABASE_URL },
})
