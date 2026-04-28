import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { validateBody } from '@/lib/validation/helpers';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/lib/monitoring/logger';
import { createAuditLog } from '@/lib/utils/audit';
import { withAccessAudit } from '@/lib/audit/accessLogger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withAccessAudit(withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const status = req.nextUrl.searchParams.get('status') || 'PENDING';
    const search = req.nextUrl.searchParams.get('search') || '';

    const where: any = { tenantId, status };
    if (search) {
      where.OR = [
        { patientName: { contains: search, mode: 'insensitive' } },
        { mrn: { contains: search, mode: 'insensitive' } },
        { medication: { contains: search, mode: 'insensitive' } },
      ];
    }

    const items = await prisma.pharmacyPrescription.findMany({
      where,
      orderBy: { prescribedAt: 'asc' },
      take: 200,
    });

    return NextResponse.json({ items });
  }), { resourceType: 'prescription', logResponseMeta: true }),
  { tenantScoped: true, permissionKey: 'pharmacy.dispense.view' }
);

const createPrescriptionSchema = z.object({
  patientId: z.string().min(1),
  patientName: z.string().min(1),
  mrn: z.string().min(1),
  encounterId: z.string().optional(),
  medication: z.string().min(1),
  medicationAr: z.string().optional(),
  genericName: z.string().optional(),
  strength: z.string().min(1),
  form: z.enum(['tablet', 'capsule', 'syrup', 'injection', 'cream', 'drops', 'inhaler', 'suppository', 'patch', 'other']).default('tablet'),
  route: z.enum(['oral', 'iv', 'im', 'sc', 'topical', 'inhalation', 'rectal', 'sublingual', 'ophthalmic', 'otic', 'nasal', 'other']).default('oral'),
  frequency: z.string().min(1),
  duration: z.string().min(1),
  quantity: z.number().int().min(1),
  refills: z.number().int().min(0).default(0),
  instructions: z.string().optional(),
  instructionsAr: z.string().optional(),
  doctorId: z.string().optional(),
  doctorName: z.string().optional(),
  priority: z.enum(['routine', 'urgent', 'stat']).default('routine'),
}).passthrough();

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }) => {
    const body = await req.json().catch(() => ({}));
    const v = validateBody(body, createPrescriptionSchema);
    if ('error' in v) return v.error;

    const now = new Date();
    const prescription = await prisma.pharmacyPrescription.create({
      data: {
        id: uuidv4(),
        tenantId,
        ...v.data,
        status: 'PENDING',
        prescribedAt: now,
        prescribedBy: userId,
        prescriberName: v.data.doctorName || user?.displayName || user?.email || null,
        createdAt: now,
        updatedAt: now,
      },
    });

    await createAuditLog(
      'pharmacy_prescription',
      prescription.id,
      'PRESCRIPTION_CREATED',
      userId || 'system',
      user?.email,
      { patientId: v.data.patientId, medication: v.data.medication },
      tenantId
    );

    logger.info('Prescription created', {
      category: 'api',
      tenantId,
      userId,
      route: '/api/pharmacy/prescriptions',
      prescriptionId: prescription.id,
    });

    return NextResponse.json({ success: true, prescription });
  }),
  { tenantScoped: true, permissionKey: 'pharmacy.prescriptions.create' }
);
