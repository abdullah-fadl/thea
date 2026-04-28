import { defineConfig } from 'vitest/config'
import path from 'path'
import dotenv from 'dotenv'

// Load .env.local so DATABASE_URL and JWT_SECRET are available
dotenv.config({ path: path.resolve(__dirname, '.env.local') })

export default defineConfig({
  test: {
    // Performance tests run in Node (no jsdom) — they make real HTTP calls
    environment: 'node',
    globals: true,
    include: ['__tests__/performance/**/*.test.ts'],
    exclude: [],
    // Performance tests are sequential (shared seed data, DB connections)
    sequence: {
      concurrent: false,
    },
    // Long timeouts — performance benchmarks can take several minutes
    testTimeout: 120_000,
    hookTimeout: 300_000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
