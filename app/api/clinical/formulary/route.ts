import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { validateBody } from '@/lib/validation/helpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET — Search / list formulary drugs
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const url = new URL(req.url);
    const query = url.searchParams.get('q') || '';
    const therapeuticClass = url.searchParams.get('therapeuticClass') || '';
    const formularyStatus = url.searchParams.get('formularyStatus') || '';
    const highAlert = url.searchParams.get('highAlert');
    const controlled = url.searchParams.get('controlled');
    const limit = Math.min(Number(url.searchParams.get('limit') || 200), 500);

    const where: any = { tenantId, isActive: true };

    if (query) {
      where.OR = [
        { genericName: { contains: query, mode: 'insensitive' } },
        { genericNameAr: { contains: query, mode: 'insensitive' } },
        { atcCode: { contains: query, mode: 'insensitive' } },
        { therapeuticClass: { contains: query, mode: 'insensitive' } },
      ];
    }

    if (therapeuticClass) {
      where.therapeuticClass = { equals: therapeuticClass, mode: 'insensitive' };
    }

    if (formularyStatus) {
      where.formularyStatus = formularyStatus;
    }

    if (highAlert === 'true') {
      where.highAlert = true;
    }

    if (controlled === 'true') {
      where.controlled = true;
    }

    const items = await prisma.formularyDrug.findMany({
      where,
      orderBy: { genericName: 'asc' },
      take: limit,
    });

    return NextResponse.json({ items, total: items.length });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'formulary.view' }
);

// POST — Add a new drug to the formulary
const addDrugSchema = z.object({
  genericName: z.string().min(1),
  genericNameAr: z.string().min(1),
  brandNames: z.array(z.string()).default([]),
  sfdaRegistration: z.string().optional(),
  atcCode: z.string().optional(),
  atcCategory: z.string().optional(),
  therapeuticClass: z.string().min(1),
  therapeuticClassAr: z.string().min(1),
  formularyStatus: z.enum(['formulary', 'non_formulary', 'restricted', 'conditional']).default('formulary'),
  restrictionCriteria: z.string().optional(),
  restrictionCriteriaAr: z.string().optional(),
  approverRole: z.string().optional(),
  routes: z.array(z.string()).default([]),
  forms: z.array(z.object({
    form: z.string(),
    strength: z.string(),
    unitPrice: z.number().min(0),
    inStock: z.boolean(),
  })).default([]),
  maxDailyDose: z.number().optional(),
  maxDailyDoseUnit: z.string().optional(),
  renalAdjustment: z.boolean().default(false),
  hepaticAdjustment: z.boolean().default(false),
  pregnancyCategory: z.string().default('C'),
  lactationSafe: z.boolean().default(false),
  pediatricApproved: z.boolean().default(true),
  geriatricCaution: z.boolean().default(false),
  highAlert: z.boolean().default(false),
  controlled: z.boolean().default(false),
  controlSchedule: z.string().optional(),
  lasaPairs: z.array(z.string()).default([]),
  blackBoxWarning: z.string().optional(),
  blackBoxWarningAr: z.string().optional(),
  interactions: z.array(z.any()).default([]),
  contraindications: z.array(z.string()).default([]),
  contraindicationsAr: z.array(z.string()).default([]),
  monitoringRequired: z.array(z.string()).default([]),
  storageConditions: z.string().optional(),
}).passthrough();

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    let body: any;
    try { body = await req.json(); } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const v = validateBody(body, addDrugSchema);
    if ('error' in v) return v.error;

    const drug = await prisma.formularyDrug.create({
      data: {
        tenantId,
        genericName: v.data.genericName,
        genericNameAr: v.data.genericNameAr,
        brandNames: v.data.brandNames,
        sfdaRegistration: v.data.sfdaRegistration || null,
        atcCode: v.data.atcCode || null,
        atcCategory: v.data.atcCategory || null,
        therapeuticClass: v.data.therapeuticClass,
        therapeuticClassAr: v.data.therapeuticClassAr,
        formularyStatus: v.data.formularyStatus,
        restrictionCriteria: v.data.restrictionCriteria || null,
        restrictionCriteriaAr: v.data.restrictionCriteriaAr || null,
        approverRole: v.data.approverRole || null,
        routes: v.data.routes,
        forms: v.data.forms,
        maxDailyDose: v.data.maxDailyDose ?? null,
        maxDailyDoseUnit: v.data.maxDailyDoseUnit || null,
        renalAdjustment: v.data.renalAdjustment,
        hepaticAdjustment: v.data.hepaticAdjustment,
        pregnancyCategory: v.data.pregnancyCategory,
        lactationSafe: v.data.lactationSafe,
        pediatricApproved: v.data.pediatricApproved,
        geriatricCaution: v.data.geriatricCaution,
        highAlert: v.data.highAlert,
        controlled: v.data.controlled,
        controlSchedule: v.data.controlSchedule || null,
        lasaPairs: v.data.lasaPairs,
        blackBoxWarning: v.data.blackBoxWarning || null,
        blackBoxWarningAr: v.data.blackBoxWarningAr || null,
        interactions: v.data.interactions,
        contraindications: v.data.contraindications,
        contraindicationsAr: v.data.contraindicationsAr,
        monitoringRequired: v.data.monitoringRequired,
        storageConditions: v.data.storageConditions || null,
      },
    });

    return NextResponse.json({ success: true, id: drug.id });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'formulary.manage' }
);
