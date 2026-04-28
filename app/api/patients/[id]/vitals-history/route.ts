import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { withAccessAudit } from '@/lib/audit/accessLogger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withAccessAudit(withErrorHandler(async (req: NextRequest, { tenantId }, params) => {
  const patientId = String((params as Record<string, string>)?.id || '').trim();
  if (!patientId) {
    return NextResponse.json({ error: 'patientId is required' }, { status: 400 });
  }

  const encounters = await prisma.encounterCore.findMany({
    where: { tenantId, patientId },
    select: { id: true },
    take: 100,
  });

  const encounterIds = encounters.map((e) => e.id).filter(Boolean);
  if (!encounterIds.length) {
    return NextResponse.json({ items: [] });
  }

  const opdRecords = await prisma.opdEncounter.findMany({
    where: { tenantId, encounterCoreId: { in: encounterIds } },
    select: {
      encounterCoreId: true,
      nursingEntries: { select: { vitals: true, createdAt: true } },
    },
  });

  const items: any[] = [];
  for (const record of opdRecords) {
    const entries = record.nursingEntries || [];
    for (const entry of entries) {
      const vitals = (entry?.vitals as Record<string, unknown>) || {};
      if (!vitals) continue;
      items.push({
        date: entry?.createdAt || null,
        bp: vitals.bp || null,
        hr: vitals.hr ?? null,
        temp: vitals.temp ?? null,
        spo2: vitals.spo2 ?? null,
        weight: vitals.weight ?? null,
        height: vitals.height ?? null,
        bmi: vitals.bmi ?? null,
      });
    }
  }

  items.sort((a, b) => {
    const aTime = a.date ? new Date(a.date).getTime() : 0;
    const bTime = b.date ? new Date(b.date).getTime() : 0;
    return aTime - bTime;
  });

  return NextResponse.json({ items });
}), { resourceType: 'vital_signs', extractPatientId: (req) => { const parts = req.nextUrl.pathname.split('/'); const idx = parts.indexOf('patients'); return idx >= 0 ? parts[idx + 1] || null : null; }, logResponseMeta: true }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKeys: ['patients.growth.view', 'opd.nursing.edit', 'opd.visit.view', 'opd.doctor.encounter.view'] }
);
