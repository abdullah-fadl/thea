import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Profile Schemas API
 * GET /api/cvision/profile-schemas - List all profile schemas (HR_ADMIN+ only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import {
  getCVisionCollection,
  createTenantFilter,
} from '@/lib/cvision/db';
import { CVISION_PERMISSIONS } from '@/lib/cvision/constants';
import { CVISION_ROLES, normalizeRole } from '@/lib/cvision/roles';
import type { CVisionProfileSectionSchema } from '@/lib/cvision/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET - List all profile schemas
export const GET = withAuthTenant(
  async (request, { tenantId, role }) => {
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

      const schemaCollection = await getCVisionCollection<CVisionProfileSectionSchema>(
        tenantId,
        'profileSectionSchemas'
      );

      const schemas = await schemaCollection
        .find(createTenantFilter(tenantId))
        .sort({ sectionKey: 1, version: -1 })
        .toArray();

      return NextResponse.json({
        success: true,
        schemas: schemas.map(s => ({
          id: s.id,
          sectionKey: s.sectionKey,
          version: s.version,
          schemaJson: s.schemaJson,
          isActive: s.isActive,
          createdAt: s.createdAt,
          createdByUserId: s.createdByUserId,
        })),
      });
    } catch (error: any) {
      logger.error('[CVision Profile Schemas GET]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.ORG_WRITE }
);
