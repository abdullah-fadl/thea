import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { isEnabled } from '@/lib/core/flags';
import { runAgent } from '@/lib/agents/framework/run';
import {
  AgentsDisabled,
  AgentNotFound,
  AgentInputValidationError,
} from '@/lib/agents/framework/types';

// POST /api/agents/[key]/run
// Body: { input: unknown }
// Auth: withAuthTenant + permission 'agents.run'
// Flag-gated: 404 when FF_AI_AGENTS_ENABLED=false

export const POST = withAuthTenant(
  async (
    req: NextRequest,
    { tenantId, userId }: { tenantId: string; userId: string; [k: string]: unknown },
    params?: { [key: string]: string | string[] } | Promise<{ [key: string]: string | string[] }>,
  ) => {
    if (!isEnabled('FF_AI_AGENTS_ENABLED')) {
      return NextResponse.json({ error: 'Not Found' }, { status: 404 });
    }

    const resolvedParams = params instanceof Promise ? await params : params;
    const agentKey = resolvedParams?.key;
    if (!agentKey || typeof agentKey !== 'string') {
      return NextResponse.json({ error: 'Agent key is required' }, { status: 400 });
    }

    let body: { input?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    try {
      const result = await runAgent({
        agentKey,
        input: body.input,
        tenantId,
        actorUserId: userId ?? null,
      });

      return NextResponse.json(result);
    } catch (err) {
      if (err instanceof AgentsDisabled) {
        return NextResponse.json({ error: 'Not Found' }, { status: 404 });
      }
      if (err instanceof AgentNotFound) {
        return NextResponse.json({ error: `Agent not found: ${agentKey}` }, { status: 404 });
      }
      if (err instanceof AgentInputValidationError) {
        return NextResponse.json({ error: err.message }, { status: 422 });
      }
      throw err;
    }
  },
  {
    tenantScoped: true,
    platformKey: 'thea_health',
    permissionKey: 'agents.run',
  },
);
