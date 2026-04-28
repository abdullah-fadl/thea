/**
 * SCM Audit Log Query API
 *
 * GET /api/imdad/admin/audit-logs
 *
 * Query SCM audit logs with filters.
 * Supports: resourceType, action, actorUserId, dateRange, pagination.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { imdadAudit } from '@/lib/imdad';
import { z } from 'zod';

const querySchema = z.object({
  organizationId: z.string().uuid().optional(),
  resourceType: z.string().optional(),
  resourceId: z.string().uuid().optional(),
  actorUserId: z.string().uuid().optional(),
  action: z.string().optional(),
  boundedContext: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    try {
      const url = new URL(req.url);
      const params: Record<string, string> = {};
      url.searchParams.forEach((v, k) => { params[k] = v; });

      const parsed = querySchema.parse(params);

      const result = await imdadAudit.query({
        tenantId,
        organizationId: parsed.organizationId,
        resourceType: parsed.resourceType,
        resourceId: parsed.resourceId,
        actorUserId: parsed.actorUserId,
        action: parsed.action as any,
        boundedContext: parsed.boundedContext,
        startDate: parsed.startDate ? new Date(parsed.startDate) : undefined,
        endDate: parsed.endDate ? new Date(parsed.endDate) : undefined,
        page: parsed.page,
        pageSize: parsed.pageSize,
      });

      return NextResponse.json({
        data: result.entries,
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: Math.ceil(result.total / result.pageSize),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: 'Internal Server Error' },
        { status: 500 }
      );
    }
  },
  {
    platformKey: 'imdad',
    permissionKey: 'imdad.audit.view',
  }
);
