import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Organization Job Titles API
 * 
 * GET /api/cvision/org/job-titles - List job titles
 * 
 * Query params:
 * - departmentId (optional): Filter by department ID
 * - limit (optional): Limit results
 * 
 * Response shape: { items: T[], total: n } (consistent across app)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import {
  getCVisionCollection,
  paginatedList,
} from '@/lib/cvision/db';
import { CVISION_PERMISSIONS } from '@/lib/cvision/constants';
import type { CVisionJobTitle } from '@/lib/cvision/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET - List job titles
export const GET = withAuthTenant(
  async (request, { tenantId }) => {
    try {
      const { searchParams } = new URL(request.url);
      
      // Parse pagination params
      const limit = searchParams.get('limit');
      const page = searchParams.get('page');
      const search = searchParams.get('search');
      const sortBy = searchParams.get('sortBy') || 'name';
      const sortOrder = searchParams.get('sortOrder') || 'asc';
      
      const params = {
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 1000,
        search: search || undefined,
        sortBy,
        sortOrder: (sortOrder === 'desc' ? 'desc' : 'asc') as 'asc' | 'desc',
        includeDeleted: false,
      };

      // Get departmentId filter
      const departmentId = searchParams.get('departmentId');
      
      // Get collection with error handling
      let collection;
      try {
        collection = await getCVisionCollection<CVisionJobTitle>(
          tenantId,
          'jobTitles'
        );
      } catch (dbError: any) {
        logger.error('[CVision Org Job Titles GET] Failed to get collection', {
          tenantId,
          error: dbError.message || String(dbError),
          stack: dbError.stack,
        });
        return NextResponse.json(
          { 
            error: { 
              message: dbError.message || 'Failed to connect to database',
              code: 'DATABASE_ERROR' 
            }
          },
          { status: 500 }
        );
      }

      // Build filter
      const additionalFilter: Record<string, any> = {};
      if (departmentId) {
        additionalFilter.departmentId = departmentId;
      }

      // Execute query with error handling
      let result;
      try {
        result = await paginatedList(
          collection,
          tenantId,
          params,
          Object.keys(additionalFilter).length > 0 ? additionalFilter : undefined
        );
      } catch (dbError: any) {
        logger.error('[CVision Org Job Titles GET] Database query error', {
          tenantId,
          departmentId,
          error: dbError.message || String(dbError),
          stack: dbError.stack,
        });
        return NextResponse.json(
          { 
            error: { 
              message: dbError.message || 'Failed to query job titles',
              code: 'DATABASE_ERROR' 
            }
          },
          { status: 500 }
        );
      }

      // Return consistent response shape
      return NextResponse.json({
        items: result.data || [],
        total: result.total || 0,
      });
    } catch (error: any) {
      logger.error('[CVision Org Job Titles GET] Unexpected error:', error?.message || String(error), error?.stack);
      return NextResponse.json(
        { 
          error: { 
            message: error.message || 'Internal server error',
            code: 'INTERNAL_ERROR' 
          }
        },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.ORG_READ }
);
