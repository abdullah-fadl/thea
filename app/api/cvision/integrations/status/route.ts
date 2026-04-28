import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Integration Status API
 *
 * GET  /api/cvision/integrations/status — List all integration statuses
 * POST /api/cvision/integrations/status — Toggle integration or test webhook
 *   action=toggle        → Enable/disable an integration (admin only)
 *   action=webhook-test  → Send a test webhook to verify connectivity
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant, withAuditedAuth } from '@/lib/cvision/infra';
import { requireCtx, deny } from '@/lib/cvision/authz/enforce';
import { getCVisionDb } from '@/lib/cvision/db';
import {
  getIntegrationStatuses,
  validateWebhookPayload,
  type IntegrationStatus,
} from '@/lib/cvision/integration';

export const dynamic = 'force-dynamic';

// ─── Zod Schemas ────────────────────────────────────────────────────────────

const toggleSchema = z.object({
  action: z.literal('toggle'),
  integrationId: z.string().min(1, 'integrationId is required'),
  enabled: z.boolean(),
});

const webhookTestSchema = z.object({
  action: z.literal('webhook-test'),
  integrationId: z.string().min(1, 'integrationId is required'),
  url: z.string().url('Valid URL is required'),
});

const postBodySchema = z.discriminatedUnion('action', [
  toggleSchema,
  webhookTestSchema,
]);

// ─── Admin Roles ────────────────────────────────────────────────────────────

const adminRoles = ['cvision_admin', 'hr_admin', 'owner', 'thea-owner', 'admin'];

// ─── GET — List Integration Statuses ────────────────────────────────────────

export const GET = withAuthTenant(
  async (request, { tenantId }) => {
    try {
      const statuses = getIntegrationStatuses();

      // Enrich with DB-stored config if available
      const db = await getCVisionDb(tenantId);
      const configs = await db
        .collection('cvision_integration_config')
        .find({ tenantId })
        .toArray();

      const configMap = new Map(configs.map((c: any) => [c.integrationId, c]));

      const enriched: IntegrationStatus[] = statuses.map((s) => {
        const dbConfig = configMap.get(s.id);
        if (dbConfig) {
          return {
            ...s,
            enabled: dbConfig.enabled ?? s.enabled,
            status: dbConfig.enabled ? 'active' : 'inactive',
            lastSyncAt: dbConfig.lastSyncAt,
            config: dbConfig.config,
          } as IntegrationStatus;
        }
        return s;
      });

      return NextResponse.json({ success: true, data: enriched });
    } catch (error: any) {
      logger.error('[CVision Integration Status GET]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 },
      );
    }
  },
  { platformKey: 'cvision' },
);

// ─── POST — Toggle Integration / Webhook Test ──────────────────────────────

export const POST = withAuditedAuth(
  async (request: NextRequest, { tenantId, userId }) => {
    try {
      // Auth + authz context
      const ctx = await requireCtx(request);
      if (ctx instanceof NextResponse) return ctx;

      // Admin check
      if (!ctx.isOwner && !adminRoles.some((r) => ctx.roles?.includes(r))) {
        return deny('ADMIN_REQUIRED', 'Only admins can manage integrations');
      }

      const body = await request.json();
      const parsed = postBodySchema.safeParse(body);

      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Validation error', details: (parsed.error as any).errors },
          { status: 400 },
        );
      }

      const { action } = parsed.data;

      // ── Toggle Integration ──────────────────────────────────────────
      if (action === 'toggle') {
        const { integrationId, enabled } = parsed.data;

        const db = await getCVisionDb(tenantId);
        const collection = db.collection('cvision_integration_config');

        await collection.updateOne(
          { tenantId, integrationId },
          {
            $set: {
              tenantId,
              integrationId,
              enabled,
              updatedAt: new Date().toISOString(),
              updatedBy: userId,
            },
            $setOnInsert: {
              createdAt: new Date().toISOString(),
              createdBy: userId,
            },
          },
          { upsert: true },
        );

        return NextResponse.json({
          success: true,
          message: `Integration "${integrationId}" ${enabled ? 'enabled' : 'disabled'}`,
          data: { integrationId, enabled },
        });
      }

      // ── Webhook Test ────────────────────────────────────────────────
      if (action === 'webhook-test') {
        const { integrationId, url } = parsed.data;

        const testPayload = {
          event: 'integration.test',
          source: 'cvision',
          timestamp: new Date().toISOString(),
          data: {
            integrationId,
            tenantId,
            test: true,
            message: 'Webhook connectivity test from CVision',
          },
        };

        const validation = validateWebhookPayload(testPayload);
        if (!validation.valid) {
          return NextResponse.json(
            { error: 'Invalid test payload', details: validation.error },
            { status: 500 },
          );
        }

        try {
          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testPayload),
            signal: AbortSignal.timeout(10_000),
          });

          return NextResponse.json({
            success: true,
            data: {
              integrationId,
              url,
              responseStatus: response.status,
              reachable: response.ok,
            },
          });
        } catch (fetchError: any) {
          return NextResponse.json({
            success: false,
            data: {
              integrationId,
              url,
              reachable: false,
              error: fetchError.message || 'Connection failed',
            },
          });
        }
      }

      return NextResponse.json(
        { error: 'Unknown action' },
        { status: 400 },
      );
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return NextResponse.json(
          { error: 'Validation error', details: error.errors },
          { status: 400 },
        );
      }
      logger.error('[CVision Integration Status POST]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 },
      );
    }
  },
  { resourceType: 'INTEGRATION' },
);
