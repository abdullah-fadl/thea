/**
 * SCM Integrations — Single Webhook
 *
 * GET    /api/imdad/integrations/webhooks/:id — Get webhook details
 * PUT    /api/imdad/integrations/webhooks/:id — Update webhook (optimistic locking)
 * DELETE /api/imdad/integrations/webhooks/:id — Soft delete webhook
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Helper — extract ID from URL path
// ---------------------------------------------------------------------------

function extractId(req: NextRequest): string {
  const segments = req.nextUrl.pathname.split('/');
  // .../webhooks/[id] — id is the last segment
  return segments[segments.length - 1];
}

// ---------------------------------------------------------------------------
// GET — Single webhook
// ---------------------------------------------------------------------------

export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    try {
      const id = extractId(req);

      const webhook = await prisma.imdadWebhook.findFirst({
        where: { id, tenantId, isDeleted: false },
        select: {
          id: true,
          tenantId: true,
          organizationId: true,
          name: true,
          url: true,
          eventTypes: true,
          isActive: true,
          headers: true,
          retryPolicy: true,
          lastTriggeredAt: true,
          failureCount: true,
          version: true,
          createdBy: true,
          updatedBy: true,
          createdAt: true,
          updatedAt: true,
          // Omit secret
        },
      });

      if (!webhook) {
        return NextResponse.json(
          { error: 'Webhook not found' },
          { status: 404 },
        );
      }

      return NextResponse.json({ data: webhook });
    } catch (error) {
      return NextResponse.json(
        { error: 'Internal Server Error' },
        { status: 500 },
      );
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.integrations.webhook.manage' },
);

// ---------------------------------------------------------------------------
// PUT — Update webhook with optimistic locking
// ---------------------------------------------------------------------------

const updateWebhookSchema = z.object({
  version: z.number().int(),
  name: z.string().min(1).max(200).optional(),
  url: z.string().url().max(500).optional(),
  eventTypes: z.array(z.string().min(1)).min(1).optional(),
  isActive: z.boolean().optional(),
  headers: z.record(z.string(), z.string()).nullable().optional(),
  retryPolicy: z
    .object({
      maxRetries: z.number().int().min(1).max(10).optional(),
      backoffMs: z.number().int().min(100).max(60000).optional(),
    })
    .nullable()
    .optional(),
});

export const PUT = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const id = extractId(req);
      const body = await req.json();
      const parsed = updateWebhookSchema.parse(body);

      const { version, ...updates } = parsed;

      const existing = await prisma.imdadWebhook.findFirst({
        where: { id, tenantId, isDeleted: false },
      });

      if (!existing) {
        return NextResponse.json(
          { error: 'Webhook not found' },
          { status: 404 },
        );
      }

      if (existing.version !== version) {
        return NextResponse.json(
          {
            error:
              'Conflict — webhook was modified by another user. Please refresh and try again.',
          },
          { status: 409 },
        );
      }

      // If re-enabling, reset failure count
      const extraUpdates: Record<string, unknown> = {};
      if (updates.isActive === true && !existing.isActive) {
        extraUpdates.failureCount = 0;
      }

      const webhook = await prisma.imdadWebhook.update({
        where: { id },
        data: {
          ...updates,
          ...extraUpdates,
          version: { increment: 1 },
          updatedBy: userId,
        } as any,
      });

      await imdadAudit.log({
        tenantId,
        organizationId: existing.organizationId ?? undefined,
        actorUserId: userId,
        actorRole: role,
        action: 'UPDATE',
        resourceType: 'webhook',
        resourceId: id,
        boundedContext: 'BC9_PLATFORM',
        previousData: { ...existing, secret: '***' } as any,
        newData: { ...webhook, secret: '***' } as any,
        request: req,
      });

      return NextResponse.json({
        data: {
          ...webhook,
          secret: undefined, // Never expose secret on update
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) },
          { status: 400 },
        );
      }
      return NextResponse.json(
        { error: 'Internal Server Error' },
        { status: 500 },
      );
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.integrations.webhook.manage' },
);

// ---------------------------------------------------------------------------
// DELETE — Soft delete webhook
// ---------------------------------------------------------------------------

export const DELETE = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const id = extractId(req);

      const existing = await prisma.imdadWebhook.findFirst({
        where: { id, tenantId, isDeleted: false },
      });

      if (!existing) {
        return NextResponse.json(
          { error: 'Webhook not found' },
          { status: 404 },
        );
      }

      await prisma.imdadWebhook.update({
        where: { id },
        data: {
          isDeleted: true,
          isActive: false,
          version: { increment: 1 },
          updatedBy: userId,
        },
      });

      await imdadAudit.log({
        tenantId,
        organizationId: existing.organizationId ?? undefined,
        actorUserId: userId,
        actorRole: role,
        action: 'DELETE',
        resourceType: 'webhook',
        resourceId: id,
        boundedContext: 'BC9_PLATFORM',
        previousData: { ...existing, secret: '***' } as any,
        request: req,
      });

      return NextResponse.json({ success: true });
    } catch (error) {
      return NextResponse.json(
        { error: 'Internal Server Error' },
        { status: 500 },
      );
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.integrations.webhook.manage' },
);
