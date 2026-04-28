import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Request by ID API
 * GET /api/cvision/requests/[id] - Get request
 * PUT /api/cvision/requests/[id] - Update request
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import {
  getCVisionCollection,
  findById,
  createTenantFilter,
} from '@/lib/cvision/db';
import {
  logCVisionAudit,
  createCVisionAuditContext,
  computeChanges,
} from '@/lib/cvision/audit';
import { updateRequestSchema, reviewRequestSchema } from '@/lib/cvision/validation';
import { CVISION_PERMISSIONS, REQUEST_STATUS_TRANSITIONS } from '@/lib/cvision/constants';
import type { CVisionRequest, RequestStatus } from '@/lib/cvision/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET - Get request by ID (includes timeline events)
export const GET = withAuthTenant(
  async (request, { tenantId, role, user }, params) => {
    try {
      const resolvedParams = await params;
      const id = resolvedParams?.id as string;
      const { searchParams } = new URL(request.url);
      const includeEvents = searchParams.get('includeEvents') !== 'false';

      if (!id) {
        return NextResponse.json(
          { error: 'Request ID is required' },
          { status: 400 }
        );
      }

      const collection = await getCVisionCollection<CVisionRequest>(
        tenantId,
        'requests'
      );

      const requestDoc = await findById(collection, tenantId, id);

      if (!requestDoc) {
        return NextResponse.json(
          { error: 'Request not found' },
          { status: 404 }
        );
      }

      // Department-based access control for non-HR roles
      if ((role === 'supervisor' || role === 'manager') && user.department) {
        if (requestDoc.departmentId !== user.department) {
          return NextResponse.json(
            { error: 'Access denied' },
            { status: 403 }
          );
        }
        // Managers cannot see confidential/anonymous requests
        if (requestDoc.confidentiality !== 'normal') {
          return NextResponse.json(
            { error: 'Access denied to confidential request' },
            { status: 403 }
          );
        }
      }

      // Fetch events/timeline if requested
      let events: any[] = [];
      if (includeEvents) {
        const eventCollection = await getCVisionCollection<any>(
          tenantId,
          'requestEvents'
        );
        events = await eventCollection
          .find(createTenantFilter(tenantId, { requestId: id }))
          .sort({ createdAt: 1 })
          .toArray();
      }

      return NextResponse.json({
        success: true,
        request: requestDoc,
        events,
      });
    } catch (error: any) {
      logger.error('[CVision Request GET]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.REQUESTS_READ }
);

// PUT - Update request
export const PUT = withAuthTenant(
  async (request, { tenantId, userId, role, user }, params) => {
    try {
      const resolvedParams = await params;
      const id = resolvedParams?.id as string;

      if (!id) {
        return NextResponse.json(
          { error: 'Request ID is required' },
          { status: 400 }
        );
      }

      const body = await request.json();
      
      const collection = await getCVisionCollection<CVisionRequest>(
        tenantId,
        'requests'
      );

      const existing = await findById(collection, tenantId, id);
      if (!existing) {
        return NextResponse.json(
          { error: 'Request not found' },
          { status: 404 }
        );
      }

      // Check if this is a review action (approve/reject)
      if (body.status && ['approved', 'rejected'].includes(body.status)) {
        const reviewData = reviewRequestSchema.parse(body);
        
        // Validate status transition
        const allowedTransitions = REQUEST_STATUS_TRANSITIONS[existing.status] || [];
        if (!allowedTransitions.includes(reviewData.status)) {
          return NextResponse.json(
            {
              error: 'Invalid status transition',
              message: `Cannot transition from '${existing.status}' to '${reviewData.status}'`,
            },
            { status: 400 }
          );
        }

        const now = new Date();
        const updateData: Partial<CVisionRequest> = {
          status: reviewData.status as RequestStatus,
          statusChangedAt: now,
          statusReason: reviewData.reason,
          updatedAt: now,
          updatedBy: userId,
        };

        if (reviewData.status === 'approved' && reviewData.resolution) {
          updateData.resolution = reviewData.resolution;
          updateData.resolvedAt = now;
        }

        await collection.updateOne(
          createTenantFilter(tenantId, { id }),
          { $set: updateData }
        );

        // Audit log
        await logCVisionAudit(
          createCVisionAuditContext({ userId, role, tenantId, user }, request),
          reviewData.status === 'approved' ? 'request_approve' : 'request_reject',
          'request',
          {
            resourceId: id,
            changes: {
              before: { status: existing.status },
              after: { status: reviewData.status },
            },
          }
        );

        const updated = await findById(collection, tenantId, id);
        return NextResponse.json({ success: true, request: updated });
      }

      // Regular update
      const data = updateRequestSchema.parse(body);

      // Can only update draft or submitted requests
      if (!['draft', 'submitted'].includes(existing.status)) {
        return NextResponse.json(
          { error: 'Cannot update request in current status' },
          { status: 400 }
        );
      }

      const updateData = {
        ...data,
        updatedAt: new Date(),
        updatedBy: userId,
      };

      await collection.updateOne(
        createTenantFilter(tenantId, { id }),
        { $set: updateData }
      );

      const updated = await findById(collection, tenantId, id);

      // Audit log
      await logCVisionAudit(
        createCVisionAuditContext({ userId, role, tenantId, user }, request),
        'request_update',
        'request',
        {
          resourceId: id,
          changes: computeChanges(existing, updated!),
        }
      );

      return NextResponse.json({ success: true, request: updated });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return NextResponse.json(
          { error: 'Validation error', details: error.errors },
          { status: 400 }
        );
      }
      logger.error('[CVision Request PUT]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.REQUESTS_WRITE }
);
