/**
 * SCM BC8 Analytics — KPI Snapshots
 *
 * GET  /api/imdad/analytics/kpi-snapshots — List KPI snapshots with pagination, search, filters
 * POST /api/imdad/analytics/kpi-snapshots — Create KPI snapshot (append-only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET — List KPI snapshots
// ---------------------------------------------------------------------------

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().optional(),
  organizationId: z.string().uuid().optional(),
  kpiCode: z.string().optional(),
  periodType: z.string().optional(),
  dimensionType: z.string().optional(),
  dimensionId: z.string().optional(),
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
      const { page, limit, search, organizationId, kpiCode, periodType, dimensionType, dimensionId, dateFrom, dateTo } = parsed;

      const where: any = { tenantId };
      if (organizationId) where.organizationId = organizationId;
      if (kpiCode) where.kpiCode = kpiCode;
      if (periodType) where.periodType = periodType;
      if (dimensionType) where.dimensionType = dimensionType;
      if (dimensionId) where.dimensionId = dimensionId;
      if (dateFrom || dateTo) {
        where.periodStart = {};
        if (dateFrom) where.periodStart.gte = new Date(dateFrom);
        if (dateTo) where.periodStart.lte = new Date(dateTo);
      }
      if (search) {
        where.OR = [
          { kpiCode: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [data, total] = await Promise.all([
        prisma.imdadKpiSnapshot.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.imdadKpiSnapshot.count({ where }),
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
  { platformKey: 'imdad', permissionKey: 'imdad.analytics.kpi.list' }
);

// ---------------------------------------------------------------------------
// POST — Create KPI snapshot (append-only — no version, no isDeleted)
// ---------------------------------------------------------------------------

const createSnapshotSchema = z.object({
  organizationId: z.string().uuid(),
  kpiCode: z.string().min(1),
  periodType: z.string().min(1),
  periodStart: z.string().min(1),
  periodEnd: z.string().min(1),
  dimensionType: z.string().optional(),
  dimensionId: z.string().optional(),
  dimensionLabel: z.string().optional(),
  numericValue: z.number().optional(),
  denominatorValue: z.number().optional(),
  targetValue: z.number().optional(),
  unit: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const POST = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const body = await req.json();
      const parsed = createSnapshotSchema.parse(body);

      const snapshot = await prisma.imdadKpiSnapshot.create({
        data: {
          tenantId,
          organizationId: parsed.organizationId,
          kpiCode: parsed.kpiCode,
          periodType: parsed.periodType as any,
          periodStart: new Date(parsed.periodStart),
          periodEnd: new Date(parsed.periodEnd),
          dimensionType: parsed.dimensionType,
          dimensionId: parsed.dimensionId,
          dimensionName: parsed.dimensionLabel,
          numericValue: parsed.numericValue,
          targetValue: parsed.targetValue,
          metadata: parsed.metadata ?? undefined,
        } as any,
      });

      await imdadAudit.log({
        tenantId,
        organizationId: parsed.organizationId,
        actorUserId: userId,
        actorRole: role,
        action: 'CREATE',
        resourceType: 'KPI_SNAPSHOT',
        resourceId: snapshot.id,
        boundedContext: 'BC8_ANALYTICS',
        newData: snapshot as any,
        request: req,
      });

      return NextResponse.json({ data: snapshot }, { status: 201 });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.analytics.kpi.create' }
);
