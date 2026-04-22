import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { validateBody } from '@/lib/validation/helpers';
import { createAuditLog } from '@/lib/utils/audit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const administerSchema = z.object({
  administeredByUserId: z.string().min(1, 'administeredByUserId is required'),
  dose: z.string().min(1, 'dose is required'),
  unit: z.string().min(1, 'unit is required'),
  route: z.string().min(1, 'route is required'),
  site: z.string().optional(),
  notes: z.string().optional(),
  administeredAt: z.string().datetime().optional(),
});

/**
 * POST /api/pharmacy/prescriptions/[prescriptionId]/administer
 * Record a medication administration event for a prescription.
 */
export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }, params) => {
    const resolved = params instanceof Promise ? await params : params;
    const prescriptionId = resolved?.prescriptionId as string;

    if (!prescriptionId) {
      return NextResponse.json(
        { error: 'Prescription ID is required', errorAr: 'معرف الوصفة مطلوب' },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const v = validateBody(body, administerSchema);
    if ('error' in v) return v.error;
    const { administeredByUserId, dose, unit, route, site, notes, administeredAt } = v.data;

    // Find the prescription
    const prescription = await prisma.pharmacyPrescription.findFirst({
      where: { id: prescriptionId, tenantId },
    });

    if (!prescription) {
      return NextResponse.json(
        { error: 'Prescription not found', errorAr: 'الوصفة غير موجودة' },
        { status: 404 }
      );
    }

    const status = prescription.status;
    if (!['ACTIVE', 'DISPENSED', 'VERIFIED'].includes(status)) {
      return NextResponse.json(
        {
          error: 'Prescription is not in a valid status for administration',
          errorAr: 'حالة الوصفة لا تسمح بالإعطاء',
        },
        { status: 409 }
      );
    }

    const now = new Date();
    const adminTime = administeredAt ? new Date(administeredAt) : now;

    // Record the administration via PharmacyUnitDose
    const administration = await prisma.pharmacyUnitDose.create({
      data: {
        tenantId,
        prescriptionId,
        patientId: prescription.patientId || undefined,
        patientName: prescription.patientName || undefined,
        mrn: prescription.mrn || undefined,
        medication: prescription.medication || 'Unknown',
        genericName: prescription.genericName || undefined,
        strength: prescription.strength || undefined,
        form: prescription.form || undefined,
        route,
        dose,
        status: 'ADMINISTERED',
        administeredByUserId,
        administeredAt: adminTime,
        administrationNotes: [
          site ? `Site: ${site}` : null,
          `Unit: ${unit}`,
          notes || null,
        ].filter(Boolean).join(' | ') || undefined,
      },
    });

    // Create audit log
    await createAuditLog(
      'PharmacyPrescription',
      prescriptionId,
      'MEDICATION_ADMINISTERED',
      userId,
      user?.email,
      {
        prescriptionId,
        administrationId: administration.id,
        administeredByUserId,
        dose,
        unit,
        route,
        site: site || null,
        administeredAt: adminTime.toISOString(),
        notes: notes || null,
      },
      tenantId,
      req
    );

    return NextResponse.json({
      success: true,
      message: 'Medication administration recorded successfully',
      messageAr: 'تم تسجيل إعطاء الدواء بنجاح',
      administration,
    });
  }),
  { tenantScoped: true, permissionKey: 'pharmacy.prescriptions.create' }
);
