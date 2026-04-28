/**
 * SCM BC1 Inventory — Alert Configuration
 *
 * GET  /api/imdad/inventory/alerts/configure — Get alert thresholds
 * POST /api/imdad/inventory/alerts/configure — Set alert thresholds
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const CONFIG_KEY = 'imdad.inventory.alert.config';

// ---------------------------------------------------------------------------
// GET — Current alert configuration
// ---------------------------------------------------------------------------

export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    try {
      const url = new URL(req.url);
      const organizationId = url.searchParams.get('organizationId') || undefined;

      const config = await prisma.imdadSystemConfig.findFirst({
        where: {
          tenantId,
          configKey: CONFIG_KEY,
          ...(organizationId ? { scopeId: organizationId } : {}),
        },
      });

      const defaults = {
        lowStockEnabled: true,
        expiryWarningEnabled: true,
        overstockEnabled: true,
        expiryWarningDays: 90,
        criticalExpiryDays: 30,
        scanFrequencyHours: 24,
        emailNotifications: false,
        dashboardNotifications: true,
      };

      return NextResponse.json({
        data: config?.configValue ? { ...defaults, ...(config.configValue as any) } : defaults,
      });
    } catch (error) {
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.inventory.view' }
);

// ---------------------------------------------------------------------------
// POST — Update alert configuration
// ---------------------------------------------------------------------------

const configSchema = z.object({
  organizationId: z.string().uuid(),
  lowStockEnabled: z.boolean().optional(),
  expiryWarningEnabled: z.boolean().optional(),
  overstockEnabled: z.boolean().optional(),
  expiryWarningDays: z.number().int().min(1).max(365).optional(),
  criticalExpiryDays: z.number().int().min(1).max(90).optional(),
  scanFrequencyHours: z.number().int().min(1).max(168).optional(),
  emailNotifications: z.boolean().optional(),
  dashboardNotifications: z.boolean().optional(),
});

export const POST = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const body = await req.json();
      const parsed = configSchema.parse(body);
      const { organizationId, ...configValues } = parsed;

      const config = await prisma.imdadSystemConfig.upsert({
        where: {
          tenantId_configKey_scope_scopeId: {
            tenantId,
            configKey: CONFIG_KEY,
            scope: 'ORGANIZATION',
            scopeId: organizationId,
          },
        },
        create: {
          tenantId,
          configKey: CONFIG_KEY,
          configValue: configValues as any,
          scope: 'ORGANIZATION',
          scopeId: organizationId,
          createdBy: userId,
          updatedBy: userId,
        } as any,
        update: {
          configValue: configValues as any,
          updatedBy: userId,
          version: { increment: 1 },
        },
      });

      await imdadAudit.log({
        tenantId,
        organizationId,
        actorUserId: userId,
        actorRole: role,
        action: 'UPDATE',
        resourceType: 'ALERT_CONFIG',
        resourceId: config.id,
        boundedContext: 'BC1_INVENTORY',
        newData: configValues,
        request: req,
      });

      return NextResponse.json({ data: config.configValue });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.inventory.alerts.manage' }
);
