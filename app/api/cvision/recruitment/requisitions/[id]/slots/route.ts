import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Requisition Slots API (PR-B: Position Lifecycle)
 * 
 * GET /api/cvision/recruitment/requisitions/:id/slots
 * Returns list of slots for a requisition
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import {
  getCVisionCollection,
  findById,
  createTenantFilter,
} from '@/lib/cvision/db';
import { CVISION_PERMISSIONS } from '@/lib/cvision/constants';
import type { CVisionJobRequisition, CVisionPositionSlot, CVisionEmployee, CVisionCandidate } from '@/lib/cvision/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET - List slots for a requisition
export const GET = withAuthTenant(
  async (request, { tenantId }, params) => {
    try {
      const resolvedParams = params instanceof Promise ? await params : params || {};
      const requisitionId = resolvedParams?.id as string;

      if (!requisitionId) {
        return NextResponse.json(
          { error: 'Requisition ID is required' },
          { status: 400 }
        );
      }

      // Verify requisition exists
      const requisitionCollection = await getCVisionCollection<CVisionJobRequisition>(
        tenantId,
        'jobRequisitions'
      );
      const requisition = await findById(requisitionCollection, tenantId, requisitionId);
      if (!requisition) {
        return NextResponse.json(
          { error: 'Requisition not found' },
          { status: 404 }
        );
      }

      // Get slots
      const slotCollection = await getCVisionCollection<CVisionPositionSlot>(
        tenantId,
        'positionSlots'
      );
      const slots = await slotCollection
        .find(createTenantFilter(tenantId, { requisitionId }))
        .sort({ createdAt: 1 })
        .toArray();

      // Enrich slots with employee/candidate info
      const employeeCollection = await getCVisionCollection<CVisionEmployee>(
        tenantId,
        'employees'
      );
      const candidateCollection = await getCVisionCollection<CVisionCandidate>(
        tenantId,
        'candidates'
      );

      const enrichedSlots = await Promise.all(
        slots.map(async (slot) => {
          let employee = null;
          let candidate = null;

          if (slot.employeeId) {
            employee = await findById(employeeCollection, tenantId, slot.employeeId);
          }

          // Find candidate linked to this employee
          if (employee) {
            const candidates = await candidateCollection
              .find(createTenantFilter(tenantId, { employeeId: employee.id }))
              .limit(1)
              .toArray();
            candidate = candidates[0] || null;
          }

          return {
            slotId: slot.id,
            status: slot.status,
            employeeId: slot.employeeId,
            employee: employee ? {
              id: employee.id,
              employeeNo: employee.employeeNo,
              fullName: employee.fullName,
            } : null,
            candidateId: candidate?.id || null,
            createdAt: slot.createdAt,
            filledAt: slot.filledAt,
            frozenAt: slot.frozenAt,
            notes: slot.notes,
          };
        })
      );

      return NextResponse.json({
        success: true,
        slots: enrichedSlots,
        summary: {
          total: slots.length,
          vacant: slots.filter(s => s.status === 'VACANT').length,
          filled: slots.filter(s => s.status === 'FILLED').length,
          frozen: slots.filter(s => s.status === 'FROZEN').length,
        },
      });
    } catch (error: any) {
      logger.error('[CVision Requisition Slots GET]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.RECRUITMENT_READ }
);
