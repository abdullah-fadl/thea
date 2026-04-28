import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Unit by ID API
 * GET /api/cvision/units/[id] - Get unit
 * PUT /api/cvision/units/[id] - Update unit
 * DELETE /api/cvision/units/[id] - Archive unit (soft delete)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import {
  getCVisionCollection,
  findById,
  softDelete,
  isCodeUnique,
  createTenantFilter,
} from '@/lib/cvision/db';
import {
  logCVisionAudit,
  createCVisionAuditContext,
  computeChanges,
} from '@/lib/cvision/audit';
import { updateUnitSchema } from '@/lib/cvision/validation';
import { CVISION_PERMISSIONS } from '@/lib/cvision/constants';
import type { CVisionUnit } from '@/lib/cvision/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET - Get unit by ID
export const GET = withAuthTenant(
  async (request, { tenantId }, params) => {
    try {
      const resolvedParams = await params;
      const id = resolvedParams?.id as string;

      if (!id) {
        return NextResponse.json(
          { error: 'Unit ID is required' },
          { status: 400 }
        );
      }

      const collection = await getCVisionCollection<CVisionUnit>(
        tenantId,
        'units'
      );

      const unit = await findById(collection, tenantId, id);

      if (!unit) {
        return NextResponse.json(
          { error: 'Unit not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true, unit });
    } catch (error: any) {
      logger.error('[CVision Unit GET]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.ORG_READ }
);

// PUT - Update unit
export const PUT = withAuthTenant(
  async (request, { tenantId, userId, role, user }, params) => {
    try {
      const resolvedParams = await params;
      const id = resolvedParams?.id as string;

      if (!id) {
        return NextResponse.json(
          { error: 'Unit ID is required' },
          { status: 400 }
        );
      }

      const body = await request.json();
      const data = updateUnitSchema.parse(body);

      const collection = await getCVisionCollection<CVisionUnit>(
        tenantId,
        'units'
      );

      const existing = await findById(collection, tenantId, id);
      if (!existing) {
        return NextResponse.json(
          { error: 'Unit not found' },
          { status: 404 }
        );
      }

      // Check code uniqueness if changing
      if (data.code && data.code !== existing.code) {
        const isUnique = await isCodeUnique(collection, tenantId, data.code, id);
        if (!isUnique) {
          return NextResponse.json(
            { error: 'Unit code already exists in this department' },
            { status: 400 }
          );
        }
      }

      // Validate department exists if changing
      if (data.departmentId && data.departmentId !== existing.departmentId) {
        const deptCollection = await getCVisionCollection(tenantId, 'departments');
        const department = await deptCollection.findOne(
          createTenantFilter(tenantId, { id: data.departmentId })
        );
        if (!department) {
          return NextResponse.json(
            { error: 'Department not found' },
            { status: 400 }
          );
        }
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
        'unit_update',
        'unit',
        {
          resourceId: id,
          changes: computeChanges(existing, updated!),
        }
      );

      return NextResponse.json({ success: true, unit: updated });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return NextResponse.json(
          { error: 'Validation error', details: error.errors },
          { status: 400 }
        );
      }
      logger.error('[CVision Unit PUT]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.ORG_WRITE }
);

// PATCH - Alias for PUT (REST compliance)
export const PATCH = PUT;

// DELETE - Archive unit (soft delete)
export const DELETE = withAuthTenant(
  async (request, { tenantId, userId, role, user }, params) => {
    try {
      const resolvedParams = await params;
      const id = resolvedParams?.id as string;

      if (!id) {
        return NextResponse.json(
          { error: 'Unit ID is required' },
          { status: 400 }
        );
      }

      const collection = await getCVisionCollection<CVisionUnit>(
        tenantId,
        'units'
      );

      const existing = await findById(collection, tenantId, id);
      if (!existing) {
        return NextResponse.json(
          { error: 'Unit not found' },
          { status: 404 }
        );
      }

      // Check for employees in this unit
      const empCollection = await getCVisionCollection(tenantId, 'employees');
      const hasEmployees = await empCollection.findOne(
        createTenantFilter(tenantId, { unitId: id })
      );
      if (hasEmployees) {
        return NextResponse.json(
          { error: 'Cannot archive unit with assigned employees' },
          { status: 400 }
        );
      }

      const success = await softDelete(collection, tenantId, id, userId);

      if (!success) {
        return NextResponse.json(
          { error: 'Failed to archive unit' },
          { status: 500 }
        );
      }

      // Audit log
      await logCVisionAudit(
        createCVisionAuditContext({ userId, role, tenantId, user }, request),
        'unit_archive',
        'unit',
        { resourceId: id }
      );

      return NextResponse.json({ success: true });
    } catch (error: any) {
      logger.error('[CVision Unit DELETE]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.ORG_WRITE }
);
