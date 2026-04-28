import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import prisma from '@/lib/db/prisma';
import { updateTransportStatus } from '@/lib/transport/transportEngine';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const updateStatusSchema = z.object({
  status: z.enum(['pending', 'assigned', 'in_transit', 'completed', 'cancelled']),
  cancelReason: z.string().optional(),
});

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ---------------------------------------------------------------------------
// GET /api/transport/requests/[id] — Get request detail
// ---------------------------------------------------------------------------

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }, params) => {
    const resolvedParams = params instanceof Promise ? await params : params;
    const id = resolvedParams?.id as string;

    if (!id) {
      return NextResponse.json({ error: 'Missing request ID' }, { status: 400 });
    }

    const request = await prisma.transportRequest.findFirst({
      where: { id, tenantId },
    });

    if (!request) {
      return NextResponse.json({ error: 'Transport request not found' }, { status: 404 });
    }

    // Check for stat escalation warning
    let escalationWarning = null;
    if (request.urgency === 'stat' && request.status === 'pending') {
      const minutesPending = Math.round(
        (Date.now() - new Date(request.createdAt).getTime()) / 60000,
      );
      if (minutesPending >= 5) {
        escalationWarning = {
          level: 'critical',
          message: `STAT transport pending for ${minutesPending} minutes — exceeds 5-minute threshold`,
          messageAr: `نقل طارئ معلق لمدة ${minutesPending} دقيقة — يتجاوز حد الـ 5 دقائق`,
          minutesPending,
        };
      }
    }

    // Isolation safety alert
    let isolationAlert = null;
    if (request.isolationRequired) {
      isolationAlert = {
        warning: true,
        message: `Isolation precautions required: ${request.isolationType || 'unspecified'}`,
        messageAr: `احتياطات العزل مطلوبة: ${request.isolationType || 'غير محدد'}`,
        isolationType: request.isolationType,
      };
    }

    return NextResponse.json({ request, escalationWarning, isolationAlert });
  }),
  {
    tenantScoped: true,
    platformKey: 'thea_health',
    permissionKey: 'transport.view',
  },
);

// ---------------------------------------------------------------------------
// PATCH /api/transport/requests/[id] — Update status
// ---------------------------------------------------------------------------

export const PATCH = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }, params) => {
    const resolvedParams = params instanceof Promise ? await params : params;
    const id = resolvedParams?.id as string;

    if (!id) {
      return NextResponse.json({ error: 'Missing request ID' }, { status: 400 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = updateStatusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    try {
      const updated = await updateTransportStatus({
        requestId: id,
        tenantId,
        status: parsed.data.status,
        userId,
        cancelReason: parsed.data.cancelReason,
      });

      return NextResponse.json({ request: updated });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to update transport status';
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }),
  {
    tenantScoped: true,
    platformKey: 'thea_health',
    permissionKey: 'transport.manage',
  },
);
