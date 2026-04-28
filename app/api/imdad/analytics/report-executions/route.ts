/**
 * SCM BC8 Analytics — Report Executions
 *
 * GET  /api/imdad/analytics/report-executions — List report executions with pagination, search, filters
 * POST /api/imdad/analytics/report-executions — Create report execution record (append-only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET — List report executions
// ---------------------------------------------------------------------------

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().optional(),
  organizationId: z.string().uuid().optional(),
  reportDefinitionId: z.string().uuid().optional(),
  reportCode: z.string().optional(),
  executedBy: z.string().uuid().optional(),
  status: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    try {
      const url = new URL(req.url);
      const params: Record<string, string> = {};
      url.searchParams.forEach((v, k) => { params[k] = v; });

      const parsed = listQuerySchema.parse(params);
      const { page, limit, search, organizationId, reportDefinitionId, reportCode, executedBy, status, dateFrom, dateTo } = parsed;

      const where: any = { tenantId };
      if (organizationId) where.organizationId = organizationId;
      if (reportDefinitionId) where.reportDefinitionId = reportDefinitionId;
      if (reportCode) where.reportCode = reportCode;
      if (executedBy) where.executedBy = executedBy;
      if (status) where.status = status;
      if (dateFrom || dateTo) {
        where.executedAt = {};
        if (dateFrom) where.executedAt.gte = new Date(dateFrom);
        if (dateTo) where.executedAt.lte = new Date(dateTo);
      }
      if (search) {
        where.OR = [
          { reportCode: { contains: search, mode: 'insensitive' } },
          { reportName: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [data, total] = await Promise.all([
        prisma.imdadReportExecution.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.imdadReportExecution.count({ where }),
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
  { platformKey: 'imdad', permissionKey: 'imdad.analytics.executions.list' }
);

// ---------------------------------------------------------------------------
// POST — Create report execution record (append-only — no version, no isDeleted)
// ---------------------------------------------------------------------------

const createExecutionSchema = z.object({
  organizationId: z.string().uuid(),
  reportDefinitionId: z.string().uuid(),
  reportCode: z.string().min(1),
  reportName: z.string().min(1),
  executedBy: z.string().uuid(),
  outputFormat: z.string().min(1),
  parameters: z.record(z.string(), z.any()).optional(),
  status: z.string().optional(),
  resultSummary: z.record(z.string(), z.any()).optional(),
  outputUrl: z.string().optional(),
  errorMessage: z.string().optional(),
  durationMs: z.number().int().optional(),
  rowCount: z.number().int().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const POST = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const body = await req.json();
      const parsed = createExecutionSchema.parse(body);

      const execution = await prisma.imdadReportExecution.create({
        data: {
          tenantId,
          organizationId: parsed.organizationId,
          reportDefinitionId: parsed.reportDefinitionId,
          reportCode: parsed.reportCode,
          reportName: parsed.reportName,
          executedBy: parsed.executedBy,
          outputFormat: parsed.outputFormat,
          filterParams: parsed.parameters ?? undefined,
          status: parsed.status ?? 'PENDING',
          errorMessage: parsed.errorMessage,
          executionTimeMs: parsed.durationMs,
          rowCount: parsed.rowCount,
          metadata: parsed.metadata ?? undefined,
          executedAt: new Date(),
        } as any,
      });

      await imdadAudit.log({
        tenantId,
        organizationId: parsed.organizationId,
        actorUserId: userId,
        actorRole: role,
        action: 'CREATE',
        resourceType: 'REPORT_EXECUTION',
        resourceId: execution.id,
        boundedContext: 'BC8_ANALYTICS',
        newData: execution as any,
        request: req,
      });

      return NextResponse.json({ data: execution }, { status: 201 });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.analytics.executions.create' }
);
