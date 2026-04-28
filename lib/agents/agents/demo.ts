import { z } from 'zod';
import { registerAgent } from '../framework/registry';
import { registerTool, invokeTool } from '../framework/tools';
import { isEnabled } from '@/lib/core/flags';

// =============================================================================
// DemoAgent — for tests and documentation only
//
// Contract:
//   input:  { greeting: string }
//   output: { reply: string }
//
// Internally calls the `echo` tool (registered below) and returns its output.
// No Anthropic call. No PHI. Safe to run in tests with all mocks in place.
// Cedar policy: 'thea_health:read' — uses Phase 4.3 existing policy.
// =============================================================================

const DEMO_AGENT_KEY = 'demo.triage.v1';
const ECHO_TOOL_KEY = 'echo';

const demoInputSchema = z.object({
  greeting: z.string().min(1).max(500),
});

const demoOutputSchema = z.object({
  reply: z.string(),
});

const echoInputSchema = z.object({ message: z.string() });
const echoOutputSchema = z.object({ echoed: z.string() });

/**
 * Register the DemoAgent and its `echo` tool.
 * Must only be called when FF_AI_AGENTS_ENABLED=true.
 * Idempotent: no-ops if already registered (guard is in registerAgent/registerTool).
 */
export function registerDemoAgent(): void {
  if (!isEnabled('FF_AI_AGENTS_ENABLED')) return;

  registerTool({
    key: ECHO_TOOL_KEY,
    description: 'Echoes the input message back. Used only by DemoAgent.',
    inputSchema: echoInputSchema,
    outputSchema: echoOutputSchema,
    handler: async ({ message }) => ({ echoed: message }),
  });

  registerAgent({
    key: DEMO_AGENT_KEY,
    name: 'Demo Triage Agent v1',
    description:
      'Toy agent for tests and documentation. Returns a greeting reply via the echo tool.',
    version: 1,
    inputSchema: demoInputSchema,
    outputSchema: demoOutputSchema,
    policyKey: 'thea_health:read',
    handler: async (input, ctx) => {
      const result = (await invokeTool(
        ECHO_TOOL_KEY,
        { message: `Hello from Thea! You said: ${input.greeting}` },
        ctx,
      )) as { echoed: string };
      return { reply: result.echoed };
    },
  });
}

export { DEMO_AGENT_KEY, ECHO_TOOL_KEY };
