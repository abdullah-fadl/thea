import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ---------------------------------------------------------------------------
// Valid status transitions for the unit-dose workflow
// ---------------------------------------------------------------------------
const VALID_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['PREPARED'],
  PREPARED: ['VERIFIED', 'RETURNED', 'WASTED'],
  VERIFIED: ['DISPENSED', 'RETURNED', 'WASTED'],
  DISPENSED: ['ADMINISTERED', 'RETURNED', 'WASTED'],
  ADMINISTERED: [], // terminal
  RETURNED: [],
  WASTED: [],
};

// ---------------------------------------------------------------------------
// GET  /api/pharmacy/unit-dose
// ---------------------------------------------------------------------------
export const GET = withAuthTenant(
  async (req: NextRequest, { tenantId }) => {
    try {
      const url = new URL(req.url);
      const status = url.searchParams.get('status');
      const patientId = url.searchParams.get('patientId');
      const ward = url.searchParams.get('ward');
      const search = url.searchParams.get('search');
      const from = url.searchParams.get('from');
      const to = url.searchParams.get('to');

      const where: any = { tenantId };
      if (status && status !== 'ALL') where.status = status;
      if (patientId) where.patientId = patientId;
      if (ward) where.wardUnit = ward;
      if (search) {
        where.OR = [
          { patientName: { contains: search, mode: 'insensitive' } },
          { mrn: { contains: search, mode: 'insensitive' } },
          { medication: { contains: search, mode: 'insensitive' } },
          { genericName: { contains: search, mode: 'insensitive' } },
        ];
      }
      if (from || to) {
        const timeRange: Record<string, Date> = {};
        if (from) timeRange.gte = new Date(from);
        if (to) timeRange.lte = new Date(to);
        where.scheduledTime = timeRange;
      }

      const doses = await prisma.pharmacyUnitDose.findMany({
        where,
        orderBy: { scheduledTime: 'asc' },
        take: 200,
      });

      // Compute summary counts (unfiltered by status for KPI cards)
      const allWhere: any = { tenantId };
      if (patientId) allWhere.patientId = patientId;
      if (ward) allWhere.wardUnit = ward;

      const allDoses = await prisma.pharmacyUnitDose.findMany({
        where: allWhere,
        select: { status: true, scheduledTime: true },
        take: 200,
      });

      const now = new Date();
      const summary = {
        total: allDoses.length,
        pending: 0,
        prepared: 0,
        verified: 0,
        dispensed: 0,
        administered: 0,
        returned: 0,
        wasted: 0,
        overdue: 0,
      };

      for (const d of allDoses) {
        const s = (d.status || '').toLowerCase();
        if (s in summary) (summary as Record<string, number>)[s]++;
        if (
          d.scheduledTime &&
          new Date(d.scheduledTime) < now &&
          !['ADMINISTERED', 'RETURNED', 'WASTED'].includes(d.status)
        ) {
          summary.overdue++;
        }
      }

      return NextResponse.json({ doses, summary });
    } catch (e: unknown) {
      logger.error('[Pharmacy unit-dose GET]', {
        category: 'api',
        error: e instanceof Error ? e : undefined,
      });
      return NextResponse.json({ error: 'Failed to fetch unit doses' }, { status: 500 });
    }
  },
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'pharmacy.view' },
);

