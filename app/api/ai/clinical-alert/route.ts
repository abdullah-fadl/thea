import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { AIEngine, getAISettings } from '@/lib/ai';
import { rateLimitAI, getRequestIp } from '@/lib/security/rateLimit';

export const dynamic = 'force-dynamic';

/**
 * POST /api/ai/clinical-alert
 *
 * Generate clinical decision support alerts.
 * Body: {
 *   trigger: string,              // "order_created" | "result_saved" | "vitals_entry" | "encounter"
 *   patientId: string,
 *   encounterId?: string,
 *   patientData: {
 *     age?, gender?, diagnoses?, medications?, allergies?,
 *     recentLabs?: [{ test, value, date }],
 *     recentVitals?: [{ type, value, date }]
 *   },
 *   context?: string
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
    if (!settings.enabled || !settings.features.clinicalDecisionSupport) {
      return NextResponse.json(
        { error: 'Clinical decision support is not enabled' },
        { status: 403 },
      );
    }

    const body = await req.json().catch(() => ({}));

    if (!body.trigger || !body.patientId) {
      return NextResponse.json(
        { error: 'trigger and patientId are required' },
        { status: 400 },
      );
    }

    // [AI-01] Input size limits
    if (body.context && String(body.context).length > 5000) {
      return NextResponse.json(
        { error: 'context exceeds 5000 character limit', code: 'INPUT_TOO_LARGE' },
        { status: 400 },
      );
    }
    const pd = body.patientData || {};
    if (pd.diagnoses && Array.isArray(pd.diagnoses) && pd.diagnoses.length > 100) {
      return NextResponse.json(
        { error: 'Maximum 100 diagnoses in patientData', code: 'INPUT_TOO_LARGE' },
        { status: 400 },
      );
    }
    if (pd.medications && Array.isArray(pd.medications) && pd.medications.length > 50) {
      return NextResponse.json(
        { error: 'Maximum 50 medications in patientData', code: 'INPUT_TOO_LARGE' },
        { status: 400 },
      );
    }
    if (pd.recentLabs && Array.isArray(pd.recentLabs) && pd.recentLabs.length > 200) {
      return NextResponse.json(
        { error: 'Maximum 200 recentLabs in patientData', code: 'INPUT_TOO_LARGE' },
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

    const result = await engine.generateAlerts({
      trigger: body.trigger,
      patientId: body.patientId,
      encounterId: body.encounterId,
      patientData: body.patientData || {},
      context: body.context,
    });

    // Save critical alerts to DB for persistence
    if (result.alerts.some((a) => a.severity === 'critical')) {
      try {
        const criticalAlerts = result.alerts.filter((a) => a.severity === 'critical');
        for (const alert of criticalAlerts) {
          await prisma.cdsAlert.create({
            data: {
              ...(alert as unknown as Record<string, unknown>),
              tenantId,
              acknowledged: false,
            },
          });
        }
      } catch {
        // Non-fatal — alerts are still returned in response
      }
    }

    return NextResponse.json(result);
  }),
  { tenantScoped: true, permissionKey: 'opd.visit.view' },
);
