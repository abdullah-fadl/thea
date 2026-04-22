import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET — list IPD episodes with optional status filter, enriched with bed location
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const sp = req.nextUrl.searchParams;
    const status = sp.get('status');       // ACTIVE | DISCHARGED | ALL
    const limit = Math.min(Number(sp.get('limit') || 200), 500);
    const offset = Math.max(Number(sp.get('offset') || 0), 0);
    const search = (sp.get('q') || '').trim().toLowerCase();
    const patientId = sp.get('patientId');

    const where: any = { tenantId };
    if (status && status !== 'ALL') {
      where.status = status;
    }
    if (patientId) {
      where.patient = { path: ['patientMasterId'], equals: patientId };
    }

    const [episodes, total] = await Promise.all([
      prisma.ipdEpisode.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.ipdEpisode.count({ where }),
    ]);

    // Enrich each episode with its active bed assignment
    const episodeIds = episodes.map((e: any) => e.id);
    const admissions = episodeIds.length
      ? await prisma.ipdAdmission.findMany({
          where: {
            tenantId,
            episodeId: { in: episodeIds },
            isActive: true,
            releasedAt: null,
          },
          select: { id: true, episodeId: true, bedId: true },
        })
      : [];

    // Keyed by episodeId for O(1) lookup
    const admissionByEpisode = new Map<string, any>();
    for (const a of admissions) {
      if (a.episodeId) admissionByEpisode.set(String(a.episodeId), a);
    }

    // Fetch bed labels for active admissions
    const bedIds = admissions.map((a: any) => a.bedId).filter(Boolean);
    const beds = bedIds.length
      ? await prisma.ipdBed.findMany({
          where: { id: { in: bedIds } },
          select: { id: true, bedLabel: true, ward: true, room: true },
        })
      : [];
    const bedMap = new Map(beds.map((b: any) => [String(b.id), b]));

    const items = episodes.map((ep: any) => {
      const patient = ep.patient || {};
      const patientName = patient.fullName || patient.name || 'Unknown';
      const mrn = patient.mrn || '';

      const admission = admissionByEpisode.get(String(ep.id));
      const bed = admission?.bedId ? bedMap.get(String(admission.bedId)) : null;

      return {
        id: ep.id,
        encounterId: ep.encounterId || '',
        patientName,
        mrn,
        status: ep.status || 'ACTIVE',
        reasonForAdmission: ep.reasonForAdmission || '',
        createdAt: ep.createdAt,
        source: ep.source || null,
        riskFlags: ep.riskFlags || {},
        // Bed location data
        bedLabel: bed?.bedLabel || null,
        ward: bed?.ward || null,
        room: bed?.room || null,
        admissionId: admission?.id || null,
      };
    });

    // Client-side search filter (patient name / MRN / ward / bed)
    const filtered = search
      ? items.filter((it: any) =>
          it.patientName.toLowerCase().includes(search) ||
          it.mrn.toLowerCase().includes(search) ||
          (it.ward || '').toLowerCase().includes(search) ||
          (it.bedLabel || '').toLowerCase().includes(search)
        )
      : items;

    return NextResponse.json({
      items: filtered,
      total,
      limit,
      offset,
    });
  }),
  { tenantScoped: true, permissionKey: 'ipd.admin.view' }
);
