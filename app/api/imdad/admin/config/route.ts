/**
 * SCM System Config API
 *
 * GET  /api/imdad/admin/config — Load all config entries for the tenant
 * PUT  /api/imdad/admin/config — Upsert config entries (key-value pairs)
 *
 * Permission: imdad.admin.settings
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad';
import { z } from 'zod';

// ── GET: Load all config entries for the tenant ────────────────────────────
export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    try {
      const url = new URL(req.url);
      const scope = url.searchParams.get('scope') || 'ORGANIZATION';

      const configs = await prisma.imdadSystemConfig.findMany({
        where: {
          tenantId,
          scope: scope as any,
          isDeleted: false,
        },
        orderBy: { configKey: 'asc' },
        take: 500,
      });

      // Flatten to key-value map for easy consumption
      const configMap: Record<string, any> = {};
      for (const c of configs) {
        configMap[c.configKey] = c.configValue;
      }

      return NextResponse.json({ configs: configMap, raw: configs });
    } catch (error) {
      console.error('[SCM Config GET]', error);
      return NextResponse.json(
        { error: 'Internal Server Error' },
        { status: 500 }
      );
    }
  },
  {
    platformKey: 'imdad',
    permissionKey: 'imdad.admin.settings',
  }
);

// ── PUT: Upsert config entries ─────────────────────────────────────────────
const putSchema = z.object({
  configs: z.record(z.string(), z.any()),
  scope: z.enum(['GLOBAL', 'ORGANIZATION', 'DEPARTMENT', 'USER']).default('ORGANIZATION'),
  scopeId: z.string().uuid().optional().nullable(),
  organizationId: z.string().uuid().optional().nullable(),
});

export const PUT = withAuthTenant(
  async (req, { tenantId, userId }) => {
    try {
      const body = await req.json();
      const parsed = putSchema.parse(body);

      const results: Array<{ configKey: string; success: boolean }> = [];

      for (const [key, value] of Object.entries(parsed.configs)) {
        try {
          await prisma.imdadSystemConfig.upsert({
            where: {
              tenantId_configKey_scope_scopeId: {
                tenantId,
                configKey: key,
                scope: parsed.scope,
                scopeId: parsed.scopeId ?? '',
              },
            },
            update: {
              configValue: value as any,
              updatedBy: userId,
              version: { increment: 1 },
            },
            create: {
              tenantId,
              organizationId: parsed.organizationId ?? undefined,
              configKey: key,
              configValue: value as any,
              scope: parsed.scope,
              scopeId: parsed.scopeId ?? undefined,
              createdBy: userId,
              updatedBy: userId,
            } as any,
          });
          results.push({ configKey: key, success: true });
        } catch (err) {
          console.error(`[SCM Config PUT] Failed to upsert ${key}:`, err);
          results.push({ configKey: key, success: false });
        }
      }

      // Audit log
      await imdadAudit.log({
        tenantId,
        actorUserId: userId,
        action: 'CONFIGURE',
        resourceType: 'system_config',
        boundedContext: 'PLATFORM',
        newData: parsed.configs,
        metadata: { scope: parsed.scope, scopeId: parsed.scopeId },
      });

      return NextResponse.json({ ok: true, results });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) },
          { status: 400 }
        );
      }
      console.error('[SCM Config PUT]', error);
      return NextResponse.json(
        { error: 'Internal Server Error' },
        { status: 500 }
      );
    }
  },
  {
    platformKey: 'imdad',
    permissionKey: 'imdad.admin.settings',
  }
);
