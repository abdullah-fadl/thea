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
// GET /api/obgyn/newborn/[newbornId] — single newborn record
// ---------------------------------------------------------------------------
export const GET = withAuthTenant(
  withErrorHandler(async (_req: NextRequest, { tenantId }, params) => {
    const newbornId = String((params as any)?.newbornId || '').trim();
    if (!newbornId) {
      return NextResponse.json({ error: 'newbornId is required' }, { status: 400 });
    }

    const record = await prisma.newbornRecord.findFirst({
      where: { tenantId, id: newbornId },
    });

    if (!record) {
      return NextResponse.json({ error: 'Newborn record not found' }, { status: 404 });
    }

    // Try to resolve mother name
    let motherName: string | null = null;
    try {
      const mother = await prisma.patientMaster.findFirst({
        where: { tenantId, id: record.motherPatientId },
        select: { fullName: true },
      });
      motherName = mother?.fullName || null;
    } catch {
      // non-critical
    }

    return NextResponse.json({ record: { ...record, motherName } });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'obgyn.forms.view' },
);

// ---------------------------------------------------------------------------
// PATCH /api/obgyn/newborn/[newbornId] — update newborn record
// ---------------------------------------------------------------------------

const updateSchema = z.object({
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
  status: z.enum(['ACTIVE', 'DISCHARGED', 'TRANSFERRED', 'DECEASED']).optional(),
  dischargedAt: z.string().optional().nullable(),
  attendingPhysician: z.string().optional().nullable(),
  attendingPhysicianId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
}).passthrough();

export const PATCH = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }, params) => {
    const newbornId = String((params as any)?.newbornId || '').trim();
    if (!newbornId) {
      return NextResponse.json({ error: 'newbornId is required' }, { status: 400 });
    }

    const existing = await prisma.newbornRecord.findFirst({
      where: { tenantId, id: newbornId },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Newborn record not found' }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const d = parsed.data;
    const updateData: any = { updatedAt: new Date() };

    // Map all provided fields
    const directFields = [
      'gestationalAge', 'gestationalAgeDays', 'birthWeight', 'birthLength',
      'headCircumference', 'gender', 'deliveryType', 'presentation',
      'apgar1Min', 'apgar5Min', 'apgar10Min', 'resuscitationNeeded',
      'resuscitationSteps', 'heartRate', 'respiratoryRate', 'temperature',
      'oxygenSaturation', 'skinColor', 'cry', 'tone', 'reflexes',
      'anomalies', 'cordBloodGas', 'cordClamped', 'cordBloodBanked',
      'vitaminKGiven', 'eyeProphylaxis', 'feedingType', 'skinToSkin',
      'bandApplied', 'footprintsTaken', 'nicuAdmission',
      'nicuAdmissionReason', 'status', 'attendingPhysician',
      'attendingPhysicianId', 'notes',
    ];

    for (const field of directFields) {
      if (d[field] !== undefined) {
        updateData[field] = d[field];
      }
    }

    // Date fields need conversion
    const dateFields = ['cordClampTime', 'firstFeedTime', 'skinToSkinTime', 'nicuAdmittedAt', 'dischargedAt'];
    for (const field of dateFields) {
      if (d[field] !== undefined) {
        updateData[field] = d[field] ? new Date(d[field] as string) : null;
      }
    }

    const record = await prisma.newbornRecord.update({
      where: { id: newbornId },
      data: updateData,
    });

    logger.info('Newborn record updated', { category: 'obgyn', tenantId, newbornId, userId });

    return NextResponse.json({ success: true, record });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'obgyn.forms.edit' },
);
