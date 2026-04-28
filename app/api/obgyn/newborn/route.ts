import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ---------------------------------------------------------------------------
// GET /api/obgyn/newborn — list newborn records with optional filters
// ---------------------------------------------------------------------------
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const url = req.nextUrl;
    const status = url.searchParams.get('status')?.trim() || '';
    const motherPatientId = url.searchParams.get('motherPatientId')?.trim() || '';
    const nicuAdmission = url.searchParams.get('nicuAdmission')?.trim() || '';

    const where: any = { tenantId };
    if (status) where.status = status;
    if (motherPatientId) where.motherPatientId = motherPatientId;
    if (nicuAdmission === 'true') where.nicuAdmission = true;
    if (nicuAdmission === 'false') where.nicuAdmission = false;

    const items = await (prisma as unknown as Record<string, typeof prisma.encounterCore>).newbornRecord.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return NextResponse.json({ items });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'obgyn.forms.view' },
);

// ---------------------------------------------------------------------------
// POST /api/obgyn/newborn — create a new newborn record
// ---------------------------------------------------------------------------

const createSchema = z.object({
  motherPatientId: z.string().min(1),
  laborRecordId: z.string().optional().nullable(),
  dateOfBirth: z.string().min(1),
  timeOfBirth: z.string().optional().nullable(),
  gestationalAge: z.number().int().min(20).max(45).optional().nullable(),
  gestationalAgeDays: z.number().int().min(0).max(6).optional().nullable(),
  birthWeight: z.number().optional().nullable(),
  birthLength: z.number().optional().nullable(),
  headCircumference: z.number().optional().nullable(),
  gender: z.enum(['MALE', 'FEMALE', 'AMBIGUOUS']).optional().nullable(),
  deliveryType: z.enum(['SVD', 'CS', 'INSTRUMENTAL_VACUUM', 'INSTRUMENTAL_FORCEPS']).optional().nullable(),
  presentation: z.enum(['CEPHALIC', 'BREECH', 'TRANSVERSE']).optional().nullable(),
  apgar1Min: z.number().int().min(0).max(10).optional().nullable(),
  apgar5Min: z.number().int().min(0).max(10).optional().nullable(),
  apgar10Min: z.number().int().min(0).max(10).optional().nullable(),
  resuscitationNeeded: z.boolean().optional(),
  resuscitationSteps: z.any().optional().nullable(),
  heartRate: z.number().int().optional().nullable(),
  respiratoryRate: z.number().int().optional().nullable(),
  temperature: z.number().optional().nullable(),
  oxygenSaturation: z.number().int().optional().nullable(),
  skinColor: z.string().optional().nullable(),
  cry: z.string().optional().nullable(),
  tone: z.string().optional().nullable(),
  reflexes: z.string().optional().nullable(),
  anomalies: z.any().optional().nullable(),
  cordBloodGas: z.any().optional().nullable(),
  cordClamped: z.boolean().optional(),
  cordClampTime: z.string().optional().nullable(),
  cordBloodBanked: z.boolean().optional(),
  vitaminKGiven: z.boolean().optional(),
  eyeProphylaxis: z.boolean().optional(),
  firstFeedTime: z.string().optional().nullable(),
  feedingType: z.enum(['BREAST', 'FORMULA', 'MIXED', 'NPO']).optional().nullable(),
  skinToSkin: z.boolean().optional(),
  skinToSkinTime: z.string().optional().nullable(),
  bandApplied: z.boolean().optional(),
  footprintsTaken: z.boolean().optional(),
  nicuAdmission: z.boolean().optional(),
  nicuAdmissionReason: z.string().optional().nullable(),
  nicuAdmittedAt: z.string().optional().nullable(),
  attendingPhysician: z.string().optional().nullable(),
  attendingPhysicianId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
}).passthrough();

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }) => {
    const body = await req.json().catch(() => ({}));
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const d = parsed.data;
    const now = new Date();

    const record = await (prisma as any).newbornRecord.create({
      data: {
        tenantId,
        motherPatientId: d.motherPatientId,
        laborRecordId: d.laborRecordId || null,
        dateOfBirth: new Date(d.dateOfBirth),
        timeOfBirth: d.timeOfBirth ? new Date(d.timeOfBirth) : null,
        gestationalAge: d.gestationalAge ?? null,
        gestationalAgeDays: d.gestationalAgeDays ?? null,
        birthWeight: d.birthWeight ?? null,
        birthLength: d.birthLength ?? null,
        headCircumference: d.headCircumference ?? null,
        gender: d.gender || null,
        deliveryType: d.deliveryType || null,
        presentation: d.presentation || null,
        apgar1Min: d.apgar1Min ?? null,
        apgar5Min: d.apgar5Min ?? null,
        apgar10Min: d.apgar10Min ?? null,
        resuscitationNeeded: d.resuscitationNeeded ?? false,
        resuscitationSteps: d.resuscitationSteps || null,
        heartRate: d.heartRate ?? null,
        respiratoryRate: d.respiratoryRate ?? null,
        temperature: d.temperature ?? null,
        oxygenSaturation: d.oxygenSaturation ?? null,
        skinColor: d.skinColor || null,
        cry: d.cry || null,
        tone: d.tone || null,
        reflexes: d.reflexes || null,
        anomalies: d.anomalies || null,
        cordBloodGas: d.cordBloodGas || null,
        cordClamped: d.cordClamped ?? false,
        cordClampTime: d.cordClampTime ? new Date(d.cordClampTime) : null,
        cordBloodBanked: d.cordBloodBanked ?? false,
        vitaminKGiven: d.vitaminKGiven ?? false,
        eyeProphylaxis: d.eyeProphylaxis ?? false,
        firstFeedTime: d.firstFeedTime ? new Date(d.firstFeedTime) : null,
        feedingType: d.feedingType || null,
        skinToSkin: d.skinToSkin ?? false,
        skinToSkinTime: d.skinToSkinTime ? new Date(d.skinToSkinTime) : null,
        bandApplied: d.bandApplied ?? false,
        footprintsTaken: d.footprintsTaken ?? false,
        nicuAdmission: d.nicuAdmission ?? false,
        nicuAdmissionReason: d.nicuAdmissionReason || null,
        nicuAdmittedAt: d.nicuAdmittedAt ? new Date(d.nicuAdmittedAt) : null,
        status: 'ACTIVE',
        attendingPhysician: d.attendingPhysician || null,
        attendingPhysicianId: d.attendingPhysicianId || null,
        notes: d.notes || null,
        createdAt: now,
        updatedAt: now,
      },
    });

    logger.info('Newborn record created', { category: 'obgyn', tenantId, newbornId: record.id, userId });

    return NextResponse.json({ success: true, record }, { status: 201 });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'obgyn.forms.edit' },
);
