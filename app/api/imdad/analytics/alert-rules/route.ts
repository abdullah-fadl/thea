/**
 * SCM BC8 Analytics — Alert Rules
 *
 * GET  /api/imdad/analytics/alert-rules — List alert rules with pagination, search, filters
 * POST /api/imdad/analytics/alert-rules — Create alert rule
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET — List alert rules
// ---------------------------------------------------------------------------

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().optional(),
  organizationId: z.string().uuid().optional(),
  kpiCode: z.string().optional(),
  severity: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
  scopeType: z.string().optional(),
});

export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    try {
      const url = new URL(req.url);
      const params: Record<string, string> = {};
      url.searchParams.forEach((v, k) => { params[k] = v; });

      const parsed = listQuerySchema.parse(params);
      const { page, limit, search, organizationId, kpiCode, severity, isActive, scopeType } = parsed;

      const where: any = { tenantId, isDeleted: false };
      if (organizationId) where.organizationId = organizationId;
      if (kpiCode) where.kpiCode = kpiCode;
      if (severity) where.severity = severity;
      if (isActive !== undefined) where.isActive = isActive;
      if (scopeType) where.scopeType = scopeType;
      if (search) {
        where.OR = [
          { ruleName: { contains: search, mode: 'insensitive' } },
          { ruleCode: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [data, total] = await Promise.all([
        prisma.imdadAlertRule.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.imdadAlertRule.count({ where }),
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
  { platformKey: 'imdad', permissionKey: 'imdad.analytics.alerts.list' }
);

// ---------------------------------------------------------------------------
// POST — Create alert rule
// ---------------------------------------------------------------------------

const createAlertRuleSchema = z.object({
  organizationId: z.string().uuid(),
  ruleName: z.string().min(1).max(200),
  ruleCode: z.string().min(1).max(50),
  kpiCode: z.string().min(1),
  conditionType: z.string().min(1),
  thresholdValue: z.number(),
  severity: z.string().optional(),
  scopeType: z.string().optional(),
  scopeId: z.string().optional(),
  isActive: z.boolean().optional(),
  cooldownMinutes: z.number().int().optional(),
  notificationChannels: z.array(z.string()).optional(),
  escalationConfig: z.record(z.string(), z.any()).optional(),
  description: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const POST = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const body = await req.json();
      const parsed = createAlertRuleSchema.parse(body);

      // Duplicate check: ruleCode must be unique within tenant+org
      const existing = await prisma.imdadAlertRule.findFirst({
        where: {
          tenantId,
          organizationId: parsed.organizationId,
          ruleCode: parsed.ruleCode,
          isDeleted: false,
        },
      });
      if (existing) {
        return NextResponse.json(
          { error: 'Alert rule with this code already exists in this organization' },
          { status: 409 }
        );
      }

      const alertRule = await prisma.imdadAlertRule.create({
        data: {
          tenantId,
          organizationId: parsed.organizationId,
          ruleName: parsed.ruleName,
          ruleCode: parsed.ruleCode,
          kpiCode: parsed.kpiCode,
          conditionType: parsed.conditionType,
          thresholdValue: parsed.thresholdValue,
          severity: (parsed.severity ?? 'MEDIUM') as any,
          scopeType: parsed.scopeType,
          scopeId: parsed.scopeId,
          isActive: parsed.isActive ?? true,
          cooldownMinutes: parsed.cooldownMinutes,
          notifyChannels: parsed.notificationChannels ?? [],
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
        resourceType: 'ALERT_RULE',
        resourceId: alertRule.id,
        boundedContext: 'BC8_ANALYTICS',
        newData: alertRule as any,
        request: req,
      });

      return NextResponse.json({ data: alertRule }, { status: 201 });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.analytics.alerts.create' }
);
