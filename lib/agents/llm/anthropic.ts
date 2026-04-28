import { isEnabled } from '@/lib/core/flags';

// =============================================================================
// Anthropic LLM wrapper — Phase 6.2
//
// LAZY LOAD GUARANTEE:
//   - `@anthropic-ai/sdk` is NEVER imported at module top level.
//   - The SDK is loaded dynamically on first call to getAnthropicClient().
//   - This function is ONLY called when FF_AI_AGENTS_ENABLED=true AND an
//     agent explicitly requests an LLM call. It is never called at module load.
//
// Default model: claude-sonnet-4-6 (can be overridden per agent via opts.model).
// See https://docs.anthropic.com/en/docs/about-claude/models for current model IDs.
// =============================================================================

export const DEFAULT_AGENT_MODEL = 'claude-sonnet-4-6';

// ─── Error classes ────────────────────────────────────────────────────────────

export class AgentLLMConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AgentLLMConfigurationError';
  }
}

export class AgentLLMRateLimit extends Error {
  constructor() {
    super('Anthropic API rate limit exceeded');
    this.name = 'AgentLLMRateLimit';
  }
}

export class AgentLLMServerError extends Error {
  constructor(public readonly statusCode: number) {
    super(`Anthropic API server error: ${statusCode}`);
    this.name = 'AgentLLMServerError';
  }
}

// ─── Internal lazy client ────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _cachedClient: any | null = null;

/**
 * Lazy-load @anthropic-ai/sdk and return a configured client.
 * Safe to call repeatedly — SDK is loaded once and cached.
 * Throws AgentLLMConfigurationError if:
 *  - FF_AI_AGENTS_ENABLED is OFF
 *  - ANTHROPIC_API_KEY is not set
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getAnthropicClient(): Promise<any> {
  if (!isEnabled('FF_AI_AGENTS_ENABLED')) {
    throw new AgentLLMConfigurationError(
      'Cannot create Anthropic client: FF_AI_AGENTS_ENABLED is OFF',
    );
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    throw new AgentLLMConfigurationError(
      'ANTHROPIC_API_KEY environment variable is not set',
    );
  }

  if (!_cachedClient) {
    // Dynamic import — SDK is never loaded unless this function is called.
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    _cachedClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  return _cachedClient;
}

// ─── Public chat interface ────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  model?: string;
  maxTokens?: number;
  systemPrompt?: string;
}

export interface ChatResult {
  text: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

/**
 * Send a chat request to Anthropic with a single retry on transient errors.
 * Maps SDK errors to typed AgentLLM* errors.
 */
export async function chat(
  messages: ChatMessage[],
  opts: ChatOptions = {},
): Promise<ChatResult> {
  const client = await getAnthropicClient();
  const model = opts.model ?? DEFAULT_AGENT_MODEL;
  const maxTokens = opts.maxTokens ?? 1024;

  const attempt = async (): Promise<ChatResult> => {
    const response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      system: opts.systemPrompt,
      messages,
    });

    const textBlock = response.content.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (b: any) => b.type === 'text',
    );
    const text: string = textBlock ? textBlock.text : '';

    return {
      text,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    };
  };

  try {
    return await attempt();
  } catch (err: unknown) {
    // Classify the error then retry once for transient failures
    const status =
      err && typeof err === 'object' && 'status' in err
        ? (err as { status: number }).status
        : undefined;

    if (status === 429) {
      // Rate limit — retry once after a short back-off
      await new Promise((r) => setTimeout(r, 1000));
      try {
        return await attempt();
      } catch {
        throw new AgentLLMRateLimit();
      }
    }

    if (status && status >= 500) {
      throw new AgentLLMServerError(status);
    }

    throw err;
  }
}

/** For testing: reset the cached client so a fresh dynamic import occurs. */
export function _resetClientForTest(): void {
  _cachedClient = null;
}
