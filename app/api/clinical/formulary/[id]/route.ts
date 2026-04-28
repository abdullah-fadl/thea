import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET — Get drug detail
export const GET = withAuthTenant(
  withErrorHandler(async (_req: NextRequest, { tenantId }, params) => {
    const resolvedParams = params instanceof Promise ? await params : params;
    const id = String(resolvedParams?.id || '');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const drug = await prisma.formularyDrug.findFirst({
      where: { id, tenantId },
    });

    if (!drug) return NextResponse.json({ error: 'Drug not found' }, { status: 404 });

    return NextResponse.json({ drug });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'formulary.view' }
);

// PATCH — Update drug
export const PATCH = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }, params) => {
    const resolvedParams = params instanceof Promise ? await params : params;
    const id = String(resolvedParams?.id || '');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    let body: any;
    try { body = await req.json(); } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const existing = await prisma.formularyDrug.findFirst({
      where: { id, tenantId },
    });
    if (!existing) return NextResponse.json({ error: 'Drug not found' }, { status: 404 });

    // Only allow updating specific fields
    const allowedFields = [
      'genericName', 'genericNameAr', 'brandNames', 'sfdaRegistration',
      'atcCode', 'atcCategory', 'therapeuticClass', 'therapeuticClassAr',
      'formularyStatus', 'restrictionCriteria', 'restrictionCriteriaAr',
      'approverRole', 'routes', 'forms', 'maxDailyDose', 'maxDailyDoseUnit',
      'renalAdjustment', 'hepaticAdjustment', 'pregnancyCategory', 'lactationSafe',
      'pediatricApproved', 'geriatricCaution', 'highAlert', 'controlled',
      'controlSchedule', 'lasaPairs', 'blackBoxWarning', 'blackBoxWarningAr',
      'interactions', 'contraindications', 'contraindicationsAr',
      'monitoringRequired', 'storageConditions', 'isActive',
    ];

    const updateData: any = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    const updated = await prisma.formularyDrug.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, drug: updated });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'formulary.manage' }
);
