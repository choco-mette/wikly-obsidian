import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { getStorageDriver } from '@/lib/storage'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const startTime = Date.now()

export async function GET() {
  const checkStart = Date.now()
  let dbStatus: 'up' | 'down' = 'down'
  let dbLatencyMs = 0
  let storageStatus: 'up' | 'down' = 'down'
  let isHealthy = true

  // 1. Check Database
  try {
    const dbPingStart = Date.now()
    await pool.query('SELECT 1 as ping')
    dbLatencyMs = Date.now() - dbPingStart
    dbStatus = 'up'
  } catch (err: unknown) {
    dbStatus = 'down'
    isHealthy = false
    logger.error('Healthcheck DB ping failed', { error: err })
  }

  // 2. Check Storage Driver
  try {
    const driver = getStorageDriver()
    // Non-throwing probe (verifies driver instantiation and connectivity)
    await driver.exists('__healthcheck__')
    storageStatus = 'up'
  } catch {
    storageStatus = 'down'
    // Storage down is considered degraded rather than fatal
  }

  const responseBody = {
    status: isHealthy ? (storageStatus === 'up' ? 'ok' : 'degraded') : 'error',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
    totalCheckMs: Date.now() - checkStart,
    services: {
      database: {
        status: dbStatus,
        latencyMs: dbLatencyMs,
      },
      storage: {
        status: storageStatus,
        driver: process.env.STORAGE_DRIVER || 's3',
      },
    },
    version: '0.1.0',
  }

  return NextResponse.json(responseBody, {
    status: isHealthy ? 200 : 503,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  })
}
