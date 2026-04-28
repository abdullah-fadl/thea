// =============================================================================
// Vitest stub for @anthropic-ai/sdk
//
// The real package is NOT a runtime dependency in this worktree because the
// Phase 6.2 wrapper at lib/agents/llm/anthropic.ts loads the SDK lazily via
// `await import('@anthropic-ai/sdk')` only when FF_AI_AGENTS_ENABLED=ON and
// ANTHROPIC_API_KEY is set. Vite's import-analysis still wants to resolve
// the dynamic import string at parse time, so we point the alias at this
// stub from vitest.config.ts. Per-test `vi.mock(...)` calls supersede this
// stub — it just satisfies the resolver.
// =============================================================================

class AnthropicStub {
  messages = {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    create: async (_args: unknown) => ({
      content: [{ type: 'text', text: '' }],
      usage: { input_tokens: 0, output_tokens: 0 },
    }),
  };
}

export default AnthropicStub;
