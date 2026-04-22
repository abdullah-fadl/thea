import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET /api/or/cases/[caseId]/anesthesia
// Returns the anesthesia record for the case (null if not created yet)
export const GET = withAuthTenant(
  async (req: NextRequest, { tenantId }, params) => {
    try {
      const caseId = String((params as Record<string, unknown>)?.caseId || '').trim();
      if (!caseId) {
        return NextResponse.json({ error: 'caseId is required' }, { status: 400 });
      }

      const record = await prisma.orAnesthesiaRecord.findFirst({
        where: { tenantId, caseId },
        orderBy: { createdAt: 'desc' },
      });

      return NextResponse.json({ anesthesia: record ?? null });
    } catch (e: unknown) {
      logger.error('[OR anesthesia GET] Failed to fetch anesthesia record', { category: 'api', error: e instanceof Error ? e : undefined });
      return NextResponse.json({ error: 'Failed to fetch anesthesia record' }, { status: 500 });
    }
  },
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'or.view' },
);

// POST /api/or/cases/[caseId]/anesthesia
// Creates a new anesthesia record for the case
export const POST = withAuthTenant(
  async (req: NextRequest, { tenantId, userId }, params) => {
    try {
      const caseId = String((params as Record<string, unknown>)?.caseId || '').trim();
      if (!caseId) {
        return NextResponse.json({ error: 'caseId is required' }, { status: 400 });
      }

      const body = await req.json();
      const {
        anesthesiologistId,
        anesthesiaType,
        inductionTime,
        emergenceTime,
        airwayManagement,
        agents = [],
        vitalsLog = [],
        fluidBalance,
        complications,
        notes,
      } = body;

      if (!anesthesiaType) {
        return NextResponse.json({ error: 'anesthesiaType is required' }, { status: 400 });
      }

      // Verify case belongs to this tenant
      const orCase = await prisma.orCase.findFirst({
        where: { tenantId, id: caseId },
      });
      if (!orCase) {
        return NextResponse.json({ error: 'Case not found' }, { status: 404 });
      }

      const record = await prisma.orAnesthesiaRecord.create({
        data: {
          tenantId,
          caseId,
          anesthesiologistId: anesthesiologistId || userId,
          anesthesiaType,
          inductionTime: inductionTime ? new Date(inductionTime) : null,
          emergenceTime: emergenceTime ? new Date(emergenceTime) : null,
          airwayManagement: airwayManagement ?? null,
          agents,
          vitalsLog,
          fluidBalance: fluidBalance ?? null,
          complications: complications ?? null,
          notes: notes ?? null,
        },
      });

      return NextResponse.json({ anesthesia: record }, { status: 201 });
    } catch (e: unknown) {
      logger.error('[OR anesthesia POST] Failed to create anesthesia record', { category: 'api', error: e instanceof Error ? e : undefined });
      return NextResponse.json({ error: 'Failed to create anesthesia record' }, { status: 500 });
    }
  },
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'or.view' },
);

// PUT /api/or/cases/[caseId]/anesthesia
// Updates an existing anesthesia record: adds vitals entry, updates settings, sets emergence time, etc.
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
        anesthesiaType,
        inductionTime,
        emergenceTime,
        airwayManagement,
        fluidBalance,
        complications,
        notes,
        // Append operations — these objects get pushed to the JSON arrays
        appendVitals,  // {time, hr, bp, spo2, etco2, temp}
        appendAgent,   // {drug, dose, route, time}
      } = body;

      // Find existing record
      const existing = await prisma.orAnesthesiaRecord.findFirst({
        where: {
          tenantId,
          caseId,
          ...(recordId ? { id: recordId } : {}),
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!existing) {
        return NextResponse.json({ error: 'Anesthesia record not found' }, { status: 404 });
      }

      // Build updated JSON arrays
      const updatedVitalsLog = appendVitals
        ? [...(existing.vitalsLog as Record<string, unknown>[]), { ...appendVitals, time: appendVitals.time || new Date().toISOString() }]
        : (existing.vitalsLog as Record<string, unknown>[]);

      const updatedAgents = appendAgent
        ? [...(existing.agents as Record<string, unknown>[]), { ...appendAgent, time: appendAgent.time || new Date().toISOString() }]
        : (existing.agents as Record<string, unknown>[]);

      const updated = await prisma.orAnesthesiaRecord.update({
        where: { id: existing.id },
        data: {
          ...(anesthesiaType ? { anesthesiaType } : {}),
          ...(inductionTime !== undefined ? { inductionTime: inductionTime ? new Date(inductionTime) : null } : {}),
          ...(emergenceTime !== undefined ? { emergenceTime: emergenceTime ? new Date(emergenceTime) : null } : {}),
          ...(airwayManagement !== undefined ? { airwayManagement } : {}),
          ...(fluidBalance !== undefined ? { fluidBalance } : {}),
          ...(complications !== undefined ? { complications } : {}),
          ...(notes !== undefined ? { notes } : {}),
          vitalsLog: updatedVitalsLog,
          agents: updatedAgents,
        },
      });

      return NextResponse.json({ anesthesia: updated });
    } catch (e: unknown) {
      logger.error('[OR anesthesia PUT] Failed to update anesthesia record', { category: 'api', error: e instanceof Error ? e : undefined });
      return NextResponse.json({ error: 'Failed to update anesthesia record' }, { status: 500 });
    }
  },
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'or.view' },
);
