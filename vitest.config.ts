import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./__tests__/setup.ts'],
    include: ['__tests__/**/*.test.ts', '__tests__/**/*.test.tsx'],
    exclude: ['__tests__/e2e/**', '__tests__/fixtures/**', '__tests__/integration/**', '__tests__/performance/**', '__tests__/security/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      // Phase 8.3 — @anthropic-ai/sdk is loaded lazily by lib/agents/llm/anthropic.ts
      // and is not a runtime dependency in this worktree. Vite's import-analysis
      // still needs to resolve the package string, so we map it to a local stub
      // for tests. Production code paths set ANTHROPIC_API_KEY and rely on the
      // real package being installed at deploy time.
      '@anthropic-ai/sdk': path.resolve(__dirname, '__tests__/__mocks__/anthropic-sdk-stub.ts'),
    },
  },
})
