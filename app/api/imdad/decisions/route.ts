import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ---------------------------------------------------------------------------
// GET /api/imdad/decisions — List decisions with filters & pagination
// ---------------------------------------------------------------------------
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const sp = req.nextUrl.searchParams;

    const status = sp.get('status')?.trim() || undefined;
    const type = sp.get('type')?.trim() || undefined;
    const organizationId = sp.get('organizationId')?.trim() || undefined;
    const escalationLevel = sp.get('escalationLevel')?.trim() || undefined;
    const minConfidence = sp.get('confidenceScore') ? Number(sp.get('confidenceScore')) : undefined;

    const page = Math.max(1, Number(sp.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, Number(sp.get('limit') || '20')));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { tenantId };
    if (status) where.status = status;
    if (type) where.decisionType = type;
    if (organizationId) where.organizationId = organizationId;
    if (escalationLevel) where.escalationLevel = escalationLevel;
    if (minConfidence !== undefined && !isNaN(minConfidence)) {
      where.confidenceScore = { gte: minConfidence };
    }

    const [items, total] = await Promise.all([
      prisma.imdadDecision.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.imdadDecision.count({ where }),
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
// POST /api/imdad/decisions — Generate a new decision
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
    const requiredStrings = ['organizationId', 'decisionType', 'title', 'titleAr'] as const;
    const missing: string[] = [];
    for (const field of requiredStrings) {
      if (!body[field] || typeof body[field] !== 'string' || !body[field].trim()) {
        missing.push(field);
      }
    }
    if (typeof body.confidenceScore !== 'number' || body.confidenceScore < 0 || body.confidenceScore > 100) {
      missing.push('confidenceScore (number 0-100)');
    }
    if (missing.length) {
      return NextResponse.json({ error: `Missing or invalid fields: ${missing.join(', ')}` }, { status: 400 });
    }

    // --- Generate decision code ---
    const year = new Date().getFullYear();
    const existingCount = await prisma.imdadDecision.count({ where: { tenantId } });
    const sequence = String(existingCount + 1).padStart(6, '0');
    const decisionCode = `DEC-${year}-${sequence}`;

    // --- Auto-approval logic ---
    const autoApprovalThreshold = body.autoApprovalThreshold ?? 85;
    const confidenceScore = Number(body.confidenceScore);
    const autoApproved = confidenceScore >= autoApprovalThreshold;
    const status = autoApproved ? 'AUTO_APPROVED' : 'GENERATED';

    const decision = await prisma.imdadDecision.create({
      data: {
        tenantId,
        decisionCode,
        organizationId: body.organizationId.trim(),
        decisionType: body.decisionType.trim(),
        title: body.title.trim(),
        titleAr: body.titleAr.trim(),
        description: body.description?.trim() || null,
        descriptionAr: body.descriptionAr?.trim() || null,
        confidenceScore,
        riskScore: body.riskScore ?? null,
        impactScore: body.impactScore ?? null,
        costImpact: body.costImpact ?? null,
        savingsEstimate: body.savingsEstimate ?? null,
        escalationLevel: body.escalationLevel || 'NONE',
        sourceSignals: body.sourceSignals || [],
        recommendedActions: body.recommendedActions || [],
        alternativeOptions: body.alternativeOptions || [],
        aiReasoning: body.aiReasoning?.trim() || null,
        aiReasoningAr: body.aiReasoningAr?.trim() || null,
        departmentId: body.departmentId || null,
        relatedAssetIds: body.relatedAssetIds || [],
        relatedItemIds: body.relatedItemIds || [],
        autoApprovalThreshold,
        autoApproved,
        status,
        executionDeadline: body.executionDeadline ? new Date(body.executionDeadline) : null,
        createdBy: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ decision }, { status: 201 });
  }),
  {
    tenantScoped: true,
    platformKey: 'imdad' as any,
    permissionKey: 'imdad.decisions.create',
  },
);
