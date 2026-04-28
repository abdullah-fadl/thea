import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { validateBody } from '@/lib/validation/helpers';
import { createAuditLog } from '@/lib/utils/audit';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const marRecordSchema = z.object({
  encounterCoreId: z.string().min(1, 'encounterCoreId is required'),
  patientId: z.string().min(1, 'patientId is required'),
  medicationId: z.string().optional(),
  medicationName: z.string().min(1, 'medicationName is required'),
  dose: z.string().min(1, 'dose is required'),
  route: z.string().min(1, 'route is required'),
  scheduledTime: z.string().min(1, 'scheduledTime is required'),
  administeredTime: z.string().optional(),
  status: z.enum(['GIVEN', 'HELD', 'REFUSED', 'NOT_GIVEN', 'SCHEDULED']),
  holdReason: z.string().optional(),
  refusalReason: z.string().optional(),
  notes: z.string().optional(),
});

/**
 * POST /api/opd/mar
 * Record medication administration (MAR entry).
 * Used by nursing staff to document when medications are given to patients.
 */
export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }) => {
    const body = await req.json().catch(() => ({}));
    const v = validateBody(body, marRecordSchema);
    if ('error' in v) return v.error;

    const {
      encounterCoreId,
      patientId,
      medicationId,
      medicationName,
      dose,
      route,
      scheduledTime,
      administeredTime,
      status,
      holdReason,
      refusalReason,
      notes,
    } = v.data;

    // Validate encounter exists and is active
    const encounter = await prisma.encounterCore.findFirst({
      where: { id: encounterCoreId, tenantId },
    });
    if (!encounter) {
      return NextResponse.json(
        { error: 'Encounter not found', errorAr: 'الزيارة غير موجودة' },
        { status: 404 }
      );
    }
    if (encounter.status === 'CLOSED') {
      return NextResponse.json(
        { error: 'Encounter is closed', errorAr: 'الزيارة مغلقة' },
        { status: 409 }
      );
    }

    // Validate patient exists
    const patient = await prisma.patientMaster.findFirst({
      where: { id: patientId, tenantId },
    });
    if (!patient) {
      return NextResponse.json(
        { error: 'Patient not found', errorAr: 'المريض غير موجود' },
        { status: 404 }
      );
    }

    const now = new Date();
    const record = await prisma.medicationAdministration.create({
      data: {
        tenantId,
        encounterCoreId,
        patientId,
        medicationId: medicationId || null,
        medicationName,
        dose,
        route,
        scheduledTime: new Date(scheduledTime),
        administeredTime: administeredTime ? new Date(administeredTime) : (status === 'GIVEN' ? now : null),
        status,
        holdReason: holdReason || null,
        refusalReason: refusalReason || null,
        notes: notes || null,
        nurseId: userId || null,
        nurseName: user?.displayName || user?.email || null,
        createdAt: now,
        updatedAt: now,
      },
    });

    await createAuditLog(
      'medication_administration',
      record.id,
      'MAR_RECORDED',
      userId || 'system',
      user?.email,
      { encounterCoreId, patientId, medicationName, dose, route, status },
      tenantId
    );

    logger.info('MAR entry recorded', {
      category: 'api',
      tenantId,
      userId,
      route: '/api/opd/mar',
      encounterCoreId,
      medicationName,
      status,
    });

    return NextResponse.json({ success: true, record });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'opd.nursing.edit' }
);

/**
 * GET /api/opd/mar?encounterCoreId=xxx
 * List medication administration records for an encounter.
 */
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const { searchParams } = new URL(req.url);
    const encounterCoreId = String(searchParams.get('encounterCoreId') || '').trim();
    if (!encounterCoreId) {
      return NextResponse.json(
        { error: 'encounterCoreId is required', errorAr: 'معرف الزيارة مطلوب' },
        { status: 400 }
      );
    }

    const patientId = String(searchParams.get('patientId') || '').trim();
    const status = String(searchParams.get('status') || '').trim();

    const where: any = { tenantId, encounterCoreId };
    if (patientId) where.patientId = patientId;
    if (status) where.status = status;

    const records = await prisma.medicationAdministration.findMany({
      where,
      orderBy: { scheduledTime: 'asc' },
      take: 200,
    });

    return NextResponse.json({ items: records });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'opd.nursing.view' }
);
