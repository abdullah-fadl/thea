import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET — list all OR cases for this tenant
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const sp = req.nextUrl.searchParams;
    const status = sp.get('status');       // OPEN, IN_PROGRESS, COMPLETED, CANCELLED, ALL
    const limit = Math.min(Number(sp.get('limit') || 100), 500);
    const offset = Math.max(Number(sp.get('offset') || 0), 0);
    const search = (sp.get('q') || '').trim().toLowerCase();

    const where: any = { tenantId };
    if (status && status !== 'ALL') {
      where.status = status;
    }

    const [cases, total] = await Promise.all([
      prisma.orCase.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.orCase.count({ where }),
    ]);

    // Get latest event per case (to show current phase)
    const caseIds = cases.map((c: any) => c.id);
    const latestEvents = caseIds.length
      ? await prisma.orCaseEvent.findMany({
          where: { tenantId, caseId: { in: caseIds } },
          orderBy: { createdAt: 'desc' },
        })
      : [];

    // Build map: caseId → latest step
    const latestStepMap = new Map<string, string>();
    const eventCountMap = new Map<string, number>();
    for (const ev of latestEvents) {
      const cid = String((ev as Record<string, unknown>).caseId || '');
      if (!latestStepMap.has(cid)) {
        latestStepMap.set(cid, String((ev as Record<string, unknown>).step || ''));
      }
      eventCountMap.set(cid, (eventCountMap.get(cid) || 0) + 1);
    }

    // Enrich with patient names
    const patientIds = cases.map((c: any) => c.patientMasterId).filter(Boolean);
    const patients = patientIds.length
      ? await prisma.patientMaster.findMany({
          where: { id: { in: patientIds } },
          select: { id: true, fullName: true, mrn: true },
        })
      : [];
    const patientMap = new Map(patients.map((p: any) => [String(p.id), p]));

    const items = cases.map((c: any) => {
      const patient = patientMap.get(String(c.patientMasterId || ''));
      return {
        id: c.id,
        orderId: c.orderId || '',
        encounterCoreId: c.encounterCoreId || '',
        patientMasterId: c.patientMasterId || '',
        patientName: patient?.fullName || 'Unknown',
        mrn: patient?.mrn || '',
        procedureName: c.procedureName || '',
        procedureCode: c.procedureCode || '',
        departmentKey: c.departmentKey || '',
        status: c.status || 'OPEN',
        currentStep: latestStepMap.get(c.id) || 'START',
        eventCount: eventCountMap.get(c.id) || 0,
        createdAt: c.createdAt,
      };
    });

    // Search filter
    const filtered = search
      ? items.filter(it =>
          it.patientName.toLowerCase().includes(search) ||
          it.mrn.toLowerCase().includes(search) ||
          it.procedureName.toLowerCase().includes(search)
        )
      : items;

    // Summary stats
    const summary = {
      total,
      open: items.filter(i => i.status === 'OPEN').length,
      inProgress: items.filter(i => i.status === 'IN_PROGRESS').length,
      completed: items.filter(i => i.status === 'COMPLETED').length,
      cancelled: items.filter(i => i.status === 'CANCELLED').length,
    };

    return NextResponse.json({ items: filtered, total, summary, limit, offset });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'or.view' }
);
