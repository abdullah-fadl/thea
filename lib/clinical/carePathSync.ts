// =============================================================================
// Care Path → Module Sync
// =============================================================================
// When a care path task is completed, sync the result data to the
// corresponding module (IPD Vitals, MAR, I&O, etc.)

import { Prisma, PrismaClient } from '@prisma/client';
import { logger } from '@/lib/monitoring/logger';

interface SyncContext {
  tenantId: string;
  taskId: string;
  carePathId: string;
  category: string;
  status: string;
  resultData: Record<string, unknown> | null;
  completedByUserId: string | null;
  completedByName: string | null;
  sourceOrderId: string | null;
  sourcePrescriptionId: string | null;
}

export async function syncTaskToModules(prisma: PrismaClient, ctx: SyncContext): Promise<void> {
  if (ctx.status !== 'DONE' || !ctx.resultData) return;

  const carePath = await prisma.dailyCarePath.findUnique({
    where: { id: ctx.carePathId },
    select: { episodeId: true, encounterCoreId: true, patientMasterId: true, departmentType: true },
  });

  if (!carePath) return;

  try {
    switch (ctx.category) {
      case 'VITALS':
        await syncVitals(prisma, ctx, carePath);
        break;
      case 'MEDICATION':
        await syncMAR(prisma, ctx, carePath);
        break;
      case 'IO':
        // I/O sync would write to a dedicated I/O tracking table if one exists
        break;
    }
  } catch (e) {
    logger.error('[CarePathSync] Failed to sync task', { category: 'clinical', error: e instanceof Error ? e : undefined, tenantId: ctx.tenantId });
  }
}

async function syncVitals(
  prisma: PrismaClient,
  ctx: SyncContext,
  carePath: { episodeId: string | null; encounterCoreId: string | null; patientMasterId: string },
) {
  const rd = ctx.resultData!;
  const vitalsPayload: Record<string, unknown> = {};

  if (rd.systolic || rd.diastolic || rd.hr || rd.rr || rd.temp || rd.spo2) {
    vitalsPayload.systolic = rd.systolic;
    vitalsPayload.diastolic = rd.diastolic;
    vitalsPayload.hr = rd.hr;
    vitalsPayload.rr = rd.rr;
    vitalsPayload.temp = rd.temp;
    vitalsPayload.spo2 = rd.spo2;
  }

  // Write to IPD Vitals if episode exists
  if (carePath.episodeId) {
    await prisma.ipdVitals.create({
      data: {
        tenantId: ctx.tenantId,
        episodeId: carePath.episodeId,
        recordedAt: new Date(),
        recordedByUserId: ctx.completedByUserId,
        vitals: vitalsPayload as Prisma.InputJsonValue,
        painScore: typeof rd.painScore === 'number' ? rd.painScore : undefined,
        critical: isVitalsCritical(rd),
      },
    });
  }
}

async function syncMAR(
  prisma: PrismaClient,
  ctx: SyncContext,
  carePath: { episodeId: string | null; encounterCoreId: string | null; patientMasterId: string },
) {
  if (!carePath.episodeId || !ctx.sourceOrderId) return;

  // Write to IPD MAR events
  await prisma.ipdMarEvent.create({
    data: {
      tenantId: ctx.tenantId,
      episodeId: carePath.episodeId,
      orderId: ctx.sourceOrderId,
      scheduledFor: new Date(),
      performedAt: new Date(),
      status: 'GIVEN',
      dose: ctx.resultData?.dose as string | undefined,
      route: ctx.resultData?.route as string | undefined,
      note: ctx.resultData?.notes as string | undefined,
      performedByUserId: ctx.completedByUserId,
    },
  });
}

function isVitalsCritical(rd: Record<string, unknown>): boolean {
  const sys = Number(rd.systolic);
  const dia = Number(rd.diastolic);
  const hr = Number(rd.hr);
  const rr = Number(rd.rr);
  const temp = Number(rd.temp);
  const spo2 = Number(rd.spo2);

  if (sys && (sys > 180 || sys < 90)) return true;
  if (dia && (dia > 110 || dia < 50)) return true;
  if (hr && (hr > 130 || hr < 40)) return true;
  if (rr && (rr > 30 || rr < 8)) return true;
  if (temp && (temp > 39.5 || temp < 35)) return true;
  if (spo2 && spo2 < 90) return true;

  return false;
}
