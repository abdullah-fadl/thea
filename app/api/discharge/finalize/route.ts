import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { createAuditLog } from '@/lib/utils/audit';
import { validateBody } from '@/lib/validation/helpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DISPOSITIONS = ['HOME', 'AMA', 'LAMA', 'TRANSFER_OUT', 'DEATH_PENDING'] as const;

export const GET = withAuthTenant(async (req: NextRequest, { tenantId }) => {
  const { searchParams } = new URL(req.url);
  const encounterCoreId = String(searchParams.get('encounterCoreId') || '').trim();
  if (!encounterCoreId) {
    return NextResponse.json({ error: 'encounterCoreId is required' }, { status: 400 });
  }

  const records = await prisma.dischargeSummary.findMany({
    where: { tenantId, encounterCoreId },
    orderBy: { createdAt: 'desc' },
    take: 1,
  });

  return NextResponse.json({ discharge: records[0] || null });
}, { tenantScoped: true, platformKey: 'thea_health', permissionKeys: ['ipd.live-beds.edit', 'opd.visit.view', 'er.encounters.view'] });

export const POST = withAuthTenant(async (req: NextRequest, { tenantId, userId, user }) => {
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const bodySchema = z.object({
    encounterCoreId: z.string().min(1),
    disposition: z.string().min(1),
    summaryText: z.string().min(1),
  }).passthrough();
  const v = validateBody(body, bodySchema);
  if ('error' in v) return v.error;

  const encounterCoreId = String(body?.encounterCoreId || '').trim();
  const disposition = String(body?.disposition || '').trim().toUpperCase();
  const summaryText = String(body?.summaryText || '').trim();

  const missing: string[] = [];
  const invalid: string[] = [];

  if (!encounterCoreId) missing.push('encounterCoreId');
  if (!disposition) missing.push('disposition');
  if (!summaryText) missing.push('summaryText');
  if (disposition && !(DISPOSITIONS as readonly string[]).includes(disposition)) invalid.push('disposition');

  if (missing.length || invalid.length) {
    return NextResponse.json({ error: 'Validation failed', missing, invalid }, { status: 400 });
  }

  const encounter = await prisma.encounterCore.findFirst({
    where: { tenantId, id: encounterCoreId },
  });
  if (!encounter) {
    return NextResponse.json({ error: 'Encounter not found' }, { status: 404 });
  }

  const sourceSystem = String(encounter.encounterType || '').toUpperCase();

  const handoverReady = async () => {
    const handover = await prisma.clinicalHandover.findFirst({
      where: { tenantId, encounterCoreId, status: 'FINALIZED' },
    });
    return Boolean(handover);
  };

  if (sourceSystem === 'OPD') {
    const opd = await prisma.opdEncounter.findFirst({
      where: { tenantId, encounterCoreId },
    });
    const opdStatus = String(opd?.status || 'OPEN').toUpperCase();
    const arrivalState = String(opd?.arrivalState || 'NOT_ARRIVED').toUpperCase();
    if (opdStatus !== 'COMPLETED' && arrivalState !== 'LEFT') {
      return NextResponse.json(
        { error: 'OPD encounter must be COMPLETED or LEFT before discharge' },
        { status: 409 }
      );
    }
  } else if (sourceSystem === 'ER') {
    const erEncounter = await prisma.erEncounter.findFirst({
      where: { tenantId, id: encounterCoreId },
    });
    const erStatus = String(erEncounter?.status || '').toUpperCase();
    if (erStatus !== 'DISCHARGED') {
      return NextResponse.json(
        { error: 'ER encounter must be DISCHARGED before discharge finalize' },
        { status: 409 }
      );
    }
  } else if (sourceSystem === 'IPD') {
    const hasHandover = await handoverReady();
    if (!hasHandover) {
      return NextResponse.json({ error: 'Handover required before discharge', code: 'HANDOVER_REQUIRED' }, { status: 409 });
    }
    const episode = await prisma.ipdEpisode.findFirst({
      where: { tenantId, encounterId: encounterCoreId },
    });
    const episodeStatus = String(episode?.status || '').toUpperCase();
    if (episodeStatus !== 'DISCHARGE_READY') {
      return NextResponse.json(
        { error: 'IPD episode must be DISCHARGE_READY before discharge finalize' },
        { status: 409 }
      );
    }
  } else {
    return NextResponse.json({ error: 'Unsupported encounter type' }, { status: 409 });
  }

  // [D-00] Guard: check for active (non-terminal) orders before discharge
  const TERMINAL_ORDER_STATUSES = ['COMPLETED', 'CANCELLED', 'DISCONTINUED'];
  const activeOrders = await prisma.ordersHub.findMany({
    where: {
      tenantId,
      encounterCoreId,
      status: { notIn: TERMINAL_ORDER_STATUSES },
    },
    select: { id: true, kind: true, orderName: true, status: true },
    take: 20,
  });
  if (activeOrders.length > 0 && !body.acknowledgeActiveOrders) {
    return NextResponse.json(
      {
        error: `Cannot discharge: ${activeOrders.length} active order(s) remain. Complete, cancel, or discontinue them first.`,
        code: 'ACTIVE_ORDERS',
        activeOrders,
      },
      { status: 400 }
    );
  }

  // [D-01] Guard: check for unpaid/pending billing before discharge
  const pendingCharges = await prisma.billingChargeEvent.count({
    where: { tenantId, encounterCoreId, status: 'ACTIVE', payerType: 'PENDING' },
  });
  if (pendingCharges > 0 && !body.acknowledgePendingBilling) {
    return NextResponse.json(
      {
        error: `${pendingCharges} charge(s) with PENDING payer type. Please resolve billing before discharge.`,
        code: 'PENDING_BILLING',
        pendingCharges,
      },
      { status: 422 }
    );
  }

  // [D-02] Guard: prevent duplicate discharge summaries (idempotency)
  const existing = await prisma.dischargeSummary.findFirst({
    where: { tenantId, encounterCoreId, disposition },
  });

  const closeEncounter = async () => {
    if (encounter.status === 'CLOSED') {
      return;
    }
    const now = new Date();
    const patch = {
      status: 'CLOSED' as const,
      closedAt: now,
      closedByUserId: userId,
    };
    await prisma.encounterCore.updateMany({
      where: { tenantId, id: encounterCoreId },
      data: patch,
    });
    await createAuditLog(
      'encounter_core',
      encounterCoreId,
      'CLOSE',
      userId || 'system',
      user?.email,
      { before: encounter, after: { ...encounter, ...patch } },
      tenantId
    );
  };

  if (existing) {
    await closeEncounter();
    if (sourceSystem === 'IPD') {
      await prisma.ipdEpisode.updateMany({
        where: { tenantId, encounterId: encounterCoreId },
        data: { status: 'DISCHARGED', closedAt: new Date(), updatedAt: new Date(), updatedByUserId: userId || null },
      });
      await prisma.ipdAdmission.updateMany({
        where: { tenantId, encounterId: encounterCoreId, releasedAt: null, isActive: true },
        data: { releasedAt: new Date(), releasedByUserId: userId || null, isActive: false },
      });
    }
    return NextResponse.json({ success: true, noOp: true, discharge: existing });
  }

  const now = new Date();
  const discharge = {
    tenantId,
    encounterCoreId,
    sourceSystem,
    disposition,
    summaryText,
    createdAt: now,
    createdByUserId: userId || null,
  };

  const created = await prisma.dischargeSummary.create({ data: discharge });
  await createAuditLog(
    'discharge_summary',
    created.id,
    'CREATE',
    userId || 'system',
    user?.email,
    { after: created },
    tenantId
  );

  await closeEncounter();

  if (sourceSystem === 'IPD') {
    const now = new Date();
    await prisma.ipdEpisode.updateMany({
      where: { tenantId, encounterId: encounterCoreId },
      data: { status: 'DISCHARGED', closedAt: now, updatedAt: now, updatedByUserId: userId || null },
    });
    await prisma.ipdAdmission.updateMany({
      where: { tenantId, encounterId: encounterCoreId, releasedAt: null, isActive: true },
      data: { releasedAt: now, releasedByUserId: userId || null, isActive: false },
    });
  }

  return NextResponse.json({ success: true, discharge: created });
}, { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'ipd.live-beds.edit' });
