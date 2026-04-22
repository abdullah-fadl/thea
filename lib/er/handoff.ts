import { prisma } from '@/lib/db/prisma';

export const ER_HANDOFF_CLOSED_ERROR = 'ER encounter closed after admission handoff';

export async function getAdmissionHandoffByEncounterId(args: {
  _db?: any;
  db?: any;
  tenantId: string;
  encounterId: string;
}) {
  return await prisma.erAdmissionHandover.findFirst({
    where: {
      tenantId: args.tenantId,
      erEncounterId: args.encounterId,
    },
    select: {
      id: true,
      erEncounterId: true,
      createdAt: true,
    },
  });
}

export async function assertEncounterNotClosedByHandoff(args: {
  _db?: any;
  db?: any;
  tenantId: string;
  encounterId: string;
}) {
  const existing = await getAdmissionHandoffByEncounterId(args);
  if (existing) {
    const err: any = new Error(ER_HANDOFF_CLOSED_ERROR);
    err.code = 'ER_HANDOFF_CLOSED';
    err.handoffId = existing.id;
    throw err;
  }
}
