/**
 * SCM BC8 Analytics — Alert Instances
 *
 * GET  /api/imdad/analytics/alert-instances — List alert instances with pagination, search, filters
 * POST /api/imdad/analytics/alert-instances — Create alert instance (fired by background jobs or manual)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';
import { z } from 'zod';
import { emit } from '@/lib/events';
import { logger } from '@/lib/monitoring/logger';

// Stock-related KPI codes that trigger stock.threshold_breached@v1.
// Other alert kinds (financial, operational) do not emit on this channel.
const STOCK_KPI_PREFIXES = ['STOCK', 'INVENTORY', 'REORDER', 'EXPIRY'];
function isStockKpiCode(kpiCode: string): boolean {
  const upper = kpiCode.toUpperCase();
  return STOCK_KPI_PREFIXES.some((p) => upper.startsWith(p));
}

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET — List alert instances
// ---------------------------------------------------------------------------

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().optional(),
  organizationId: z.string().uuid().optional(),
  alertRuleId: z.string().uuid().optional(),
  status: z.string().optional(),
  severity: z.string().optional(),
  kpiCode: z.string().optional(),
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
      const { page, limit, search, organizationId, alertRuleId, status, severity, kpiCode, dateFrom, dateTo } = parsed;

      const where: any = { tenantId };
      if (organizationId) where.organizationId = organizationId;
      if (alertRuleId) where.alertRuleId = alertRuleId;
      if (status) where.status = status;
      if (severity) where.severity = severity;
      if (kpiCode) where.kpiCode = kpiCode;
      if (dateFrom || dateTo) {
        where.firedAt = {};
        if (dateFrom) where.firedAt.gte = new Date(dateFrom);
        if (dateTo) where.firedAt.lte = new Date(dateTo);
      }
      if (search) {
        where.OR = [
          { ruleCode: { contains: search, mode: 'insensitive' } },
          { ruleName: { contains: search, mode: 'insensitive' } },
          { message: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [data, total] = await Promise.all([
        prisma.imdadAlertInstance.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.imdadAlertInstance.count({ where }),
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
  { platformKey: 'imdad', permissionKey: 'imdad.analytics.alert-instances.list' }
);

// ---------------------------------------------------------------------------
// POST — Create alert instance
// ---------------------------------------------------------------------------

const createAlertInstanceSchema = z.object({
  organizationId: z.string().uuid(),
  alertRuleId: z.string().uuid(),
  ruleCode: z.string().min(1),
  ruleName: z.string().min(1),
  severity: z.string().min(1),
  kpiCode: z.string().min(1),
  actualValue: z.number(),
  thresholdValue: z.number(),
  message: z.string().min(1),
  dimensionType: z.string().optional(),
  dimensionId: z.string().optional(),
  dimensionLabel: z.string().optional(),
  contextData: z.record(z.string(), z.any()).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const POST = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const body = await req.json();
      const parsed = createAlertInstanceSchema.parse(body);

      const alertInstance = await prisma.imdadAlertInstance.create({
        data: {
          tenantId,
          organizationId: parsed.organizationId,
          alertRuleId: parsed.alertRuleId,
          ruleCode: parsed.ruleCode,
          ruleName: parsed.ruleName,
          severity: parsed.severity as any,
          kpiCode: parsed.kpiCode,
          actualValue: parsed.actualValue,
          thresholdValue: parsed.thresholdValue,
          message: parsed.message,
          dimensionType: parsed.dimensionType,
          dimensionId: parsed.dimensionId,
          dimensionLabel: parsed.dimensionLabel,
          metadata: parsed.metadata ?? undefined,
          status: 'ACTIVE',
          firedAt: new Date(),
        } as any,
      });

      await imdadAudit.log({
        tenantId,
        organizationId: parsed.organizationId,
        actorUserId: userId,
        actorRole: role,
        action: 'CREATE',
        resourceType: 'ALERT_INSTANCE',
        resourceId: alertInstance.id,
        boundedContext: 'BC8_ANALYTICS',
        newData: alertInstance as any,
        request: req,
      });

      // Emit stock.threshold_breached@v1 — best-effort, never breaks the response.
      // Only stock-related KPI codes fire on this channel; other alert kinds
      // (financial, operational) intentionally do not emit here.
      if (isStockKpiCode(parsed.kpiCode)) {
        try {
          await emit({
            eventName: 'stock.threshold_breached',
            version: 1,
            tenantId,
            aggregate: 'alert_instance',
            aggregateId: alertInstance.id,
            payload: {
              alertInstanceId: alertInstance.id,
              tenantId,
              organizationId: parsed.organizationId,
              alertRuleId: parsed.alertRuleId,
              kpiCode: parsed.kpiCode,
              severity: parsed.severity as 'INFO' | 'WARNING' | 'CRITICAL',
              firedAt: ((alertInstance as any).firedAt instanceof Date ? (alertInstance as any).firedAt : new Date()).toISOString(),
            },
          });
        } catch (e) {
          logger.error('events.emit_failed', { category: 'imdad', eventName: 'stock.threshold_breached', error: e });
        }
      }

      return NextResponse.json({ data: alertInstance }, { status: 201 });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.analytics.alert-instances.create' }
);
