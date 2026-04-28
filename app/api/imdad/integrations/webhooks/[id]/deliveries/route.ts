/**
 * SCM Integrations — Webhook Delivery History
 *
 * GET /api/imdad/integrations/webhooks/:id/deliveries — List delivery attempts
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET — Delivery history with pagination
// ---------------------------------------------------------------------------

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  isSuccess: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  eventType: z.string().optional(),
});

export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    try {
      // Extract webhook ID: .../webhooks/[id]/deliveries
      const segments = req.nextUrl.pathname.split('/');
      const deliveriesIdx = segments.indexOf('deliveries');
      const webhookId = segments[deliveriesIdx - 1];

      if (!webhookId) {
        return NextResponse.json(
          { error: 'Webhook ID is required' },
          { status: 400 },
        );
      }

      // Verify webhook exists and belongs to tenant
      const webhook = await prisma.imdadWebhook.findFirst({
        where: { id: webhookId, tenantId, isDeleted: false },
      });

      if (!webhook) {
        return NextResponse.json(
          { error: 'Webhook not found' },
          { status: 404 },
        );
      }

      const url = new URL(req.url);
      const params: Record<string, string> = {};
      url.searchParams.forEach((v, k) => {
        params[k] = v;
      });

      const parsed = listQuerySchema.parse(params);
      const { page, limit, isSuccess, eventType } = parsed;

      const where: any = { tenantId, webhookId };
      if (isSuccess !== undefined) where.isSuccess = isSuccess;
      if (eventType) where.eventType = eventType;

      const [data, total] = await Promise.all([
        prisma.imdadWebhookDelivery.findMany({
          where,
          orderBy: { deliveredAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.imdadWebhookDelivery.count({ where }),
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
  { platformKey: 'imdad', permissionKey: 'imdad.integrations.webhook.list' },
);
