import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Job Title Detail API
 * PATCH /api/cvision/job-titles/:id - Update job title
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
import { updateJobTitleSchema } from '@/lib/cvision/validation';
import { CVISION_PERMISSIONS } from '@/lib/cvision/constants';
import type { CVisionJobTitle } from '@/lib/cvision/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// PATCH - Update job title
export const PATCH = withAuthTenant(
  async (request, { tenantId, userId, role, user }, params) => {
    try {
      const resolvedParams = await params;
      const id = resolvedParams?.id as string;

      if (!id) {
        return NextResponse.json(
          { error: 'Job title ID is required' },
          { status: 400 }
        );
      }

      const body = await request.json();
      const data = updateJobTitleSchema.parse(body);

      const collection = await getCVisionCollection<CVisionJobTitle>(
        tenantId,
        'jobTitles'
      );

      const existing = await findById(collection, tenantId, id);
      if (!existing) {
        return NextResponse.json(
          { error: 'Job title not found' },
          { status: 404 }
        );
      }

      const updateData: any = {
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
        'job_title_update',
        'job_title',
        {
          resourceId: id,
          changes: {
            before: existing,
            after: updated,
          },
        }
      );

      return NextResponse.json({ success: true, jobTitle: updated });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return NextResponse.json(
          { error: 'Validation error', details: error.errors },
          { status: 400 }
        );
      }
      logger.error('[CVision Job Title PATCH]', error?.message || String(error));
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
