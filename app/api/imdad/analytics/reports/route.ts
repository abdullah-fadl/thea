/**
 * SCM BC8 Analytics — Report Definitions
 *
 * GET  /api/imdad/analytics/reports — List report definitions with pagination, search, filters
 * POST /api/imdad/analytics/reports — Create report definition
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET — List report definitions
// ---------------------------------------------------------------------------

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().optional(),
  organizationId: z.string().uuid().optional(),
  reportCategory: z.string().optional(),
  isScheduled: z.coerce.boolean().optional(),
  isSystem: z.coerce.boolean().optional(),
  isActive: z.coerce.boolean().optional(),
});

export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    try {
      const url = new URL(req.url);
      const params: Record<string, string> = {};
      url.searchParams.forEach((v, k) => { params[k] = v; });

      const parsed = listQuerySchema.parse(params);
      const { page, limit, search, organizationId, reportCategory, isScheduled, isSystem, isActive } = parsed;

      const where: any = { tenantId, isDeleted: false };
      if (organizationId) where.organizationId = organizationId;
      if (reportCategory) where.reportCategory = reportCategory;
      if (isScheduled !== undefined) where.isScheduled = isScheduled;
      if (isSystem !== undefined) where.isSystem = isSystem;
      if (isActive !== undefined) where.isActive = isActive;
      if (search) {
        where.OR = [
          { reportCode: { contains: search, mode: 'insensitive' } },
          { reportName: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [data, total] = await Promise.all([
        prisma.imdadReportDefinition.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.imdadReportDefinition.count({ where }),
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
  { platformKey: 'imdad', permissionKey: 'imdad.analytics.reports.list' }
);

// ---------------------------------------------------------------------------
// POST — Create report definition
// ---------------------------------------------------------------------------

const createReportSchema = z.object({
  organizationId: z.string().uuid(),
  reportCode: z.string().min(1).max(50),
  reportName: z.string().min(1).max(200),
  reportCategory: z.string().min(1),
  queryConfig: z.record(z.string(), z.any()),
  description: z.string().optional(),
  outputFormats: z.array(z.string()).optional(),
  isScheduled: z.boolean().optional(),
  scheduleConfig: z.record(z.string(), z.any()).optional(),
  isSystem: z.boolean().optional(),
  isActive: z.boolean().optional(),
  parameters: z.array(z.record(z.string(), z.any())).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const POST = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const body = await req.json();
      const parsed = createReportSchema.parse(body);

      // Duplicate check: reportCode must be unique within tenant+org
      const existing = await prisma.imdadReportDefinition.findFirst({
        where: {
          tenantId,
          organizationId: parsed.organizationId,
          reportCode: parsed.reportCode,
          isDeleted: false,
        },
      });
      if (existing) {
        return NextResponse.json(
          { error: 'Report definition with this code already exists in this organization' },
          { status: 409 }
        );
      }

      const report = await prisma.imdadReportDefinition.create({
        data: {
          tenantId,
          organizationId: parsed.organizationId,
          reportCode: parsed.reportCode,
          reportName: parsed.reportName,
          reportCategory: parsed.reportCategory,
          queryConfig: parsed.queryConfig,
          description: parsed.description,
          supportedFormats: parsed.outputFormats ?? [],
          isScheduled: parsed.isScheduled ?? false,
          isSystem: parsed.isSystem ?? false,
          isActive: parsed.isActive ?? true,
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
        resourceType: 'REPORT_DEFINITION',
        resourceId: report.id,
        boundedContext: 'BC8_ANALYTICS',
        newData: report as any,
        request: req,
      });

      return NextResponse.json({ data: report }, { status: 201 });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.analytics.reports.create' }
);
