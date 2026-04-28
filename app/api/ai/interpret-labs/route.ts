import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { AIEngine, getAISettings } from '@/lib/ai';
import { rateLimitAI, getRequestIp } from '@/lib/security/rateLimit';

export const dynamic = 'force-dynamic';

/**
 * POST /api/ai/interpret-labs
 *
 * AI-powered interpretation of lab results.
 * Body: {
 *   results: [{ testCode, testName, value, unit, referenceRange?, flag? }],
 *   patientAge?, patientGender?, clinicalContext?,
 *   previousResults?: [{ testCode, value, date }]
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

    // Check AI is enabled
    const settings = await getAISettings(tenantId);
    if (!settings.enabled || !settings.features.labInterpretation) {
      return NextResponse.json(
        { error: 'Lab AI interpretation is not enabled' },
        { status: 403 },
      );
    }

    const body = await req.json().catch(() => ({}));

    if (!body.results || !Array.isArray(body.results) || body.results.length === 0) {
      return NextResponse.json(
        { error: 'results array is required' },
        { status: 400 },
      );
    }

    // [AI-01] Input size limits to prevent abuse / excessive AI token usage
    if (body.results.length > 200) {
      return NextResponse.json(
        { error: 'Maximum 200 results per request', code: 'INPUT_TOO_LARGE' },
        { status: 400 },
      );
    }
    if (body.clinicalContext && String(body.clinicalContext).length > 5000) {
      return NextResponse.json(
        { error: 'clinicalContext exceeds 5000 character limit', code: 'INPUT_TOO_LARGE' },
        { status: 400 },
      );
    }
    if (body.previousResults && Array.isArray(body.previousResults) && body.previousResults.length > 200) {
      return NextResponse.json(
        { error: 'Maximum 200 previousResults per request', code: 'INPUT_TOO_LARGE' },
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
        { error: 'No AI provider is configured. Please set an API key.' },
        { status: 503 },
      );
    }

    if (!engine.checkRateLimit(settings.maxRequestsPerMinute)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 },
      );
    }

    const interpretation = await engine.interpretLabs({
      results: body.results,
      patientAge: body.patientAge,
      patientGender: body.patientGender,
      clinicalContext: body.clinicalContext,
      previousResults: body.previousResults,
    });

    // Also run rule-based pattern detection
    const numericResults = body.results
      .filter((r: { value: unknown }) => typeof r.value === 'number')
      .map((r: { testCode: string; value: number; unit: string; flag?: string }) => ({
        testCode: r.testCode,
        value: r.value,
        unit: r.unit,
        flag: r.flag,
      }));

    const patterns = engine.detectPatterns(numericResults);

    return NextResponse.json({
      interpretation,
      ruleBasedPatterns: patterns,
    });
  }),
  { tenantScoped: true, permissionKey: 'lab.results.view' },
);
