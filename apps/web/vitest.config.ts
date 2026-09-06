import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'

// Load environment variables for tests
config({ path: fileURLToPath(new URL('../../.env', import.meta.url)) })

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
