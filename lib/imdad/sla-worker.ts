/**
 * Imdad SLA Worker
 *
 * Checks all pending workflow requests for SLA breaches,
 * escalates overdue approval steps, and returns a summary.
 */

import { prisma } from '@/lib/db/prisma';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SLAWorkerResult {
  checked: number;
  breached: number;
  escalated: number;
  traceId: string;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Run the SLA check worker for a given tenant.
 * Marks requests as breached if their SLA deadline has passed.
 * Escalates approval steps that have exceeded their individual SLA hours.
 */
export async function runSLAWorker(
  tenantId: string,
  traceId: string,
): Promise<SLAWorkerResult> {
  const now = new Date();

  // 1. Find requests past their overall SLA deadline
  const breachedResult = await prisma.imdadSupplyRequest.updateMany({
    where: {
      tenantId,
      status: { in: ['SUBMITTED', 'IN_APPROVAL'] },
      slaBreached: false,
      slaDeadlineAt: { lte: now },
      isDeleted: false,
    },
    data: { slaBreached: true },
  });

  // 2. Find pending approval steps that have exceeded their SLA hours
  const pendingSteps = await prisma.imdadSupplyRequestApproval.findMany({
    where: {
      tenantId,
      status: 'PENDING',
      pendingSince: { not: null },
      escalatedTo: null,
    },
    take: 500,
  });

  let escalated = 0;
  for (const step of pendingSteps) {
    if (!step.pendingSince) continue;
    const pendingMs = now.getTime() - step.pendingSince.getTime();
    const slaMs = (step.slaHours ?? 24) * 60 * 60 * 1000;

    if (pendingMs > slaMs) {
      // Mark as escalated (the next higher role can now act)
      await prisma.imdadSupplyRequestApproval.update({
        where: { id: step.id },
        data: { escalatedTo: 'GENERAL_DIRECTOR', escalatedAt: now } as any,
      });
      escalated++;
    }
  }

  console.log(
    `[IMDAD_SLA] traceId=${traceId} tenant=${tenantId} checked=${pendingSteps.length} breached=${breachedResult.count} escalated=${escalated}`,
  );

  return {
    checked: pendingSteps.length,
    breached: breachedResult.count,
    escalated,
    traceId,
  };
}
