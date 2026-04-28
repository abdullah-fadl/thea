import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Public Jobs API
 * GET /api/cvision/public/jobs - Get public job postings
 * 
 * Returns only OPEN job postings. Tenant-scoped via posting.
 * No authentication required.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getCVisionCollection,
  createTenantFilter,
} from '@/lib/cvision/db';
import type {
  CVisionJobPosting,
  CVisionDepartment,
} from '@/lib/cvision/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface PublicJobPosting {
  id: string;
  title: string;
  description: string;
  seoSlug: string;
  departmentName: string;
  departmentCode: string;
  createdAt: string;
}

// GET - Get public job postings (OPEN status only)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Extract tenantId from query param or header
    // In production, this might come from subdomain or domain mapping
    const tenantId =
      searchParams.get('tenantId') ||
      request.headers.get('x-tenant-id') ||
      process.env.DEFAULT_TENANT_ID ||
      'default';
    
    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant ID is required' },
        { status: 400 }
      );
    }

    const postingCollection = await getCVisionCollection<CVisionJobPosting>(
      tenantId,
      'jobPostings'
    );
    const deptCollection = await getCVisionCollection<CVisionDepartment>(
      tenantId,
      'departments'
    );

    // Fetch only OPEN postings
    const filter = {
      ...createTenantFilter(tenantId),
      status: 'OPEN' as const,
    };

    const postings = await postingCollection.find(filter).sort({ createdAt: -1 }).limit(100).toArray();

    // Fetch departments for enrichment
    const deptIds = [...new Set(postings.map((p) => p.departmentId))];
    const departments = await deptCollection
      .find(createTenantFilter(tenantId, { id: { $in: deptIds } }))
      .toArray();

    const deptMap = new Map(departments.map((d) => [d.id, d]));

    // Build public response
    const publicPostings: PublicJobPosting[] = postings.map((posting) => {
      const department = deptMap.get(posting.departmentId);
      return {
        id: posting.id,
        title: posting.title,
        description: posting.description,
        seoSlug: posting.seoSlug,
        departmentName: department?.name || 'Unknown',
        departmentCode: department?.code || 'N/A',
        createdAt: posting.createdAt.toISOString(),
      };
    });

    return NextResponse.json({
      success: true,
      jobs: publicPostings,
      count: publicPostings.length,
    });
  } catch (error: any) {
    logger.error('[CVision Public Jobs GET]', error?.message || String(error));
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
