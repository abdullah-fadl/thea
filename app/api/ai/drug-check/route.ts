import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { AIEngine, getAISettings } from '@/lib/ai';
import { rateLimitAI, getRequestIp } from '@/lib/security/rateLimit';

export const dynamic = 'force-dynamic';

/**
 * POST /api/ai/drug-check
 *
 * Check for drug-drug interactions and allergy conflicts.
 * Body: {
 *   medications: [{ name, dose?, route?, frequency? }],
 *   allergies?: string[],
 *   renalFunction?, hepaticFunction?
 * }
 */
export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }) => {
    const rl = await rateLimitAI({ ip: getRequestIp(req), userId, tenantId });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
      );
    }

    const settings = await getAISettings(tenantId);
    if (!settings.enabled || !settings.features.drugInteraction) {
      return NextResponse.json(
        { error: 'Drug interaction AI check is not enabled' },
        { status: 403 },
      );
    }

    const body = await req.json().catch(() => ({}));

    if (!body.medications || !Array.isArray(body.medications)) {
      return NextResponse.json(
        { error: 'medications array is required' },
        { status: 400 },
      );
    }

    // [AI-01] Input size limits
    if (body.medications.length > 50) {
      return NextResponse.json(
        { error: 'Maximum 50 medications per request', code: 'INPUT_TOO_LARGE' },
        { status: 400 },
      );
    }
    if (body.allergies && Array.isArray(body.allergies) && body.allergies.length > 100) {
      return NextResponse.json(
        { error: 'Maximum 100 allergies per request', code: 'INPUT_TOO_LARGE' },
        { status: 400 },
      );
    }

    const engine = new AIEngine({
      tenantId,
      userId,
      providerName: settings.provider,
      model: settings.provider === 'anthropic' ? settings.anthropicModel : settings.openaiModel,
    });

    if (!engine.isAvailable()) {
      return NextResponse.json(
        { error: 'No AI provider is configured.' },
        { status: 503 },
      );
    }

    if (!engine.checkRateLimit(settings.maxRequestsPerMinute)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded.' },
        { status: 429 },
      );
    }

    const result = await engine.checkDrugs({
      medications: body.medications,
      allergies: body.allergies,
      renalFunction: body.renalFunction,
      hepaticFunction: body.hepaticFunction,
    });

    return NextResponse.json(result);
  }),
  { tenantScoped: true, permissionKey: 'opd.prescription.view' },
);
