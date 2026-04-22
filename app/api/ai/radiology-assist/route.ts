import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { AIEngine, getAISettings } from '@/lib/ai';
import { rateLimitAI, getRequestIp } from '@/lib/security/rateLimit';

export const dynamic = 'force-dynamic';

/**
 * POST /api/ai/radiology-assist
 *
 * AI-powered radiology report assistance.
 * Body: {
 *   modality, bodyPart, clinicalIndication?,
 *   currentFindings?, priorReports?: [{ date, impression }],
 *   patientAge?, patientGender?
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
    if (!settings.enabled || !settings.features.radiologyAssist) {
      return NextResponse.json(
        { error: 'Radiology AI assistance is not enabled' },
        { status: 403 },
      );
    }

    const body = await req.json().catch(() => ({}));

    if (!body.modality || !body.bodyPart) {
      return NextResponse.json(
        { error: 'modality and bodyPart are required' },
        { status: 400 },
      );
    }

    // [AI-01] Input size limits
    if (body.currentFindings && String(body.currentFindings).length > 10000) {
      return NextResponse.json(
        { error: 'currentFindings exceeds 10000 character limit', code: 'INPUT_TOO_LARGE' },
        { status: 400 },
      );
    }
    if (body.priorReports && Array.isArray(body.priorReports) && body.priorReports.length > 20) {
      return NextResponse.json(
        { error: 'Maximum 20 priorReports per request', code: 'INPUT_TOO_LARGE' },
        { status: 400 },
      );
    }
    if (body.clinicalIndication && String(body.clinicalIndication).length > 2000) {
      return NextResponse.json(
        { error: 'clinicalIndication exceeds 2000 character limit', code: 'INPUT_TOO_LARGE' },
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

    const assistance = await engine.assistRadiology({
      modality: body.modality,
      bodyPart: body.bodyPart,
      clinicalIndication: body.clinicalIndication,
      currentFindings: body.currentFindings,
      priorReports: body.priorReports,
      patientAge: body.patientAge,
      patientGender: body.patientGender,
    });

    return NextResponse.json({ assistance });
  }),
  { tenantScoped: true, permissionKey: 'radiology.report.view' },
);
