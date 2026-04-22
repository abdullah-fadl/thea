import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { validateBody, safeParseBody } from '@/lib/validation/helpers';
import { cancelRequest } from '@/lib/integrations/nphies/cancellation';
import { nphiesConfig } from '@/lib/integrations/nphies/config';
import { canAccessBilling } from '@/lib/billing/access';
import { logger } from '@/lib/monitoring/logger';
import { nanoid } from 'nanoid';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const cancelSchema = z.object({
  /** The type of request being cancelled */
  type: z.enum(['claim', 'prior-auth'], {
    message: 'type is required (claim or prior-auth)',
  }),
  /** Original NPHIES reference (claim reference or authorization number) */
  originalReference: z.string().min(1, 'originalReference is required'),
  /** Reason for cancellation */
  cancellationReason: z.string().min(1, 'cancellationReason is required'),
  /** Local record ID (nphiesClaim.id or nphiesPriorAuth.id) for updating local status */
  localRecordId: z.string().optional(),
  /** Insurer/payer ID */
  insurerId: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Route Config
// ---------------------------------------------------------------------------

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ---------------------------------------------------------------------------
// POST — Cancel a Claim or Prior Authorization
// ---------------------------------------------------------------------------

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user, role }) => {
    if (!canAccessBilling({ email: user?.email, tenantId, role })) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check NPHIES readiness
    const ready = nphiesConfig.checkReady();
    if (!ready.ready) {
      return NextResponse.json(
        { error: 'NPHIES integration is not configured', details: ready.reason },
        { status: 503 },
      );
    }

    // Parse and validate body
    const parsed = await safeParseBody(req);
    if ('error' in parsed) return parsed.error;
    const v = validateBody(parsed.body, cancelSchema);
    if ('error' in v) return v.error;

    const { type, originalReference, cancellationReason, localRecordId, insurerId } = v.data;

    // If a local record ID is given, verify it exists and belongs to this tenant
    if (localRecordId) {
      if (type === 'claim') {
        const existing = await (prisma as any).nphiesClaim.findFirst({
          where: { id: localRecordId, tenantId },
        });
        if (!existing) {
          return NextResponse.json(
            { error: 'Claim record not found' },
            { status: 404 },
          );
        }
        // Prevent cancelling already-cancelled claims
        if (existing.status === 'CANCELLED') {
          return NextResponse.json(
            { error: 'Claim is already cancelled' },
            { status: 409 },
          );
        }
      } else {
        const existing = await (prisma as any).nphiesPriorAuth.findFirst({
          where: { id: localRecordId, tenantId },
        });
        if (!existing) {
          return NextResponse.json(
            { error: 'Prior authorization record not found' },
            { status: 404 },
          );
        }
        if (existing.status === 'CANCELLED') {
          return NextResponse.json(
            { error: 'Prior authorization is already cancelled' },
            { status: 409 },
          );
        }
      }
    }

    // Send cancellation to NPHIES
    const result = await cancelRequest({
      tenantId,
      originalReference,
      cancellationReason,
      requestedBy: userId,
      type,
      insurerId,
    });

    // Store cancellation record
    const cancellationRecordId = `canc_${nanoid(12)}`;
    try {
      await (prisma as any).nphiesCancellation.create({
        data: {
          id: cancellationRecordId,
          tenantId,
          type,
          originalReference,
          localRecordId: localRecordId || null,
          cancellationReason,
          nphiesCancellationId: result.cancellationId,
          status: result.status,
          success: result.success,
          message: result.message,
          messageAr: result.messageAr,
          responseDate: new Date(result.responseDate),
          response: result as any,
          createdBy: userId,
        },
      });
    } catch (dbErr) {
      // Log but don't fail the request — the NPHIES call already succeeded/failed
      logger.warn('Failed to store cancellation record in DB', {
        category: 'billing',
        error: dbErr,
        cancellationRecordId,
      });
    }

    // Update local claim/prior-auth status if cancellation was successful
    if (result.success && localRecordId) {
      try {
        if (type === 'claim') {
          await (prisma as any).nphiesClaim.update({
            where: { id: localRecordId },
            data: {
              status: 'CANCELLED',
              cancelledAt: new Date(),
              cancelledBy: userId,
              cancellationReason,
            },
          });
        } else {
          await (prisma as any).nphiesPriorAuth.update({
            where: { id: localRecordId },
            data: {
              status: 'CANCELLED',
              cancelledAt: new Date(),
              cancelledBy: userId,
              cancellationReason,
            },
          });
        }
      } catch (updateErr) {
        logger.warn('Failed to update local record status after cancellation', {
          category: 'billing',
          error: updateErr,
          localRecordId,
          type,
        });
      }
    }

    return NextResponse.json({
      success: result.success,
      cancellation: {
        id: cancellationRecordId,
        nphiesCancellationId: result.cancellationId,
        status: result.status,
        message: result.message,
        messageAr: result.messageAr,
        responseDate: result.responseDate,
      },
    });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'billing.claims.create' },
);
