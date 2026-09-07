import { describe, it, expect } from 'vitest'
import { GET } from '../route'

describe('API: /api/health', () => {
  it('returns HTTP 200 with database and storage health status', async () => {
    const response = await GET()
    expect(response.status).toBe(200)

    const json = (await response.json()) as {
      status: string
      timestamp: string
      uptimeSeconds: number
      services: {
        database: { status: string; latencyMs: number }
        storage: { status: string; driver: string }
      }
      version: string
    }

    expect(json.status).toBe('ok')
    expect(json.services.database.status).toBe('up')
    expect(json.services.storage.status).toBe('up')
    expect(typeof json.services.database.latencyMs).toBe('number')
    expect(typeof json.uptimeSeconds).toBe('number')
    expect(json.version).toBe('0.1.0')
  })
})
