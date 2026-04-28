import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Grade Detail API
 * GET /api/cvision/grades/:id - Get grade
 * PATCH /api/cvision/grades/:id - Update grade
 * PUT /api/cvision/grades/:id - Update grade (alias)
 * DELETE /api/cvision/grades/:id - Archive grade (soft delete)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import {
  getCVisionCollection,
  createTenantFilter,
  findById,
  softDelete,
} from '@/lib/cvision/db';
import {
  logCVisionAudit,
  createCVisionAuditContext,
} from '@/lib/cvision/audit';
import { updateGradeSchema } from '@/lib/cvision/validation';
import { CVISION_PERMISSIONS } from '@/lib/cvision/constants';
import type { CVisionGrade } from '@/lib/cvision/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET - Get grade by ID
export const GET = withAuthTenant(
  async (request, { tenantId }, params) => {
    try {
      const resolvedParams = await params;
      const id = resolvedParams?.id as string;

      if (!id) {
        return NextResponse.json(
          { error: 'Grade ID is required' },
          { status: 400 }
        );
      }

      const collection = await getCVisionCollection<CVisionGrade>(
        tenantId,
        'grades'
      );

      const grade = await findById(collection, tenantId, id);

      if (!grade) {
        return NextResponse.json(
          { error: 'Grade not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true, grade });
    } catch (error: any) {
      logger.error('[CVision Grade GET]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.ORG_READ }
);

// PATCH - Update grade
export const PATCH = withAuthTenant(
  async (request, { tenantId, userId, role, user }, params) => {
    try {
      const resolvedParams = await params;
      const id = resolvedParams?.id as string;

      if (!id) {
        return NextResponse.json(
          { error: 'Grade ID is required' },
          { status: 400 }
        );
      }

      const body = await request.json();
      const data = updateGradeSchema.parse(body);

      const collection = await getCVisionCollection<CVisionGrade>(
        tenantId,
        'grades'
      );

      const existing = await findById(collection, tenantId, id);
      if (!existing) {
        return NextResponse.json(
          { error: 'Grade not found' },
          { status: 404 }
        );
      }

      const updateData: any = {
        ...data,
        updatedAt: new Date(),
        updatedBy: userId,
      };

      // Handle adding jobTitleId to jobTitleIds array (many-to-many support)
      if (data.jobTitleId && !data.jobTitleIds) {
        // Merge existing jobTitleIds with legacy jobTitleId and the new one
        const existingIds = new Set<string>();

        // Add from existing jobTitleIds array
        if (existing.jobTitleIds && Array.isArray(existing.jobTitleIds)) {
          existing.jobTitleIds.forEach((id: string) => existingIds.add(id));
        }

        // Add legacy jobTitleId if it exists
        if (existing.jobTitleId) {
          existingIds.add(existing.jobTitleId);
        }

        // Add the new jobTitleId
        existingIds.add(data.jobTitleId);

        updateData.jobTitleIds = Array.from(existingIds);
      }

      await collection.updateOne(
        createTenantFilter(tenantId, { id }),
        { $set: updateData }
      );

      const updated = await findById(collection, tenantId, id);

      // Audit log
      await logCVisionAudit(
        createCVisionAuditContext({ userId, role, tenantId, user }, request),
        'grade_update',
        'grade',
        {
          resourceId: id,
          changes: {
            before: existing,
            after: updated,
          },
        }
      );

      return NextResponse.json({ success: true, grade: updated });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return NextResponse.json(
          { error: 'Validation error', details: error.errors },
          { status: 400 }
        );
      }
      logger.error('[CVision Grade PATCH]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.CONFIG_WRITE }
);

// PUT - Alias for PATCH (backward compatibility)
export const PUT = PATCH;

// DELETE - Archive grade (soft delete)
export const DELETE = withAuthTenant(
  async (request, { tenantId, userId, role, user }, params) => {
    try {
      const resolvedParams = await params;
      const id = resolvedParams?.id as string;

      if (!id) {
        return NextResponse.json(
          { error: 'Grade ID is required' },
          { status: 400 }
        );
      }

      const collection = await getCVisionCollection<CVisionGrade>(
        tenantId,
        'grades'
      );

      const existing = await findById(collection, tenantId, id);
      if (!existing) {
        return NextResponse.json(
          { error: 'Grade not found' },
          { status: 404 }
        );
      }

      const success = await softDelete(collection, tenantId, id, userId);

      if (!success) {
        return NextResponse.json(
          { error: 'Failed to archive grade' },
          { status: 500 }
        );
      }

      // Audit log
      await logCVisionAudit(
        createCVisionAuditContext({ userId, role, tenantId, user }, request),
        'grade_archive' as any,
        'grade',
        { resourceId: id }
      );

      return NextResponse.json({ success: true });
    } catch (error: any) {
      logger.error('[CVision Grade DELETE]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.CONFIG_WRITE }
);
