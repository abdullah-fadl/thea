import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';
import { createAuditLog } from '@/lib/utils/audit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET /api/or/cases/[caseId]/time-out
// Returns existing time-out record for the case, or null if not yet recorded
export const GET = withAuthTenant(
  async (req: NextRequest, { tenantId, userId }, params) => {
    try {
      const caseId = String((params as Record<string, string>)?.caseId || '').trim();
      if (!caseId) {
        return NextResponse.json({ error: 'caseId is required' }, { status: 400 });
      }

      const record = await prisma.orTimeOut.findFirst({
        where: { tenantId, caseId },
      });

      return NextResponse.json({ timeOut: record ?? null });
    } catch (e: any) {
      logger.error('[OR time-out GET] Failed to fetch time-out record', { category: 'api', error: e instanceof Error ? e : undefined });
      return NextResponse.json({ error: 'Failed to fetch time-out record' }, { status: 500 });
    }
  },
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'or.view' },
);

// POST /api/or/cases/[caseId]/time-out
// Creates or updates (upsert) the WHO surgical safety checklist for the case
export const POST = withAuthTenant(
  async (req: NextRequest, { tenantId, userId, user }, params) => {
    try {
      const caseId = String((params as Record<string, string>)?.caseId || '').trim();
      if (!caseId) {
        return NextResponse.json({ error: 'caseId is required' }, { status: 400 });
      }

      const body = await req.json();
      const {
        performedAt,
        patientIdConfirmed = false,
        procedureConfirmed = false,
        siteConfirmed = false,
        consentConfirmed = false,
        antibioticGiven = false,
        imagingAvailable = false,
        equipmentReady = false,
        teamIntroduced = false,
        criticalConcerns,
      } = body;

      if (!performedAt) {
        return NextResponse.json({ error: 'performedAt is required' }, { status: 400 });
      }

      // Verify case belongs to this tenant
      const orCase = await prisma.orCase.findFirst({
        where: { tenantId, id: caseId },
      });
      if (!orCase) {
        return NextResponse.json({ error: 'Case not found' }, { status: 404 });
      }

      // Check if existing record for audit action tracking
      const existing = await prisma.orTimeOut.findFirst({ where: { tenantId, caseId } });

      // Upsert by caseId — only one time-out record per case
      const record = await prisma.orTimeOut.upsert({
        where: { caseId },
        create: {
          tenantId,
          caseId,
          performedAt: new Date(performedAt),
          performedBy: userId,
          patientIdConfirmed,
          procedureConfirmed,
          siteConfirmed,
          consentConfirmed,
          antibioticGiven,
          imagingAvailable,
          equipmentReady,
          teamIntroduced,
          criticalConcerns: criticalConcerns ?? null,
          signatures: [],
        },
        update: {
          performedAt: new Date(performedAt),
          performedBy: userId,
          patientIdConfirmed,
          procedureConfirmed,
          siteConfirmed,
          consentConfirmed,
          antibioticGiven,
          imagingAvailable,
          equipmentReady,
          teamIntroduced,
          criticalConcerns: criticalConcerns ?? null,
        },
      });

      // Audit log for WHO surgical safety checklist time-out phase
      await createAuditLog(
        'or_time_out',
        record.id,
        existing ? 'UPDATE' : 'CREATE',
        userId || 'system',
        user?.email,
        {
          caseId,
          phase: 'time_out',
          patientIdConfirmed,
          procedureConfirmed,
          siteConfirmed,
          consentConfirmed,
          antibioticGiven,
          equipmentReady,
          teamIntroduced,
        },
        tenantId,
        req,
      );

      return NextResponse.json({ timeOut: record });
    } catch (e: any) {
      logger.error('[OR time-out POST] Failed to save time-out record', { category: 'api', error: e instanceof Error ? e : undefined });
      return NextResponse.json({ error: 'Failed to save time-out record' }, { status: 500 });
    }
  },
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'or.view' },
);
