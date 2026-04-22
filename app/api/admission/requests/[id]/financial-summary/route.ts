import { logger } from '@/lib/monitoring/logger';
import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';

const db = prisma as any;

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET /api/admission/requests/[id]/financial-summary
export const GET = withAuthTenant(
  async (req: NextRequest, { tenantId }: { tenantId: string }) => {
    try {
      const segments = req.nextUrl.pathname.split('/');
      const id = segments[segments.indexOf('requests') + 1] || '';

      // 1. Fetch admission request
      const request = await db.admissionRequest.findFirst({
        where: { tenantId, id },
      });
      if (!request) {
        return NextResponse.json({ error: 'Admission request not found' }, { status: 404 });
      }

      const summary: any = {
        paymentType: request.paymentType || null,
        status: request.status,
      };

      // 2. Insurance details
      if (request.paymentType === 'INSURANCE') {
        summary.insurance = {
          insuranceId: request.insuranceId,
          insurerName: request.insurerName,
          policyNumber: request.policyNumber,
          memberId: request.memberId,
        };

        // Eligibility
        summary.eligibility = {
          status: request.eligibilityStatus,
          checkedAt: request.eligibilityCheckedAt,
        };
        if (request.eligibilityCheckId) {
          const eligLog = await db.nphiesEligibilityLog.findFirst({
            where: { tenantId, id: request.eligibilityCheckId },
          });
          if (eligLog) {
            summary.eligibility = {
              ...summary.eligibility as object,
              eligible: eligLog.eligible,
              response: eligLog.response,
            };
          }
        }

        // Pre-auth
        summary.preauth = {
          status: request.preauthStatus,
          authorizationNumber: request.preauthNumber,
        };
        if (request.preauthId) {
          const preauth = await db.nphiesPriorAuth.findFirst({
            where: { tenantId, id: request.preauthId },
          });
          if (preauth) {
            summary.preauth = {
              ...summary.preauth as object,
              approved: preauth.approved,
              expiryDate: preauth.expiryDate,
              approvedServices: preauth.approvedServices,
              denialReason: preauth.denialReason,
            };
          }
        }
      }

      // 3. Cost estimation
      summary.costEstimate = {
        estimatedCost: request.estimatedCost ? Number(request.estimatedCost) : null,
        breakdown: request.estimatedCostBreakdown || null,
      };

      // 4. Deposit details (for cash patients)
      if (request.paymentType === 'CASH') {
        const depositRequired = request.depositRequired ? Number(request.depositRequired) : 0;
        const depositCollected = request.depositCollected ? Number(request.depositCollected) : 0;

        summary.deposit = {
          required: depositRequired,
          collected: depositCollected,
          method: request.depositMethod,
          receiptNumber: request.depositReceiptNumber,
          collectedAt: request.depositCollectedAt,
          meetsRequirement: depositRequired > 0 ? depositCollected >= depositRequired : true,
          percentage: depositRequired > 0 ? Math.round((depositCollected / depositRequired) * 100) : 100,
        };

        // Fetch payment record if exists
        if (request.depositPaymentId) {
          const payment = await db.billingPayment.findFirst({
            where: { tenantId, id: request.depositPaymentId },
          });
          if (payment) {
            summary.deposit = {
              ...summary.deposit as object,
              paymentId: payment.id,
              paymentStatus: payment.status,
              currency: payment.currency,
            };
          }
        }
      }

      // 5. Government
      if (request.paymentType === 'GOVERNMENT') {
        summary.government = {
          autoApproved: true,
          eligibilityStatus: 'SKIPPED',
          preauthStatus: 'NOT_REQUIRED',
        };
      }

      // 6. Checklist financial items status
      const checklist = await db.admissionChecklist.findFirst({
        where: { tenantId, admissionRequestId: id },
      });
      if (checklist) {
        const items = Array.isArray(checklist.items) ? checklist.items : [];
        const insuranceVerified = items.find((i: any) => i.key === 'insurance_verified');
        const financialApproval = items.find((i: any) => i.key === 'financial_approval');
        summary.checklistStatus = {
          insuranceVerified: insuranceVerified?.completed || false,
          financialApproval: financialApproval?.completed || false,
        };
      }

      // 7. Billing link (if admitted)
      if (request.billingEncounterCoreId) {
        summary.billing = {
          encounterCoreId: request.billingEncounterCoreId,
          payerContextId: request.payerContextId,
        };
      }

      return NextResponse.json(summary);
    } catch (err) {
      logger.error('[admission/requests/[id]/financial-summary] GET error:', err);
      return NextResponse.json({ error: 'Failed to fetch financial summary' }, { status: 500 });
    }
  },
  { permissionKey: 'admission.view' }
);
