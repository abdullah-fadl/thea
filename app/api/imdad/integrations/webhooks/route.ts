/**
 * SCM Integrations — Webhook Management
 *
 * GET  /api/imdad/integrations/webhooks — List webhooks with pagination
 * POST /api/imdad/integrations/webhooks — Register a new webhook
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';
import { z } from 'zod';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET — List webhooks
// ---------------------------------------------------------------------------

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  organizationId: z.string().uuid().optional(),
});

export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    try {
      const url = new URL(req.url);
      const params: Record<string, string> = {};
      url.searchParams.forEach((v, k) => {
        params[k] = v;
      });

      const parsed = listQuerySchema.parse(params);
      const { page, limit, search, isActive, organizationId } = parsed;

      const where: any = { tenantId, isDeleted: false };
      if (organizationId) where.organizationId = organizationId;
      if (isActive !== undefined) where.isActive = isActive;
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { url: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [data, total] = await Promise.all([
        prisma.imdadWebhook.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
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
            // Intentionally omit `secret` from list responses
          },
        }),
        prisma.imdadWebhook.count({ where }),
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
// POST — Create webhook
// ---------------------------------------------------------------------------

const createWebhookSchema = z.object({
  organizationId: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  url: z.string().url().max(500),
  eventTypes: z.array(z.string().min(1)).min(1),
  headers: z.record(z.string(), z.string()).optional(),
  retryPolicy: z
    .object({
      maxRetries: z.number().int().min(1).max(10).optional(),
      backoffMs: z.number().int().min(100).max(60000).optional(),
    })
    .optional(),
});

export const POST = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const body = await req.json();
      const parsed = createWebhookSchema.parse(body);

      // Generate a random HMAC secret
      const secret = crypto.randomBytes(32).toString('hex');

      const webhook = await prisma.imdadWebhook.create({
        data: {
          tenantId,
          organizationId: parsed.organizationId ?? null,
          name: parsed.name,
          url: parsed.url,
          secret,
          eventTypes: parsed.eventTypes,
          headers: (parsed.headers ?? undefined) as any,
          retryPolicy: (parsed.retryPolicy ?? undefined) as any,
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
        resourceType: 'webhook',
        resourceId: webhook.id,
        boundedContext: 'BC9_PLATFORM',
        newData: { ...webhook, secret: '***' } as any,
        request: req,
      });

      return NextResponse.json(
        {
          data: {
            ...webhook,
            // Return secret only on creation so the user can store it
          },
        },
        { status: 201 },
      );
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
