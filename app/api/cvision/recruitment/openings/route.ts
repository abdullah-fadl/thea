import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Job Openings API (alias for requisitions)
 * GET /api/cvision/recruitment/openings - List open requisitions
 *
 * This route is an alias that the frontend uses for fetching job openings.
 * It proxies to the requisitions collection with a simpler response shape.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import {
  getCVisionCollection,
  createTenantFilter,
} from '@/lib/cvision/db';
import type { CVisionJobRequisition } from '@/lib/cvision/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  async (request, { tenantId }) => {
    try {
      const { searchParams } = new URL(request.url);
      const statusParam = searchParams.get('status') || 'open';
      const limitParam = parseInt(searchParams.get('limit') || '200', 10);
      const limit = Math.min(limitParam, 500);

      const collection = await getCVisionCollection<CVisionJobRequisition>(
        tenantId,
        'jobRequisitions'
      );

      // Accept multiple valid "open" statuses (case-insensitive) so all
      // available positions show up regardless of how they were created.
      const openStatuses = ['open', 'approved', 'active', 'published'];
      const statusFilter = statusParam === 'all'
        ? {}
        : openStatuses.includes(statusParam.toLowerCase())
          ? { status: { $regex: new RegExp(`^(${openStatuses.join('|')})$`, 'i') } }
          : { status: { $regex: new RegExp(`^${statusParam.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } };

      const filter = createTenantFilter(tenantId, {
        ...statusFilter,
        isArchived: { $ne: true },
        deletedAt: { $exists: false },
      });

      const requisitions = await collection
        .find(filter)
        .sort({ createdAt: -1 })
        .limit(limit)
        .toArray();

      // Enrich with department names
      const deptCol = await getCVisionCollection(tenantId, 'departments');
      const departments = await deptCol
        .find(createTenantFilter(tenantId))
        .limit(500)
        .toArray();
      const deptMap: Record<string, string> = {};
      for (const d of departments) {
        deptMap[(d as Record<string, string>).id] = (d as Record<string, string>).name || (d as Record<string, string>).id;
      }

      const items = requisitions.map((r) => ({
        id: r.id,
        title: r.title,
        department: r.departmentId ? deptMap[r.departmentId] || r.departmentId : '',
        departmentName: r.departmentId ? deptMap[r.departmentId] || r.departmentId : '',
        departmentId: r.departmentId,
        status: r.status,
        headcount: r.headcountRequested || (r as Record<string, unknown>).headcount || 1,
        applicantCount: r.applicantCount || 0,
        createdAt: r.createdAt,
      }));

      return NextResponse.json({
        success: true,
        data: items,
        items,
        total: items.length,
      });
    } catch (error: any) {
      logger.error('[CVision Openings GET] Error:', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: 'cvision.recruitment.read' }
);
