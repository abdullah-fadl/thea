/**
 * SCM Dashboard — Recent Alerts
 *
 * GET /api/imdad/dashboard/recent-alerts — Latest 20 alert instances
 *
 * Uses raw SQL to bypass Prisma model/relation issues and query data directly.
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';

interface AlertRow {
  id: string;
  severity: string;
  status: string;
  message: string;
  message_ar: string | null;
  rule_code: string | null;
  rule_name: string | null;
  kpi_code: string | null;
  actual_value: string | number | null;
  threshold_value: string | number | null;
  fired_at: Date | string | null;
  created_at: Date | string;
}

export const GET = withAuthTenant(
  async (_req, { tenantId }) => {
    try {
      const rows = await prisma.$queryRaw<AlertRow[]>(
        Prisma.sql`SELECT
           id,
           severity::text AS severity,
           status,
           message,
           "messageAr" AS message_ar,
           "ruleCode" AS rule_code,
           "ruleName" AS rule_name,
           "kpiCode" AS kpi_code,
           "actualValue"::text AS actual_value,
           "thresholdValue"::text AS threshold_value,
           "firedAt" AS fired_at,
           "createdAt" AS created_at
         FROM imdad_alert_instances
         WHERE "tenantId" = ${tenantId}::uuid
           AND "isDeleted" = false
         ORDER BY "createdAt" DESC
         LIMIT 20`
      );

      const data = rows.map((a) => ({
        id: a.id,
        severity: a.severity,
        status: a.status,
        message: a.message,
        messageAr: a.message_ar ?? a.message,
        sourceBC: '',
        ruleCode: a.rule_code,
        ruleName: a.rule_name,
        ruleNameAr: a.rule_name,
        kpiCode: a.kpi_code,
        actualValue: a.actual_value,
        thresholdValue: a.threshold_value,
        firedAt: a.fired_at,
        createdAt: a.created_at,
      }));

      return NextResponse.json({ data });
    } catch (err: any) {
      console.error('[IMDAD] recent-alerts error:', err?.message || err);
      return NextResponse.json({
        data: [],
        _error: process.env.NODE_ENV === 'development' ? err?.message : undefined,
      });
    }
  },
  {
    tenantScoped: true,
    platformKey: 'imdad',
    permissionKey: 'imdad.dashboard.view',
  },
);
