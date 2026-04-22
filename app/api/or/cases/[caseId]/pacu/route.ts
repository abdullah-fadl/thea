import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET /api/or/cases/[caseId]/pacu
// Returns the PACU record for the case (null if not created yet)
export const GET = withAuthTenant(
  async (req: NextRequest, { tenantId }, params) => {
    try {
      const caseId = String((params as Record<string, unknown>)?.caseId || '').trim();
      if (!caseId) {
        return NextResponse.json({ error: 'caseId is required' }, { status: 400 });
      }

      const record = await prisma.orPacuRecord.findFirst({
        where: { tenantId, caseId },
        orderBy: { createdAt: 'desc' },
      });

      return NextResponse.json({ pacu: record ?? null });
    } catch (e: unknown) {
      logger.error('[OR PACU GET] Failed to fetch PACU record', { category: 'api', error: e instanceof Error ? e : undefined });
      return NextResponse.json({ error: 'Failed to fetch PACU record' }, { status: 500 });
    }
  },
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'or.view' },
);

// POST /api/or/cases/[caseId]/pacu
// Creates a new PACU record when patient arrives in recovery
export const POST = withAuthTenant(
  async (req: NextRequest, { tenantId, userId }, params) => {
    try {
      const caseId = String((params as Record<string, unknown>)?.caseId || '').trim();
      if (!caseId) {
        return NextResponse.json({ error: 'caseId is required' }, { status: 400 });
      }

      const body = await req.json();
      const {
        nurseId,
        arrivalTime,
        aldreteScores = [],
        vitalsLog = [],
        painMgmt,
        nausea = false,
        shivering = false,
        bleeding,
        disposition,
        notes,
      } = body;

      if (!arrivalTime) {
        return NextResponse.json({ error: 'arrivalTime is required' }, { status: 400 });
      }

      // Verify case belongs to this tenant
      const orCase = await prisma.orCase.findFirst({
        where: { tenantId, id: caseId },
      });
      if (!orCase) {
        return NextResponse.json({ error: 'Case not found' }, { status: 404 });
      }

      const record = await prisma.orPacuRecord.create({
        data: {
          tenantId,
          caseId,
          nurseId: nurseId || userId,
          arrivalTime: new Date(arrivalTime),
          dischargeTime: null,
          aldreteScores,
          vitalsLog,
          painMgmt: painMgmt ?? null,
          nausea,
          shivering,
          bleeding: bleeding ?? null,
          disposition: disposition ?? null,
          notes: notes ?? null,
        },
      });

      return NextResponse.json({ pacu: record }, { status: 201 });
    } catch (e: unknown) {
      logger.error('[OR PACU POST] Failed to create PACU record', { category: 'api', error: e instanceof Error ? e : undefined });
      return NextResponse.json({ error: 'Failed to create PACU record' }, { status: 500 });
    }
  },
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'or.view' },
);

// PUT /api/or/cases/[caseId]/pacu
// Updates the PACU record: adds vitals, sets discharge time, updates Aldrete scores, etc.
export const PUT = withAuthTenant(
  async (req: NextRequest, { tenantId }, params) => {
    try {
      const caseId = String((params as Record<string, unknown>)?.caseId || '').trim();
      if (!caseId) {
        return NextResponse.json({ error: 'caseId is required' }, { status: 400 });
      }

      const body = await req.json();
      const {
        recordId,
        // Fields that can be updated wholesale
        dischargeTime,
        disposition,
        painMgmt,
        nausea,
        shivering,
        bleeding,
        notes,
        // Append operations
        appendVitals,        // {time, hr, bp, rr, spo2, pain, temp}
        appendAldrete,       // {time, activity, respiration, circulation, consciousness, color, total}
      } = body;

      // Find existing record
      const existing = await prisma.orPacuRecord.findFirst({
        where: {
          tenantId,
          caseId,
          ...(recordId ? { id: recordId } : {}),
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!existing) {
        return NextResponse.json({ error: 'PACU record not found' }, { status: 404 });
      }

      // Build updated JSON arrays
      const updatedVitalsLog = appendVitals
        ? [...(existing.vitalsLog as Record<string, unknown>[]), { ...appendVitals, time: appendVitals.time || new Date().toISOString() }]
        : (existing.vitalsLog as Record<string, unknown>[]);

      const updatedAldreteScores = appendAldrete
        ? [...(existing.aldreteScores as Record<string, unknown>[]), { ...appendAldrete, time: appendAldrete.time || new Date().toISOString() }]
        : (existing.aldreteScores as Record<string, unknown>[]);

      const updated = await prisma.orPacuRecord.update({
        where: { id: existing.id },
        data: {
          ...(dischargeTime !== undefined ? { dischargeTime: dischargeTime ? new Date(dischargeTime) : null } : {}),
          ...(disposition !== undefined ? { disposition } : {}),
          ...(painMgmt !== undefined ? { painMgmt } : {}),
          ...(nausea !== undefined ? { nausea } : {}),
          ...(shivering !== undefined ? { shivering } : {}),
          ...(bleeding !== undefined ? { bleeding } : {}),
          ...(notes !== undefined ? { notes } : {}),
          vitalsLog: updatedVitalsLog,
          aldreteScores: updatedAldreteScores,
        },
      });

      return NextResponse.json({ pacu: updated });
    } catch (e: unknown) {
      logger.error('[OR PACU PUT] Failed to update PACU record', { category: 'api', error: e instanceof Error ? e : undefined });
      return NextResponse.json({ error: 'Failed to update PACU record' }, { status: 500 });
    }
  },
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'or.view' },
);
