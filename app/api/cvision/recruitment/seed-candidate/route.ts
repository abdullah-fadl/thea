import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Seed Candidate Helper API (Dev Only)
 * POST /api/cvision/recruitment/seed-candidate
 * 
 * Creates a test candidate linked to first requisition for testing CV upload.
 * Dev-only endpoint.
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/cvision/infra';
import {
  getCVisionCollection,
  createTenantFilter,
} from '@/lib/cvision/db';
import { CVISION_PERMISSIONS } from '@/lib/cvision/constants';
import type {
  CVisionJobRequisition,
  CVisionCandidate,
} from '@/lib/cvision/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// POST - Create seed candidate
export const POST = withAuthTenant(
  async (request, { tenantId, userId, role, user }) => {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'This endpoint is only available in development' },
        { status: 403 }
      );
    }

    try {
      const requisitionCollection = await getCVisionCollection<CVisionJobRequisition>(
        tenantId,
        'jobRequisitions'
      );

      // Find first requisition
      const requisition = await requisitionCollection
        .findOne(createTenantFilter(tenantId, { isArchived: { $ne: true } }));

      if (!requisition) {
        return NextResponse.json(
          { error: 'No requisitions found. Create a requisition first.' },
          { status: 404 }
        );
      }

      const candidateCollection = await getCVisionCollection<CVisionCandidate>(
        tenantId,
        'candidates'
      );

      // Check if seed candidate already exists
      const existingCandidate = await candidateCollection.findOne(
        createTenantFilter(tenantId, {
          requisitionId: requisition.id,
          email: 'ahmed.ali.seed@example.com',
        })
      );

      if (existingCandidate) {
        return NextResponse.json({
          success: true,
          candidate: existingCandidate,
          message: 'Seed candidate already exists',
        });
      }

      const now = new Date();
      const candidate: CVisionCandidate = {
        id: uuidv4(),
        tenantId,
        requisitionId: requisition.id,
        fullName: 'Ahmed Ali (Seed)',
        email: 'ahmed.ali.seed@example.com',
        phone: '+966501234567',
        source: 'PORTAL',
        status: 'applied',
        statusChangedAt: now,
        statusReason: null,
        screeningScore: null,
        notes: 'Seed candidate for testing CV upload',
        screenedBy: null,
        screenedAt: null,
        interviews: null,
        offerExtendedAt: null,
        offerAmount: null,
        offerCurrency: null,
        offerStatus: null,
        offerResponseAt: null,
        hiredAt: null,
        employeeId: null,
        isArchived: false,
        metadata: null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        createdBy: userId,
        updatedBy: userId,
      };

      await candidateCollection.insertOne(candidate);

      // Update applicant count
      await requisitionCollection.updateOne(
        createTenantFilter(tenantId, { id: requisition.id }),
        { $inc: { applicantCount: 1 } }
      );

      logger.info('[CVision Seed Candidate] Created:', {
        tenantId,
        requisitionId: requisition.id,
        candidateId: candidate.id,
      });

      return NextResponse.json({
        success: true,
        candidate,
        requisition: {
          id: requisition.id,
          requisitionNumber: requisition.requisitionNumber,
        },
      });
    } catch (error: any) {
      logger.error('[CVision Seed Candidate POST]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.RECRUITMENT_WRITE }
);
