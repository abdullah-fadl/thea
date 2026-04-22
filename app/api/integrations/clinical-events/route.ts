import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import { ClinicalEvent } from '@/lib/models/ClinicalEvent';
import { withErrorHandler } from '@/lib/core/errors';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';

const createEventSchema = z.object({
  type: z.enum(['NOTE', 'ORDER', 'PROCEDURE', 'OTHER']),
  subject: z.string().optional(),
  payload: z.object({
    text: z.string().optional(),
    content: z.string().optional(),
    metadata: z.record(z.string(), z.any()).optional(),
  }).passthrough(), // Allow additional fields
});

/**
 * POST /api/integrations/clinical-events
 * Submit a clinical event for policy checking
 *
 * Body: { type, subject?, payload }
 * Response: { ok: true, eventId }
 */
export const POST = withAuthTenant(
  withErrorHandler(async (req, { user, tenantId, userId }) => {
  try {

    // Validate request body
    const body = await req.json();
    const validation = createEventSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { type, subject, payload } = validation.data;

    // Create clinical event
    const now = new Date();

    const event = await prisma.clinicalEvent.create({
      data: {
        tenantId,
        userId,
        platform: 'health',
        type,
        subject,
        payload: payload as Prisma.InputJsonValue,
        status: 'queued',
        createdAt: now,
        updatedAt: now,
      },
    });

    return NextResponse.json({
      ok: true,
      eventId: event.id,
    });
  } catch (error) {
    logger.error('Create clinical event error', { category: 'api', error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}),
  { tenantScoped: true, permissionKey: 'integrations.clinical-events' });
