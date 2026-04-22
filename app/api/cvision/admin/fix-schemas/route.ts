import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Admin: Fix Profile Schemas
 * POST /api/cvision/admin/fix-schemas - Reset EMPLOYMENT schema to default
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionCollection, createTenantFilter } from '@/lib/cvision/db';
import { CVISION_PERMISSIONS } from '@/lib/cvision/constants';
import type { CVisionProfileSectionSchema, ProfileSectionKey, ProfileFieldDefinition } from '@/lib/cvision/types';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

const DEFAULT_EMPLOYMENT_FIELDS: ProfileFieldDefinition[] = [
  { key: 'departmentId', label: 'Department', type: 'select', required: true, source: 'departments' },
  { key: 'positionId', label: 'Position', type: 'select', required: false, source: 'departmentPositions', dependsOn: 'departmentId' },
  { key: 'jobTitleId', label: 'Job Title', type: 'select', required: true },
  { key: 'managerEmployeeId', label: 'Manager', type: 'select' },
  { key: 'hiredAt', label: 'Hire Date', type: 'date' },
];

export const POST = withAuthTenant(
  async (request, { tenantId, userId }) => {
    try {
      const schemaCollection = await getCVisionCollection<CVisionProfileSectionSchema>(
        tenantId,
        'profileSectionSchemas'
      );

      // Find existing EMPLOYMENT schema
      const existing = await schemaCollection.findOne(
        createTenantFilter(tenantId, { sectionKey: 'EMPLOYMENT', isActive: true })
      );

      const now = new Date();

      if (existing) {
        // Log current state
        const currentFields = existing.schemaJson?.fields || [];
        logger.info('[Fix Schemas] Current EMPLOYMENT fields:', currentFields.map((f: any) => f.key));

        // Update with correct fields
        await schemaCollection.updateOne(
          createTenantFilter(tenantId, { id: existing.id }),
          {
            $set: {
              'schemaJson.fields': DEFAULT_EMPLOYMENT_FIELDS,
              updatedAt: now,
              updatedBy: userId,
            },
          }
        );

        return NextResponse.json({
          success: true,
          message: 'EMPLOYMENT schema updated',
          before: currentFields.map((f: any) => f.key),
          after: DEFAULT_EMPLOYMENT_FIELDS.map(f => f.key),
        });
      } else {
        // Create new schema
        const schema: CVisionProfileSectionSchema = {
          id: uuidv4(),
          tenantId,
          sectionKey: 'EMPLOYMENT' as ProfileSectionKey,
          version: 1,
          schemaJson: { fields: DEFAULT_EMPLOYMENT_FIELDS },
          isActive: true,
          createdAt: now,
          updatedAt: now,
          createdBy: userId,
          updatedBy: userId,
          createdByUserId: userId,
        };

        await schemaCollection.insertOne(schema);

        return NextResponse.json({
          success: true,
          message: 'EMPLOYMENT schema created',
          fields: DEFAULT_EMPLOYMENT_FIELDS.map(f => f.key),
        });
      }
    } catch (error: any) {
      logger.error('[Fix Schemas]', error);
      return NextResponse.json(
        { error: 'Failed to fix schemas', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.ORG_WRITE }
);
