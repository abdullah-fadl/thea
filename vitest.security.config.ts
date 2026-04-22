import { defineConfig } from 'vitest/config'
import path from 'path'
import dotenv from 'dotenv'

// Load .env.local so DATABASE_URL and JWT_SECRET are available
dotenv.config({ path: path.resolve(__dirname, '.env.local') })

export default defineConfig({
  test: {
    // Security tests run in Node (no jsdom) — they make real HTTP calls
    environment: 'node',
    globals: true,
    include: ['__tests__/security/**/*.test.ts'],
    exclude: [],
    // Sequential execution — shared DB state and rate-limit tracking
    sequence: {
      concurrent: false,
    },
    // Generous timeouts for brute force / rate limiting tests
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
