import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ---------------------------------------------------------------------------
// Valid state transitions for decision status
// ---------------------------------------------------------------------------
const STATE_TRANSITIONS: Record<string, string[]> = {
  GENERATED: ['PENDING_REVIEW', 'APPROVED', 'REJECTED', 'OVERRIDDEN'],
  AUTO_APPROVED: ['EXECUTING', 'OVERRIDDEN', 'REJECTED'],
  PENDING_REVIEW: ['APPROVED', 'REJECTED', 'OVERRIDDEN'],
  APPROVED: ['EXECUTING', 'OVERRIDDEN'],
  OVERRIDDEN: ['EXECUTING', 'REJECTED'],
  EXECUTING: ['COMPLETED', 'FAILED'],
  REJECTED: [],
  COMPLETED: [],
  FAILED: ['EXECUTING', 'GENERATED'],
};

// ---------------------------------------------------------------------------
// GET /api/imdad/decisions/[id] — Single decision with actions & signals
// ---------------------------------------------------------------------------
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const id = String(req.nextUrl.pathname.split('/').filter(Boolean).pop() || '').trim();
    if (!id) {
      return NextResponse.json({ error: 'Decision id is required' }, { status: 400 });
    }

    const decision = await prisma.imdadDecision.findFirst({
      where: { tenantId, id },
    });
    if (!decision) {
      return NextResponse.json({ error: 'Decision not found' }, { status: 404 });
    }

    // Fetch related actions and source signals
    const [actions, signals] = await Promise.all([
      prisma.imdadDecisionAction.findMany({
        where: { tenantId, decisionId: id },
        orderBy: { createdAt: 'asc' },
      }).catch(() => []),
      prisma.imdadOperationalSignal.findMany({
        where: {
          tenantId,
          id: { in: Array.isArray(decision.sourceSignals) ? (decision.sourceSignals as string[]) : [] },
        },
        orderBy: { createdAt: 'desc' },
      }).catch(() => []),
    ]);

    return NextResponse.json({ decision: { ...decision, actions, signals } });
  }),
  {
    tenantScoped: true,
    platformKey: 'imdad' as any,
    permissionKey: 'imdad.decisions.view',
  },
);

// ---------------------------------------------------------------------------
// PATCH /api/imdad/decisions/[id] — Update decision status
// ---------------------------------------------------------------------------
export const PATCH = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }) => {
    const id = String(req.nextUrl.pathname.split('/').filter(Boolean).pop() || '').trim();
    if (!id) {
      return NextResponse.json({ error: 'Decision id is required' }, { status: 400 });
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const newStatus = body.status?.trim();
    if (!newStatus) {
      return NextResponse.json({ error: 'status is required' }, { status: 400 });
    }

    const decision = await prisma.imdadDecision.findFirst({
      where: { tenantId, id },
    });
    if (!decision) {
      return NextResponse.json({ error: 'Decision not found' }, { status: 404 });
    }

    // --- Validate state transition ---
    const currentStatus = decision.status as string;
    const allowed = STATE_TRANSITIONS[currentStatus];
    if (!allowed || !allowed.includes(newStatus)) {
      return NextResponse.json(
        { error: `Invalid transition from ${currentStatus} to ${newStatus}. Allowed: ${(allowed || []).join(', ') || 'none'}` },
        { status: 422 },
      );
    }

    // --- Build update payload ---
    const updateData: Record<string, unknown> = {
      status: newStatus,
      updatedAt: new Date(),
    };

    if (newStatus === 'APPROVED') {
      updateData.updatedBy = userId;
    }
    if (newStatus === 'REJECTED') {
      updateData.updatedBy = userId;
    }
    if (newStatus === 'OVERRIDDEN') {
      if (!body.overrideReason) {
        return NextResponse.json({ error: 'overrideReason is required for OVERRIDDEN status' }, { status: 400 });
      }
      updateData.overrideReason = body.overrideReason.trim();
      updateData.overriddenBy = userId;
      updateData.overriddenAt = new Date();
    }
    if (newStatus === 'EXECUTING') {
      updateData.executedBy = userId;
      updateData.executedAt = new Date();
    }
    if (newStatus === 'COMPLETED') {
      updateData.executedAt = new Date();
    }

    const updated = await prisma.imdadDecision.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ decision: updated });
  }),
  {
    tenantScoped: true,
    platformKey: 'imdad' as any,
    permissionKey: 'imdad.decisions.manage',
  },
);
