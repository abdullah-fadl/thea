import { defineConfig } from 'vitest/config'
import path from 'path'
import dotenv from 'dotenv'

// Load .env.local so DATABASE_URL and JWT_SECRET are available
dotenv.config({ path: path.resolve(__dirname, '.env.local') })

export default defineConfig({
  test: {
    // Integration tests run in Node (no jsdom) — they make real HTTP calls
    environment: 'node',
    globals: true,
    include: ['__tests__/integration/**/*.test.ts'],
    exclude: [],
    // Integration tests are sequential (shared DB state between steps)
    sequence: {
      concurrent: false,
    },
    // Longer timeout for real HTTP calls + DB operations
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
