import path from 'node:path'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { db } from '../lib/db'

export async function runMigrations(
  migrationsFolder?: string,
): Promise<void> {
  const folder =
    migrationsFolder ||
    process.env.MIGRATIONS_FOLDER ||
    path.resolve(process.cwd(), 'drizzle')

  console.log(`[migration] Menjalankan migrasi dari ${folder}...`)
  await migrate(db, { migrationsFolder: folder })
  console.log('[migration] Seluruh migrasi database berhasil diaplikasikan.')
}

// Execute when run directly
if (process.argv[1]?.includes('migrate')) {
  runMigrations()
    .then(() => {
      process.exit(0)
    })
    .catch((err: unknown) => {
      console.error('[migration] Gagal menjalankan migrasi:', err)
      process.exit(1)
    })
}
