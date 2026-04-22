/**
 * Shared SLA runner function for Patient Experience cases
 *
 * Scans open PxCase records, checks if overdue (past dueAt),
 * escalates by incrementing escalationLevel.
 * Uses PxCase model from prisma/schema/misc.prisma.
 */

import { prisma, prismaModel } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';

export interface RunPxSlaResult {
  scanned: number;
  escalated: number;
  skipped: number;
  errors?: string[];
}

/**
 * Run SLA check and escalate overdue PX cases.
 */
export async function runPxSla(_actorUserId?: string): Promise<RunPxSlaResult> {
  const result: RunPxSlaResult = { scanned: 0, escalated: 0, skipped: 0, errors: [] };

  try {
    const now = new Date();
    const cases = await prismaModel('pxCase').findMany({
      where: { active: true, status: { in: ['OPEN', 'IN_PROGRESS'] } },
      orderBy: { createdAt: 'asc' },
      take: 1000,
    });

    result.scanned = cases?.length || 0;
    if (!cases || cases.length === 0) return result;

    for (const pxCase of cases as any[]) {
      try {
        if (!pxCase.dueAt) { result.skipped++; continue; }
        if (now <= new Date(pxCase.dueAt)) { result.skipped++; continue; }

        const newLevel = (pxCase.escalationLevel || 0) + 1;
        const newStatus = newLevel >= 3 ? 'ESCALATED' : pxCase.status;

        await prismaModel('pxCase').update({
          where: { id: pxCase.id },
          data: { escalationLevel: newLevel, status: newStatus },
        });
        result.escalated++;
      } catch (caseErr) {
        result.errors!.push(`Case ${pxCase.id}: ${caseErr instanceof Error ? caseErr.message : String(caseErr)}`);
        logger.error('PX SLA escalation failed', { category: 'general', caseId: pxCase.id, error: caseErr });
      }
    }
    return result;
  } catch (error) {
    logger.error('runPxSla failed', { category: 'general', error });
    return result;
  }
}
