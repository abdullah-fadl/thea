import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
export const dynamic = 'force-dynamic';
export const POST = withAuthTenant(
  async (req: NextRequest, { tenantId, userId }: { tenantId: string; userId: string }) => {
    try {
      const { studyId, patientId, modality } = await req.json();
      // Find prior studies for same patient and modality
      const priors = await (prisma as any).radiologyReport?.findMany?.({
        where: { tenantId, patientId, modality, id: { not: studyId } },
        orderBy: { createdAt: 'desc' }, take: 5,
      }) || [];
      const created = [];
      for (const prior of priors) {
        const exists = await (prisma as any).radiologyPriorStudy.findFirst({
          where: { tenantId, currentStudyId: studyId, priorStudyId: prior.id },
        });
        if (!exists) {
          const link = await (prisma as any).radiologyPriorStudy.create({
            data: { tenantId, currentStudyId: studyId, priorStudyId: prior.id, patientId, modality, priorStudyDate: prior.createdAt, autoLinked: true, linkedByUserId: userId },
          });
          created.push(link);
        }
      }
      return NextResponse.json({ linked: created.length, items: created });
    } catch (e) { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
  },
  { permissionKey: 'radiology.peer-review.view' }
);
