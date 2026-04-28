import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/or/cases/today
 * Returns today's OR cases enriched with team, count discrepancy status, specimen count.
 */
export const GET = withAuthTenant(
  async (req: NextRequest, { tenantId }) => {
    try {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfDay = new Date(startOfDay.getTime() + 86400000);

      // Fetch today's scheduled cases + any currently in-progress
      const cases = await prisma.orCase.findMany({
        where: {
          tenantId,
          OR: [
            { scheduledDate: { gte: startOfDay, lt: endOfDay } },
            { status: 'IN_PROGRESS' },
          ],
        },
        orderBy: [{ scheduledStartTime: 'asc' }, { createdAt: 'asc' }],
        take: 200,
      });

      // Enrich in parallel
      const enriched = await Promise.all(
        cases.map(async (c) => {
          const [team, events, counts, specimens, nursingPreOp, anesthesiaPreOp, patient] = await Promise.all([
            prisma.orSurgicalTeam.findFirst({ where: { tenantId, caseId: c.id } }).catch(() => null),
            prisma.orCaseEvent.findMany({ where: { tenantId, caseId: c.id }, orderBy: { createdAt: 'desc' }, take: 1 }).catch(() => []),
            prisma.orSurgicalCount.findMany({ where: { tenantId, caseId: c.id } }).catch(() => []),
            prisma.orSpecimenLog.count({ where: { tenantId, caseId: c.id } }).catch(() => 0),
            prisma.orNursingPreOp.findFirst({ where: { tenantId, caseId: c.id }, select: { status: true } }).catch(() => null),
            prisma.orAnesthesiaPreOp.findFirst({ where: { tenantId, caseId: c.id }, select: { status: true } }).catch(() => null),
            c.patientMasterId
              ? prisma.patientMaster.findFirst({ where: { id: c.patientMasterId, tenantId }, select: { fullName: true, mrn: true } }).catch(() => null)
              : null,
          ]);

          const lastEvent = Array.isArray(events) && events.length > 0 ? events[0] : null;
          const countList = Array.isArray(counts) ? counts : [];
          const hasUnresolvedDiscrepancy = countList.some((ct: any) => ct.isDiscrepancy && !ct.discrepancyResolved);
          const preOpDone = countList.some((ct: any) => ct.phase === 'PRE_OP');
          const postOpDone = countList.some((ct: any) => ct.phase === 'POST_OP');

          return {
            id: c.id,
            patientMasterId: c.patientMasterId,
            patientName: patient?.fullName || null,
            mrn: patient?.mrn || null,
            procedureName: c.procedureName,
            procedureCode: c.procedureCode,
            status: c.status,
            scheduledDate: c.scheduledDate,
            scheduledStartTime: c.scheduledStartTime,
            scheduledEndTime: c.scheduledEndTime,
            roomName: c.roomName,
            priority: c.priority,
            caseType: c.caseType,
            surgeonName: c.surgeonName,
            anesthesiologistName: c.anesthesiologistName,
            asaClass: c.asaClass,
            currentStep: lastEvent?.step || 'START',
            circulatingNurse: team?.circulatingNurse || null,
            scrubNurse: team?.scrubNurse || null,
            countStatus: {
              preOpDone,
              postOpDone,
              hasUnresolvedDiscrepancy,
              totalCounts: countList.length,
            },
            specimenCount: typeof specimens === 'number' ? specimens : 0,
            nursingPreOpStatus: nursingPreOp?.status || null,
            anesthesiaPreOpStatus: anesthesiaPreOp?.status || null,
          };
        })
      );

      // Summary
      const summary = {
        total: enriched.length,
        inProgress: enriched.filter((c) => c.status === 'IN_PROGRESS').length,
        completed: enriched.filter((c) => c.status === 'COMPLETED').length,
        pending: enriched.filter((c) => c.status === 'OPEN').length,
        discrepancies: enriched.filter((c) => c.countStatus.hasUnresolvedDiscrepancy).length,
      };

      return NextResponse.json({ items: enriched, summary });
    } catch (e: unknown) {
      logger.error('[OR today GET] Failed', { category: 'api', error: e instanceof Error ? e : undefined });
      return NextResponse.json({ error: 'Failed to fetch today cases' }, { status: 500 });
    }
  },
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'or.nursing.view' },
);
