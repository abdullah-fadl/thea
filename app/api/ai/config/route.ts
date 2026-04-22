import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { getAISettings, saveAISettings } from '@/lib/ai';
import { rateLimitAI, getRequestIp } from '@/lib/security/rateLimit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/ai/config
 *
 * Returns AI settings for the current tenant.
 */
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const settings = await getAISettings(tenantId);

    // Also return provider availability
    const { OpenAIProvider } = await import('@/lib/ai/providers/openai');
    const { AnthropicProvider } = await import('@/lib/ai/providers/anthropic');
    const openai = new OpenAIProvider();
    const anthropic = new AnthropicProvider();

    return NextResponse.json({
      settings,
      providers: {
        openai: { available: openai.isAvailable(), model: openai.defaultModel },
        anthropic: { available: anthropic.isAvailable(), model: anthropic.defaultModel },
      },
    });
  }),
  { tenantScoped: true, permissionKey: 'admin.settings' },
);

/**
 * POST /api/ai/config
 *
 * Update AI settings.
 * Body: Partial<AISettings>
 */
export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const rl = await rateLimitAI({ ip: getRequestIp(req), tenantId });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
      );
    }

    const body = await req.json().catch(() => ({}));

    // Validate allowed fields
    const allowed = [
      'enabled',
      'provider',
      'anthropicModel',
      'openaiModel',
      'features',
      'departments',
      'auditEnabled',
      'maxRequestsPerMinute',
    ];

    const updates: any = {};
    for (const key of allowed) {
      if (key in body) updates[key] = body[key];
    }

    await saveAISettings(tenantId, updates);

    return NextResponse.json({ success: true });
  }),
  { tenantScoped: true, permissionKey: 'admin.settings' },
);

/**
 * GET /api/ai/config?stats=true
 *
 * Returns AI usage statistics.
 * (Handled within GET above if stats query param is present)
 */
