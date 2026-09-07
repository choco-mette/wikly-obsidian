const path = require('node:path')
const { Pool } = require('pg')
const { drizzle } = require('drizzle-orm/node-postgres')
const { migrate } = require('drizzle-orm/node-postgres/migrator')

async function run() {
  const connectionString =
    process.env.DATABASE_URL ||
    `postgresql://${process.env.POSTGRES_USER || 'wikly'}:${process.env.POSTGRES_PASSWORD || 'wikly'}@${process.env.POSTGRES_HOST || 'postgres'}:${process.env.POSTGRES_PORT || 5432}/${process.env.POSTGRES_DB || 'wikly'}`

  console.log('[migration] Menghubungi database...')
  const pool = new Pool({ connectionString })

  try {
    const db = drizzle(pool)
    const migrationsFolder =
      process.env.MIGRATIONS_FOLDER || path.resolve(__dirname, '../drizzle')

    console.log(`[migration] Mengaplikasikan migrasi dari ${migrationsFolder}...`)
    await migrate(db, { migrationsFolder })
    console.log('[migration] Seluruh migrasi database berhasil diaplikasikan.')
  } finally {
    await pool.end()
  }
}

run().catch((err) => {
  console.error('[migration] Gagal menjalankan migrasi:', err)
  process.exit(1)
})
