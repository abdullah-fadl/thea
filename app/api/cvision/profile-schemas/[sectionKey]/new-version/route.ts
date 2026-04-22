import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Profile Schema Version API
 * POST /api/cvision/profile-schemas/[sectionKey]/new-version - Create a new schema version
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import {
  getCVisionCollection,
  createTenantFilter,
} from '@/lib/cvision/db';
import {
  logCVisionAudit,
  createCVisionAuditContext,
} from '@/lib/cvision/audit';
import { CVISION_PERMISSIONS } from '@/lib/cvision/constants';
import { CVISION_ROLES, normalizeRole } from '@/lib/cvision/roles';
import type { CVisionProfileSectionSchema, ProfileSectionKey } from '@/lib/cvision/types';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const newVersionSchema = z.object({
  schemaJson: z.object({
    fields: z.array(z.object({
      key: z.string(),
      label: z.string(),
      type: z.enum(['text', 'date', 'number', 'select', 'textarea', 'email', 'phone']),
      required: z.boolean().optional(),
      options: z.array(z.string()).optional(),
      validation: z.record(z.string(), z.any()).optional(),
    })),
  }),
});

// POST - Create a new schema version
export const POST = withAuthTenant(
  async (request, { tenantId, userId, role, user }, params) => {
    try {
      // Enforce HR_ADMIN+ only
      const allowedRoles = [
        CVISION_ROLES.CVISION_ADMIN,
        CVISION_ROLES.HR_ADMIN,
      ];

      if (!allowedRoles.map(r => normalizeRole(r)).includes(normalizeRole(role))) {
        return NextResponse.json(
          { error: 'Insufficient permissions. HR_ADMIN+ only.', code: 'FORBIDDEN' },
          { status: 403 }
        );
      }

      const resolvedParams = await params;
      const sectionKey = resolvedParams?.sectionKey as ProfileSectionKey;

      if (!sectionKey || !['PERSONAL', 'EMPLOYMENT', 'FINANCIAL', 'CONTRACT'].includes(sectionKey)) {
        return NextResponse.json(
          { error: 'Invalid section key. Must be PERSONAL, EMPLOYMENT, FINANCIAL, or CONTRACT' },
          { status: 400 }
        );
      }

      const body = await request.json();
      const { schemaJson } = newVersionSchema.parse(body);

      const schemaCollection = await getCVisionCollection<CVisionProfileSectionSchema>(
        tenantId,
        'profileSectionSchemas'
      );

      // Get current active schema to determine next version
      const currentActive = await schemaCollection.findOne(
        createTenantFilter(tenantId, { sectionKey, isActive: true })
      );

      const nextVersion = currentActive ? currentActive.version + 1 : 1;

      // Deactivate current active schema
      if (currentActive) {
        await schemaCollection.updateOne(
          createTenantFilter(tenantId, { id: currentActive.id }),
          {
            $set: {
              isActive: false,
              updatedAt: new Date(),
              updatedBy: userId,
            },
          }
        );
      }

      // Create new active schema version
      const now = new Date();
      const newSchema: CVisionProfileSectionSchema = {
        id: uuidv4(),
        tenantId,
        sectionKey,
        version: nextVersion,
        schemaJson: schemaJson as { fields: Array<{ key: string; label: string; type: 'text' | 'date' | 'number' | 'select' | 'textarea' | 'email' | 'phone'; required?: boolean; options?: string[]; validation?: Record<string, any>; }> },
        isActive: true,
        createdByUserId: userId,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        createdBy: userId,
        updatedBy: userId,
      };

      await schemaCollection.insertOne(newSchema);

      // Audit log
      await logCVisionAudit(
        createCVisionAuditContext({ userId, role, tenantId, user }, request),
        'profile_schema_version_created',
        'profile_schema',
        {
          resourceId: newSchema.id,
          metadata: {
            section: sectionKey,
            version: nextVersion,
            previousVersion: currentActive?.version || null,
          },
        }
      );

      return NextResponse.json({
        success: true,
        schema: {
          id: newSchema.id,
          sectionKey: newSchema.sectionKey,
          version: newSchema.version,
          schemaJson: newSchema.schemaJson,
          isActive: newSchema.isActive,
          createdAt: newSchema.createdAt,
        },
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return NextResponse.json(
          { error: 'Validation error', details: error.errors },
          { status: 400 }
        );
      }
      logger.error('[CVision Profile Schema Version POST]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.ORG_WRITE }
);
