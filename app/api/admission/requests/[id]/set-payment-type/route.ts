import { logger } from '@/lib/monitoring/logger';
import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { setPaymentTypeSchema, isValidTransition } from '@/lib/validation/admission.schema';
import { autoCompleteMultipleChecklistItems } from '@/lib/admission/checklistHelper';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface PrismaDelegate {
  findFirst: (args: any) => Promise<any | null>;
  update: (args: any) => Promise<any>;
}

const db = prisma as unknown as Record<string, PrismaDelegate>;

// POST /api/admission/requests/[id]/set-payment-type
export const POST = withAuthTenant(
  async (req: NextRequest, { tenantId, userId }: { tenantId: string; userId: string }) => {
    try {
      const segments = req.nextUrl.pathname.split('/');
      const id = segments[segments.indexOf('requests') + 1] || '';

      const body = await req.json();
      const parsed = setPaymentTypeSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
          { status: 400 }
        );
      }

      const { paymentType, insuranceId } = parsed.data;

      // 1. Fetch admission request
      const request = await db.admissionRequest.findFirst({
        where: { tenantId, id },
      });
      if (!request) {
        return NextResponse.json({ error: 'Admission request not found' }, { status: 404 });
      }

      // Only allow setting payment type on PENDING or INSURANCE_REVIEW status
      if (!['PENDING', 'INSURANCE_REVIEW'].includes(request.status as string)) {
        return NextResponse.json(
          { error: `Cannot set payment type when status is '${request.status}'` },
          { status: 409 }
        );
      }

      const updates: any = { paymentType };

      // 2. Handle INSURANCE
      if (paymentType === 'INSURANCE') {
        // Lookup patient's active insurance
        let insurance: any | null = null;
        if (insuranceId) {
          insurance = await db.patientInsurance.findFirst({
            where: { tenantId, id: insuranceId, status: 'active' },
          });
        } else {
          // Auto-find primary active insurance
          insurance = await db.patientInsurance.findFirst({
            where: { tenantId, patientId: request.patientMasterId, status: 'active', isPrimary: true },
          });
          if (!insurance) {
            insurance = await db.patientInsurance.findFirst({
              where: { tenantId, patientId: request.patientMasterId, status: 'active' },
            });
          }
        }

        if (insurance) {
          updates.insuranceId = insurance.id;
          updates.insurerName = insurance.payerName || insurance.insurerName || null;
          updates.policyNumber = insurance.policyNumber || null;
          updates.memberId = insurance.memberId || null;
        }

        // Transition to INSURANCE_REVIEW
        if (request.status === 'PENDING') {
          const transition = isValidTransition(request.status as string, 'INSURANCE_REVIEW', request.urgency as string);
          if (transition.valid) {
            updates.status = 'INSURANCE_REVIEW';
          }
        }
      }

      // 3. Handle CASH — estimate cost and set deposit required
      if (paymentType === 'CASH') {
        if (request.expectedLOS && request.bedType) {
          // Lookup BED price from charge catalog
          const bedCatalog = await db.billingChargeCatalog.findFirst({
            where: {
              tenantId,
              itemType: 'BED',
              isActive: true,
              OR: [
                { name: { contains: request.bedType, mode: 'insensitive' } },
                { code: { contains: 'BED', mode: 'insensitive' } },
              ],
            },
          });

          const bedPerDay = bedCatalog ? Number(bedCatalog.basePrice) : 500; // fallback 500 SAR
          const totalBed = bedPerDay * (request.expectedLOS as number);
          const estimatedCost = totalBed;
          const depositRequired = Math.ceil(estimatedCost * 0.5);

          updates.estimatedCost = estimatedCost;
          updates.estimatedCostBreakdown = {
            bedPerDay,
            totalBed,
            expectedLOS: request.expectedLOS,
            bedType: request.bedType,
            total: estimatedCost,
          };
          updates.depositRequired = depositRequired;
        }
      }

      // 4. Handle GOVERNMENT — auto-complete financial checklist items
      if (paymentType === 'GOVERNMENT') {
        updates.eligibilityStatus = 'SKIPPED';
        updates.preauthStatus = 'NOT_REQUIRED';

        // Auto-complete both financial checklist items
        await autoCompleteMultipleChecklistItems(
          tenantId,
          id,
          ['insurance_verified', 'financial_approval'],
          userId,
          'Government-funded — auto-approved'
        );
      }

      // 5. Update admission request
      const updated = await db.admissionRequest.update({
        where: { id },
        data: { ...updates, updatedByUserId: userId },
      });

      return NextResponse.json({ success: true, request: updated });
    } catch (err) {
      logger.error('[admission/requests/[id]/set-payment-type] POST error:', err);
      return NextResponse.json({ error: 'Failed to set payment type' }, { status: 500 });
    }
  },
  { permissionKey: 'admission.manage' }
);
