import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ---------------------------------------------------------------------------
// Signal type → Decision type mapping
// ---------------------------------------------------------------------------
const SIGNAL_TO_DECISION_TYPE: Record<string, string> = {
  LIFECYCLE_BREACH: 'DEVICE_REPLACEMENT',
  STOCKOUT_RISK: 'SUPPLY_REORDER',
  BUDGET_OVERRUN: 'COST_OPTIMIZATION',
  COMPLIANCE_GAP: 'COMPLIANCE_ACTION',
  VENDOR_RISK: 'VENDOR_SWITCH',
};

// Severity → Confidence score mapping
const SEVERITY_CONFIDENCE: Record<string, number> = {
  CRITICAL: 92,
  HIGH: 78,
  MEDIUM: 55,
  LOW: 30,
};

// ---------------------------------------------------------------------------
// GET /api/imdad/decisions/signals — List operational signals
// ---------------------------------------------------------------------------
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const sp = req.nextUrl.searchParams;

    const signalType = sp.get('signalType')?.trim() || undefined;
    const severity = sp.get('severity')?.trim() || undefined;
    const sourceEntity = sp.get('sourceEntity')?.trim() || undefined;
    const organizationId = sp.get('organizationId')?.trim() || undefined;
    const acknowledged = sp.get('acknowledged');

    const page = Math.max(1, Number(sp.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, Number(sp.get('limit') || '20')));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { tenantId };
    if (signalType) where.signalType = signalType;
    if (severity) where.severity = severity;
    if (sourceEntity) where.sourceEntity = sourceEntity;
    if (organizationId) where.organizationId = organizationId;
    if (acknowledged === 'true') where.acknowledged = true;
    if (acknowledged === 'false') where.acknowledged = false;

    const [items, total] = await Promise.all([
      prisma.imdadOperationalSignal.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.imdadOperationalSignal.count({ where }),
    ]);

    return NextResponse.json({ items, total, page, limit });
  }),
  {
    tenantScoped: true,
    platformKey: 'imdad' as any,
    permissionKey: 'imdad.decisions.view',
  },
);

// ---------------------------------------------------------------------------
// POST /api/imdad/decisions/signals — Record a new operational signal
// ---------------------------------------------------------------------------
export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }) => {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    // --- Validation ---
    const requiredStrings = ['organizationId', 'signalType', 'severity', 'title', 'titleAr'] as const;
    const missing: string[] = [];
    for (const field of requiredStrings) {
      if (!body[field] || typeof body[field] !== 'string' || !body[field].trim()) {
        missing.push(field);
      }
    }
    if (missing.length) {
      return NextResponse.json({ error: `Missing or invalid fields: ${missing.join(', ')}` }, { status: 400 });
    }

    const validSeverities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
    const severity = body.severity.trim().toUpperCase();
    if (!validSeverities.includes(severity)) {
      return NextResponse.json({ error: `severity must be one of: ${validSeverities.join(', ')}` }, { status: 400 });
    }

    // --- Generate signal code ---
    const year = new Date().getFullYear();
    const existingCount = await prisma.imdadOperationalSignal.count({ where: { tenantId } });
    const sequence = String(existingCount + 1).padStart(6, '0');
    const signalCode = `SIG-${year}-${sequence}`;

    const signal = await prisma.imdadOperationalSignal.create({
      data: {
        tenantId,
        signalCode,
        organizationId: body.organizationId.trim(),
        signalType: body.signalType.trim(),
        severity,
        title: body.title.trim(),
        titleAr: body.titleAr.trim(),
        description: body.description?.trim() || null,
        descriptionAr: body.descriptionAr?.trim() || null,
        sourceEntity: body.sourceEntity?.trim() || null,
        sourceEntityId: body.sourceEntityId?.trim() || null,
        departmentId: body.departmentId?.trim() || null,
        metricValue: body.metricValue ?? null,
        threshold: body.threshold ?? null,
        deviationPct: body.deviationPct ?? null,
        acknowledged: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // --- Intelligence: Auto-generate decision for CRITICAL / HIGH signals ---
    let generatedDecision = null;

    if (severity === 'CRITICAL' || severity === 'HIGH') {
      const signalType = body.signalType.trim();
      const decisionType = SIGNAL_TO_DECISION_TYPE[signalType] || 'RISK_MITIGATION';
      const confidenceScore = SEVERITY_CONFIDENCE[severity] ?? 55;

      const decisionCount = await prisma.imdadDecision.count({ where: { tenantId } });
      const decSequence = String(decisionCount + 1).padStart(6, '0');
      const decisionCode = `DEC-${year}-${decSequence}`;

      const autoApprovalThreshold = 85;
      const autoApproved = confidenceScore >= autoApprovalThreshold;
      const status = autoApproved ? 'AUTO_APPROVED' : 'GENERATED';

      generatedDecision = await prisma.imdadDecision.create({
        data: {
          tenantId,
          decisionCode,
          organizationId: body.organizationId.trim(),
          decisionType: decisionType as any,
          title: `Auto: ${body.title.trim()}`,
          titleAr: `تلقائي: ${body.titleAr.trim()}`,
          description: `Decision auto-generated from signal ${signalCode} (${signalType}, ${severity})`,
          descriptionAr: `قرار تلقائي من الإشارة ${signalCode} (${signalType}، ${severity})`,
          confidenceScore,
          riskScore: severity === 'CRITICAL' ? 95 : 75,
          impactScore: severity === 'CRITICAL' ? 90 : 65,
          costImpact: null,
          savingsEstimate: null,
          escalationLevel: severity === 'CRITICAL' ? 'CORPORATE' : 'HOSPITAL',
          sourceSignals: [signal.id],
          recommendedActions: [],
          alternativeOptions: [],
          aiReasoning: `Signal-triggered decision: ${signalType} at ${severity} severity requires ${decisionType} action.`,
          aiReasoningAr: `قرار ناتج عن إشارة: ${signalType} بمستوى خطورة ${severity} يتطلب إجراء ${decisionType}.`,
          departmentId: body.departmentId?.trim() || null,
          relatedAssetIds: [],
          relatedItemIds: [],
          autoApprovalThreshold,
          autoApproved,
          status,
          executionDeadline: null,
          createdBy: userId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
    }

    return NextResponse.json(
      { signal, generatedDecision: generatedDecision || undefined },
      { status: 201 },
    );
  }),
  {
    tenantScoped: true,
    platformKey: 'imdad' as any,
    permissionKey: 'imdad.decisions.create',
  },
);
