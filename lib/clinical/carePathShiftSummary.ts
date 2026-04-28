// =============================================================================
// Care Path Shift Summary Generator
// =============================================================================
// Generates an automatic summary at the end of a shift and creates
// a handover entry for the incoming nurse.

import { PrismaClient, Prisma } from '@prisma/client';
type InputJsonValue = Prisma.InputJsonValue;
import type { ShiftSummary } from './carePath';

interface GenerateSummaryInput {
  tenantId: string;
  carePathId: string;
  shiftId: string;
  nurseUserId?: string;
}

export async function generateShiftSummary(
  prisma: PrismaClient,
  input: GenerateSummaryInput
): Promise<ShiftSummary> {
  const { tenantId, carePathId, shiftId, nurseUserId } = input;

  const shift = await prisma.carePathShift.findUnique({
    where: { id: shiftId },
    include: {
      tasks: {
        orderBy: { scheduledTime: 'asc' },
      },
    },
  });

  if (!shift) throw new Error('Shift not found');

  const tasks = shift.tasks;
  const total = tasks.length;
  const done = tasks.filter(t => t.status === 'DONE').length;
  const missed = tasks.filter(t => ['MISSED', 'REFUSED'].includes(t.status)).length;
  const held = tasks.filter(t => t.status === 'HELD').length;
  const pending = tasks.filter(t => t.status === 'PENDING').length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  // Build highlights
  const highlights: string[] = [];
  const highlightsAr: string[] = [];

  // STAT tasks completed
  const statDone = tasks.filter(t => t.priority === 'STAT' && t.status === 'DONE').length;
  if (statDone > 0) {
    highlights.push(`${statDone} STAT task(s) completed`);
    highlightsAr.push(`تم إكمال ${statDone} مهام عاجلة`);
  }

  // Missed tasks
  if (missed > 0) {
    const missedList = tasks.filter(t => ['MISSED', 'REFUSED'].includes(t.status));
    for (const m of missedList) {
      highlights.push(`Missed: ${m.title} (${m.missedReason ?? 'no reason'})`);
      highlightsAr.push(`فائت: ${m.titleAr || m.title} (${m.missedReasonText || m.missedReason || ''})`);
    }
  }

  // Held tasks
  if (held > 0) {
    const heldList = tasks.filter(t => t.status === 'HELD');
    for (const h of heldList) {
      highlights.push(`Held: ${h.title} (${h.missedReason ?? ''})`);
      highlightsAr.push(`معلّق: ${h.titleAr || h.title}`);
    }
  }

  // Pending carry-forward
  const pendingCarryForward = tasks
    .filter(t => ['PENDING', 'HELD'].includes(t.status))
    .map(t => `${t.title} (${new Date(t.scheduledTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })})`);

  const summary: ShiftSummary = {
    completionPct: pct,
    totalTasks: total,
    completedTasks: done,
    missedTasks: missed,
    heldTasks: held,
    highlights,
    highlightsAr,
    pendingCarryForward,
  };

  // Update the shift with the summary
  await prisma.carePathShift.update({
    where: { id: shiftId },
    data: {
      status: 'COMPLETED',
      summary: summary as unknown as InputJsonValue,
      completedTasks: done,
      missedTasks: missed,
      heldTasks: held,
    },
  });

  // Create a Clinical Handover entry
  const carePath = await prisma.dailyCarePath.findUnique({
    where: { id: carePathId },
    select: { encounterCoreId: true, episodeId: true, patientMasterId: true },
  });

  if (carePath) {
    const handoverSummary = [
      `Shift Completion: ${pct}%`,
      `Done: ${done}/${total}`,
      missed > 0 ? `Missed: ${missed}` : null,
      held > 0 ? `Held: ${held}` : null,
      pendingCarryForward.length > 0 ? `Pending: ${pendingCarryForward.join(', ')}` : null,
    ].filter(Boolean).join(' | ');

    await prisma.clinicalHandover.create({
      data: {
        tenantId,
        encounterCoreId: carePath.encounterCoreId,
        episodeId: carePath.episodeId,
        fromRole: 'NURSE',
        fromUserId: nurseUserId,
        summary: handoverSummary,
        risks: missed > 0 ? { missedTasks: missed, items: highlights } : undefined,
        pendingTasks: pendingCarryForward.length > 0 ? pendingCarryForward : undefined,
        activeOrders: null,
        status: 'OPEN',
      },
    });
  }

  return summary;
}

// API-callable: Sign off and complete shift
export async function signOffShift(
  prisma: PrismaClient,
  tenantId: string,
  carePathId: string,
  shiftId: string,
  nurseUserId: string,
  signatureData?: string,
): Promise<ShiftSummary> {
  const summary = await generateShiftSummary(prisma, {
    tenantId,
    carePathId,
    shiftId,
    nurseUserId,
  });

  await prisma.carePathShift.update({
    where: { id: shiftId },
    data: {
      status: 'SIGNED',
      signedAt: new Date(),
      signedByUserId: nurseUserId,
      signatureData,
    },
  });

  // Check if both shifts are signed → mark path as completed
  const allShifts = await prisma.carePathShift.findMany({
    where: { carePathId },
  });

  const allSigned = allShifts.every(s => s.status === 'SIGNED' || s.status === 'COMPLETED');
  if (allSigned) {
    await prisma.dailyCarePath.update({
      where: { id: carePathId },
      data: { status: 'COMPLETED' },
    });
  }

  return summary;
}