// ---------------------------------------------------------------------------
// POST  /api/pharmacy/unit-dose
// Actions: create | prepare | verify | dispense | administer | return | waste
// ---------------------------------------------------------------------------
export const POST = withAuthTenant(
  async (req: NextRequest, { tenantId, userId, user }) => {
    try {
      const body = await req.json();
      const action: string = body.action || 'create';
      const userName = user?.displayName || user?.email || null;
      const now = new Date();

      // ── Create a new unit-dose record ────────────────────────────────────
      if (action === 'create') {
        const record = await prisma.pharmacyUnitDose.create({
          data: {
            tenantId,
            prescriptionId: body.prescriptionId ?? null,
            episodeId: body.episodeId ?? null,
            patientId: body.patientId ?? null,
            patientName: body.patientName ?? null,
            mrn: body.mrn ?? null,
            wardUnit: body.wardUnit ?? null,
            bedLabel: body.bedLabel ?? null,
            medication: body.medication,
            genericName: body.genericName ?? null,
            strength: body.strength ?? null,
            form: body.form ?? null,
            route: body.route ?? 'ORAL',
            dose: body.dose ?? null,
            frequency: body.frequency ?? null,
            scheduledTime: body.scheduledTime ? new Date(body.scheduledTime) : new Date(),
            preparedByUserId: userId,
            preparedByName: userName,
            preparedAt: now,
            status: 'PREPARED',
            notes: body.notes ?? null,
          },
        });
        return NextResponse.json({ unitDose: record }, { status: 201 });
      }

      // ── Transition an existing record ────────────────────────────────────
      const id = body.id || body.unitDoseId;
      if (!id) {
        return NextResponse.json({ error: 'id is required for status transitions' }, { status: 400 });
      }

      const existing = await prisma.pharmacyUnitDose.findFirst({
        where: { tenantId, id },
      });
      if (!existing) {
        return NextResponse.json({ error: 'Unit dose record not found' }, { status: 404 });
      }

      const actionToStatus: Record<string, string> = {
        prepare: 'PREPARED',
        verify: 'VERIFIED',
        dispense: 'DISPENSED',
        administer: 'ADMINISTERED',
        return: 'RETURNED',
        waste: 'WASTED',
      };

      const targetStatus = actionToStatus[action];
      if (!targetStatus) {
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
      }

      const allowed = VALID_TRANSITIONS[existing.status] || [];
      if (!allowed.includes(targetStatus)) {
        return NextResponse.json(
          {
            error: `Cannot transition from ${existing.status} to ${targetStatus}`,
            currentStatus: existing.status,
            allowedTransitions: allowed,
          },
          { status: 400 },
        );
      }

      const update: any = { status: targetStatus };

      switch (action) {
        case 'prepare':
          update.preparedByUserId = userId;
          update.preparedByName = userName;
          update.preparedAt = now;
          break;
        case 'verify':
          update.verifiedByUserId = userId;
          update.verifiedByName = userName;
          update.verifiedAt = now;
          break;
        case 'dispense':
          update.dispensedByUserId = userId;
          update.dispensedByName = userName;
          update.dispensedAt = now;
          break;
        case 'administer':
          update.administeredByUserId = userId;
          update.administeredByName = userName;
          update.administeredAt = now;
          if (body.administrationNotes) update.administrationNotes = body.administrationNotes;
          break;
        case 'return':
          update.returnReason = body.returnReason || body.reason || null;
          break;
        case 'waste':
          update.wasteReason = body.wasteReason || body.reason || null;
          update.wasteWitnessUserId = body.wasteWitnessUserId ?? null;
          update.wasteWitnessName = body.wasteWitnessName ?? null;
          break;
      }

      if (body.notes) update.notes = body.notes;

      const updated = await prisma.pharmacyUnitDose.update({
        where: { id },
        data: update,
      });

      logger.info(`Unit-dose ${action}`, {
        category: 'api',
        tenantId,
        userId,
        route: '/api/pharmacy/unit-dose',
        unitDoseId: id,
        fromStatus: existing.status,
        toStatus: targetStatus,
      });

      return NextResponse.json({ unitDose: updated });
    } catch (e: unknown) {
      logger.error('[Pharmacy unit-dose POST]', {
        category: 'api',
        error: e instanceof Error ? e : undefined,
      });
      return NextResponse.json({ error: 'Failed to process unit dose action' }, { status: 500 });
    }
  },
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'pharmacy.dispense' },
);
