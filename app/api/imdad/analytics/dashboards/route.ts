/**
 * SCM BC8 Analytics — Dashboard Configurations
 *
 * GET  /api/imdad/analytics/dashboards — List dashboard configs with pagination, search, filters
 * POST /api/imdad/analytics/dashboards — Create dashboard configuration
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET — List dashboard configurations
// ---------------------------------------------------------------------------

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().optional(),
  organizationId: z.string().uuid().optional(),
  configType: z.string().optional(),
  userId: z.string().uuid().optional(),
  roleType: z.string().optional(),
  isDefault: z.coerce.boolean().optional(),
});

export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    try {
      const url = new URL(req.url);
      const params: Record<string, string> = {};
      url.searchParams.forEach((v, k) => { params[k] = v; });

      const parsed = listQuerySchema.parse(params);
      const { page, limit, search, organizationId, configType, userId, roleType, isDefault } = parsed;

      const where: any = { tenantId, isDeleted: false };
      if (organizationId) where.organizationId = organizationId;
      if (configType) where.configType = configType;
      if (userId) where.userId = userId;
      if (roleType) where.roleType = roleType;
      if (isDefault !== undefined) where.isDefault = isDefault;
      if (search) {
        where.OR = [
          { configName: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [data, total] = await Promise.all([
        prisma.imdadDashboardConfig.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.imdadDashboardConfig.count({ where }),
      ]);

      return NextResponse.json({
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.analytics.dashboards.list' }
);

// ---------------------------------------------------------------------------
// POST — Create dashboard configuration
// ---------------------------------------------------------------------------

const createDashboardSchema = z.object({
  organizationId: z.string().uuid(),
  configName: z.string().min(1).max(200),
  configType: z.string().min(1),
  layout: z.record(z.string(), z.any()),
  widgets: z.array(z.record(z.string(), z.any())),
  roleType: z.string().optional(),
  isDefault: z.boolean().optional(),
  description: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const POST = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const body = await req.json();
      const parsed = createDashboardSchema.parse(body);

      // Duplicate check: configName must be unique within tenant+org
      const existing = await prisma.imdadDashboardConfig.findFirst({
        where: {
          tenantId,
          organizationId: parsed.organizationId,
          configName: parsed.configName,
          isDeleted: false,
        },
      });
      if (existing) {
        return NextResponse.json(
          { error: 'Dashboard configuration with this name already exists in this organization' },
          { status: 409 }
        );
      }

      const dashboard = await prisma.imdadDashboardConfig.create({
        data: {
          tenantId,
          organizationId: parsed.organizationId,
          configName: parsed.configName,
          configType: parsed.configType,
          layout: parsed.layout,
          widgets: parsed.widgets,
          roleType: parsed.roleType,
          isDefault: parsed.isDefault ?? false,
          metadata: parsed.metadata ?? undefined,
          createdBy: userId,
          updatedBy: userId,
        } as any,
      });

      await imdadAudit.log({
        tenantId,
        organizationId: parsed.organizationId,
        actorUserId: userId,
        actorRole: role,
        action: 'CREATE',
        resourceType: 'DASHBOARD_CONFIG',
        resourceId: dashboard.id,
        boundedContext: 'BC8_ANALYTICS',
        newData: dashboard as any,
        request: req,
      });

      return NextResponse.json({ data: dashboard }, { status: 201 });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.analytics.dashboards.create' }
);
