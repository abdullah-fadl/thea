import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Payroll Loan API
 * PATCH /api/cvision/payroll/loans/:id - Update loan
 * DELETE /api/cvision/payroll/loans/:id - Cancel loan
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import {
  getCVisionCollection,
  createTenantFilter,
  findById,
} from '@/lib/cvision/db';
import {
  logCVisionAudit,
  createCVisionAuditContext,
} from '@/lib/cvision/audit';
import { CVISION_PERMISSIONS } from '@/lib/cvision/constants';
import type { CVisionLoan } from '@/lib/cvision/types';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const updateLoanSchema = z.object({
  status: z.enum(['ACTIVE', 'PAID_OFF', 'CANCELLED']).optional(),
  monthlyInstalment: z.number().min(1).optional(),
  reason: z.string().optional(),
  startDate: z.string().optional(),
  paymentAmount: z.number().min(0).optional(), // For recording a payment
});

// PATCH - Update loan
export const PATCH = withAuthTenant(
  async (request, { tenantId, userId, role, user }, params) => {
    try {
      const resolvedParams = await params;
      const loanId = resolvedParams?.id as string;

      if (!loanId) {
        return NextResponse.json(
          { error: 'Loan ID is required' },
          { status: 400 }
        );
      }

      const body = await request.json();
      const data = updateLoanSchema.parse(body);

      const collection = await getCVisionCollection<CVisionLoan>(
        tenantId,
        'loans'
      );

      const existing = await findById(collection, tenantId, loanId);
      if (!existing) {
        return NextResponse.json(
          { error: 'Loan not found' },
          { status: 404 }
        );
      }

      const updateData: any = {
        updatedAt: new Date(),
        updatedBy: userId,
      };

      // Handle status change
      if (data.status !== undefined) {
        updateData.status = data.status;

        // If activating, set start date if not set
        if (data.status === 'ACTIVE' && !existing.startDate) {
          updateData.startDate = new Date();
        }

        // If paid off or cancelling, set end date
        if (data.status === 'PAID_OFF' || data.status === 'CANCELLED') {
          updateData.endDate = new Date();
        }
      }

      // Handle payment recording
      if (data.paymentAmount !== undefined && data.paymentAmount > 0) {
        const currentRemaining = existing.remaining || existing.principal || 0;
        const newRemaining = Math.max(0, currentRemaining - data.paymentAmount);
        updateData.remaining = newRemaining;

        // Auto-complete if fully paid
        if (newRemaining === 0) {
          updateData.status = 'paid_off';
          updateData.endDate = new Date();
        }
      }

      if (data.monthlyInstalment !== undefined) {
        updateData.monthlyDeduction = data.monthlyInstalment;
      }

      if (data.reason !== undefined) {
        updateData.reason = data.reason;
      }

      if (data.startDate !== undefined) {
        updateData.startDate = new Date(data.startDate);
      }

      await collection.updateOne(
        createTenantFilter(tenantId, { id: loanId }),
        { $set: updateData }
      );

      // Audit log
      await logCVisionAudit(
        createCVisionAuditContext({ userId, role: role || 'unknown', tenantId, user }, request),
        'loan_update',
        'LOAN',
        {
          resourceId: loanId,
          changes: {
            before: {
              status: existing.status,
              remaining: existing.remaining,
              monthlyDeduction: existing.monthlyDeduction,
            },
            after: updateData,
          },
        }
      );

      return NextResponse.json({
        success: true,
        loan: { ...existing, ...updateData },
      });
    } catch (error: any) {
      logger.error('[CVision Loan PATCH]', error?.message || String(error));
      if (error.name === 'ZodError') {
        return NextResponse.json(
          { error: 'Validation error', details: error.errors },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.PAYROLL_WRITE }
);

// DELETE - Cancel loan (soft delete)
export const DELETE = withAuthTenant(
  async (request, { tenantId, userId, role, user }, params) => {
    try {
      const resolvedParams = await params;
      const loanId = resolvedParams?.id as string;

      if (!loanId) {
        return NextResponse.json(
          { error: 'Loan ID is required' },
          { status: 400 }
        );
      }

      const collection = await getCVisionCollection<CVisionLoan>(
        tenantId,
        'loans'
      );

      const existing = await findById(collection, tenantId, loanId);
      if (!existing) {
        return NextResponse.json(
          { error: 'Loan not found' },
          { status: 404 }
        );
      }

      // Cannot cancel paid off loans
      if (existing.status === 'paid_off') {
        return NextResponse.json(
          { error: 'Cannot cancel a paid off loan' },
          { status: 400 }
        );
      }

      await collection.updateOne(
        createTenantFilter(tenantId, { id: loanId }),
        {
          $set: {
            status: 'cancelled',
            isArchived: true,
            endDate: new Date(),
            updatedAt: new Date(),
            updatedBy: userId,
          },
        }
      );

      // Audit log
      await logCVisionAudit(
        createCVisionAuditContext({ userId, role: role || 'unknown', tenantId, user }, request),
        'loan_cancel',
        'LOAN',
        {
          resourceId: loanId,
          metadata: {
            employeeId: existing.employeeId,
            principal: existing.principal,
            remaining: existing.remaining,
          },
        }
      );

      return NextResponse.json({
        success: true,
        message: 'Loan cancelled',
      });
    } catch (error: any) {
      logger.error('[CVision Loan DELETE]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.PAYROLL_WRITE }
);
