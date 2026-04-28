import { logger } from '@/lib/monitoring/logger';
import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { admissionDepositSchema } from '@/lib/validation/admission.schema';
import { autoCompleteChecklistItem } from '@/lib/admission/checklistHelper';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// POST /api/admission/requests/[id]/collect-deposit
export const POST = withAuthTenant(
  async (req: NextRequest, { tenantId, userId }: { tenantId: string; userId: string }) => {
    try {
      const segments = req.nextUrl.pathname.split('/');
      const id = segments[segments.indexOf('requests') + 1] || '';

      const body = await req.json();
      const parsed = admissionDepositSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
          { status: 400 }
        );
      }

      const { method, amount, reference, currency } = parsed.data;

      // 1. Fetch admission request
      const request = await prisma.admissionRequest.findFirst({
        where: { tenantId, id },
      });
      if (!request) {
        return NextResponse.json({ error: 'Admission request not found' }, { status: 404 });
      }

      // Only allow deposit for CASH patients (and not already admitted/cancelled)
      if (request.paymentType !== 'CASH') {
        return NextResponse.json({ error: 'Deposits are only for cash patients' }, { status: 400 });
      }
      if (['ADMITTED', 'CANCELLED'].includes(request.status)) {
        return NextResponse.json(
          { error: `Cannot collect deposit when status is '${request.status}'` },
          { status: 409 }
        );
      }

      const now = new Date();

      // 2. Generate deposit receipt number
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
      const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
      const depositReceiptNumber = `DEP-${dateStr}-${randomSuffix}`;

      // 3. Map method to BillingPayment method format
      const paymentMethodMap: Record<string, string> = {
        CASH: 'CASH',
        CARD: 'CREDIT_CARD',
        BANK_TRANSFER: 'BANK_TRANSFER',
      };

      // 4. Create BillingPayment record
      // Note: encounterCoreId is null for now — will be linked when patient is admitted
      const payment = await prisma.billingPayment.create({
        data: {
          tenantId,
          invoiceId: null,
          encounterCoreId: null, // Linked at admission time
          method: paymentMethodMap[method] || method,
          amount,
          currency: currency || 'SAR',
          reference: reference || depositReceiptNumber,
          status: 'RECORDED',
          note: `Admission deposit for request ${id}`,
          createdByUserId: userId,
          createdAt: now,
        } as any,
      });

      // 5. Calculate total deposit collected (in case of multiple deposits)
      const previousDeposit = Number(request.depositCollected) || 0;
      const totalDeposited = previousDeposit + amount;

      // 6. Update admission request
      await prisma.admissionRequest.update({
        where: { id },
        data: {
          depositCollected: totalDeposited,
          depositPaymentId: payment.id,
          depositMethod: method,
          depositReceiptNumber,
          depositCollectedAt: now,
          updatedByUserId: userId,
        },
      });

      // 7. Auto-complete financial_approval if deposit meets requirement
      const depositRequired = Number(request.depositRequired) || 0;
      if (depositRequired > 0 && totalDeposited >= depositRequired) {
        await autoCompleteChecklistItem(
          tenantId,
          id,
          'financial_approval',
          userId,
          `Deposit collected: ${totalDeposited} ${currency || 'SAR'} (required: ${depositRequired})`
        );
      }

      // 8. Build receipt data (compatible with ReceiptPreview component)
      const receiptData = {
        receiptNumber: depositReceiptNumber,
        date: now.toISOString(),
        patient: {
          name: request.patientName,
          mrn: request.mrn || '',
        },
        items: [
          {
            description: 'Admission Deposit',
            descriptionAr: 'إيداع قبول',
            amount,
          },
        ],
        subtotal: amount,
        tax: 0,
        total: amount,
        paymentMethod: method,
        reference: reference || '',
        currency: currency || 'SAR',
      };

      return NextResponse.json({
        success: true,
        paymentId: payment.id,
        receiptNumber: depositReceiptNumber,
        totalDeposited,
        depositRequired,
        meetsRequirement: depositRequired > 0 ? totalDeposited >= depositRequired : true,
        receipt: receiptData,
      }, { status: 201 });
    } catch (err) {
      logger.error('[admission/requests/[id]/collect-deposit] POST error:', err);
      return NextResponse.json({ error: 'Failed to collect deposit' }, { status: 500 });
    }
  },
  { permissionKey: 'admission.collect_payment' }
);
