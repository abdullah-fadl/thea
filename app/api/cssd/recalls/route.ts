import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Prisma delegate for models not yet in schema
const db = prisma as unknown as Record<string, {
  findMany: (args?: unknown) => Promise<any[]>;
  findFirst: (args?: unknown) => Promise<any | null>;
  create: (args?: unknown) => Promise<any>;
  update: (args?: unknown) => Promise<any>;
  count: (args?: unknown) => Promise<number>;
}>;

/* ────────────────────────────────────────────────────────────────────────────
 * GET — list recalls with optional filters
 * ──────────────────────────────────────────────────────────────────────────── */

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || undefined;
    const severity = searchParams.get('severity') || undefined;
    const cycleId = searchParams.get('cycleId') || undefined;

    const recalls = await db.cssdRecall.findMany({
      where: {
        tenantId,
        ...(status ? { status } : {}),
        ...(severity ? { severity } : {}),
        ...(cycleId ? { cycleId } : {}),
      },
      orderBy: { initiatedAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({ recalls });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'cssd.view' }
);

/* ────────────────────────────────────────────────────────────────────────────
 * POST — create a new recall
 * ──────────────────────────────────────────────────────────────────────────── */

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }) => {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { cycleId, trayId, recallReason, recallType, severity, notes } = body;

    if (!cycleId || !trayId || !recallReason || !severity) {
      return NextResponse.json(
        { error: 'cycleId, trayId, recallReason, and severity are required' },
        { status: 400 }
      );
    }

    const validReasons = ['BI_FAILURE', 'CI_FAILURE', 'EQUIPMENT_MALFUNCTION', 'PACKAGING_BREACH', 'EXPIRY', 'OTHER'];
    if (!validReasons.includes(recallReason)) {
      return NextResponse.json({ error: `recallReason must be one of: ${validReasons.join(', ')}` }, { status: 400 });
    }

    const validSeverities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
    if (!validSeverities.includes(severity)) {
      return NextResponse.json({ error: `severity must be one of: ${validSeverities.join(', ')}` }, { status: 400 });
    }

    /* Verify the cycle exists */
    const cycle = await prisma.cssdCycle.findFirst({
      where: { id: String(cycleId), tenantId },
    });
    if (!cycle) {
      return NextResponse.json({ error: 'Cycle not found' }, { status: 404 });
    }

    /* Auto-collect affected dispatches from the cycle */
    let affectedDispatches: any[] = [];
    try {
      const dispatches = await db.cssdDispatch.findMany({
        where: { tenantId, cycleId: String(cycleId) },
        select: { id: true, dispatchedTo: true, status: true },
      });
      affectedDispatches = dispatches.map((d) => ({
        dispatchId: d.id,
        department: d.dispatchedTo || 'Unknown',
        status: d.status || 'DISPATCHED',
      }));
    } catch {
      /* dispatch model may not exist yet — gracefully continue */
    }

    /* Affected loads — same machine/load batch */
    let affectedLoads: any[] = [];
    try {
      if ((cycle as Record<string, unknown>).machine) {
        const sameMachineLoads = await prisma.cssdCycle.findMany({
          where: {
            tenantId,
            machine: (cycle as Record<string, unknown>).machine,
            id: { not: String(cycleId) },
            startTime: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // last 24h
            },
          },
          select: { id: true, loadNumber: true, machine: true, startTime: true },
          take: 20,
        });
        affectedLoads = sameMachineLoads.map((l) => ({
          loadNumber: l.loadNumber,
          machine: l.machine,
          date: l.startTime,
        }));
      }
    } catch {
      /* gracefully continue */
    }

    const recall = await db.cssdRecall.create({
      data: {
        tenantId,
        cycleId: String(cycleId),
        trayId: String(trayId),
        recallReason: String(recallReason),
        recallType: recallType || 'MANDATORY',
        severity: String(severity),
        initiatedBy: userId,
        initiatedAt: new Date(),
        affectedLoads: affectedLoads.length > 0 ? affectedLoads : undefined,
        affectedDispatches: affectedDispatches.length > 0 ? affectedDispatches : undefined,
        notifications: [],
        investigationNotes: notes ? String(notes) : null,
        status: 'OPEN',
      },
    });

    return NextResponse.json({ success: true, id: recall.id, recall }, { status: 201 });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'cssd.manage' }
);

/* ────────────────────────────────────────────────────────────────────────────
 * PUT — update an existing recall
 * ──────────────────────────────────────────────────────────────────────────── */

export const PUT = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }) => {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { id, status, rootCause, correctiveAction, preventiveAction, investigationNotes, closedNotes, notification } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const existing = await db.cssdRecall.findFirst({
      where: { id: String(id), tenantId },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Recall not found' }, { status: 404 });
    }

    const updateData: any = {};

    /* Status transition */
    if (status) {
      const validStatuses = ['OPEN', 'IN_PROGRESS', 'ITEMS_RETRIEVED', 'INVESTIGATION', 'CLOSED'];
      if (!validStatuses.includes(status)) {
        return NextResponse.json({ error: `status must be one of: ${validStatuses.join(', ')}` }, { status: 400 });
      }
      updateData.status = status;

      if (status === 'CLOSED') {
        updateData.closedBy = userId;
        updateData.closedAt = new Date();
        if (closedNotes) {
          updateData.closedNotes = String(closedNotes);
        }
      }
    }

    /* Root cause analysis fields */
    if (rootCause !== undefined) updateData.rootCause = String(rootCause);
    if (correctiveAction !== undefined) updateData.correctiveAction = String(correctiveAction);
    if (preventiveAction !== undefined) updateData.preventiveAction = String(preventiveAction);
    if (investigationNotes !== undefined) updateData.investigationNotes = String(investigationNotes);

    /* Add notification entry */
    if (notification) {
      const existingNotifications: any[] = Array.isArray(existing.notifications) ? existing.notifications as Record<string, unknown>[] : [];
      existingNotifications.push({
        userId: notification.userId || userId,
        role: notification.role || 'staff',
        notifiedAt: new Date().toISOString(),
        method: notification.method || 'system',
        acknowledged: false,
      });
      updateData.notifications = existingNotifications;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const updated = await db.cssdRecall.update({
      where: { id: String(id) },
      data: updateData,
    });

    return NextResponse.json({ success: true, recall: updated });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'cssd.manage' }
);
