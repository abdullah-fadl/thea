import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/obgyn/labor/worklist
 * Returns all patients currently admitted in active labor.
 * Data model: ObgynForm with type='labor_episode' and data.status='ACTIVE'
 */
export const GET = withAuthTenant(
  withErrorHandler(async (_req: NextRequest, { tenantId }) => {
    // Get all labor episodes for this tenant
    const episodes = await prisma.obgynForm.findMany({
      where: { tenantId, type: 'labor_episode' },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });

    // Filter to active episodes in JS (safe for labor ward scale)
    const activeEpisodes = episodes.filter(
      (e) => (e.data as Record<string, unknown> | null)?.status === 'ACTIVE'
    );

    if (activeEpisodes.length === 0) {
      return NextResponse.json({ patients: [] });
    }

    // Fetch patient data for all active episodes
    const patientIds = [...new Set(activeEpisodes.map((e) => e.patientId))];
    const patients = await prisma.patientMaster.findMany({
      where: { id: { in: patientIds }, tenantId },
      select: {
        id: true,
        fullName: true,
        mrn: true,
        gender: true,
      },
    });

    const patientMap = new Map(patients.map((p) => [p.id, p]));

    // Get latest nursing assessment for each patient
    const latestNursing = await prisma.obgynForm.findMany({
      where: {
        tenantId,
        patientId: { in: patientIds },
        type: 'labor_nursing',
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const latestNursingMap = new Map<string, typeof latestNursing[number]>();
    for (const n of latestNursing) {
      if (!latestNursingMap.has(n.patientId)) {
        latestNursingMap.set(n.patientId, n);
      }
    }

    // Get latest doctor assessment for each patient
    const latestDoctor = await prisma.obgynForm.findMany({
      where: {
        tenantId,
        patientId: { in: patientIds },
        type: 'labor_doctor',
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const latestDoctorMap = new Map<string, typeof latestDoctor[number]>();
    for (const d of latestDoctor) {
      if (!latestDoctorMap.has(d.patientId)) {
        latestDoctorMap.set(d.patientId, d);
      }
    }

    const result = activeEpisodes.map((ep) => {
      const patient = patientMap.get(ep.patientId);
      const nursing = latestNursingMap.get(ep.patientId);
      const doctor = latestDoctorMap.get(ep.patientId);
      const epData = ep.data as Record<string, unknown> | null;
      const nursingData = nursing?.data as Record<string, unknown> | null;
      const doctorData = doctor?.data as Record<string, unknown> | null;

      return {
        episodeId: ep.id,
        patientId: ep.patientId,
        admittedAt: ep.createdAt,
        patient: patient || { id: ep.patientId, fullName: 'Unknown', mrn: '' },
        episodeData: epData,
        latestNursing: nursing ? { ...nursingData, assessedAt: nursing.createdAt } : null,
        latestDoctor: doctor ? { ...doctorData, assessedAt: doctor.createdAt } : null,
        meowsScore: nursingData?.meows ?? null,
        alertLevel: nursingData?.meowsLevel ?? 'NORMAL',
        dilation: nursingData?.dilation ?? doctorData?.dilation ?? null,
      };
    });

    // Sort: EMERGENCY first, then URGENT, then by admission time
    const levelOrder: Record<string, number> = { EMERGENCY: 0, URGENT: 1, CAUTION: 2, NORMAL: 3 };
    result.sort((a, b) => {
      const la = levelOrder[a.alertLevel as string] ?? 3;
      const lb = levelOrder[b.alertLevel as string] ?? 3;
      if (la !== lb) return la - lb;
      return new Date(a.admittedAt).getTime() - new Date(b.admittedAt).getTime();
    });

    return NextResponse.json({ patients: result });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'obgyn.forms.view' }
);
