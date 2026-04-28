import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { withErrorHandler } from '@/lib/core/errors';
import { validateBody } from '@/lib/validation/helpers';
import {
  revokeBreakTheGlass,
  reviewBreakTheGlass,
} from '@/lib/audit/breakTheGlass';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract requestId from the URL pathname.
 * Route: /api/audit/break-the-glass/[requestId]
 */
function extractRequestId(req: NextRequest): string {
  const segments = req.nextUrl.pathname.split('/');
  // The requestId is the last segment
  return String(segments[segments.length - 1] || '').trim();
}

// ---------------------------------------------------------------------------
// GET — Get a single break-the-glass request by ID
// ---------------------------------------------------------------------------

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, role }) => {
    // Only admin/charge/thea-owner/compliance can view BTG details
    const roleLower = String(role || '').toLowerCase();
    const canView =
      roleLower === 'admin' ||
      roleLower === 'charge' ||
      roleLower === 'thea-owner' ||
      roleLower === 'compliance' ||
      roleLower === 'quality';
    if (!canView) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const requestId = extractRequestId(req);
    if (!requestId) {
      return NextResponse.json(
        { error: 'requestId is required' },
        { status: 400 }
      );
    }

    const record = await prisma.breakTheGlassRequest.findFirst({
      where: { tenantId, id: requestId },
    });
    if (!record) {
      return NextResponse.json(
        { error: 'Break-the-glass request not found' },
        { status: 404 }
      );
    }

    // Check if currently expired but not yet marked
    const now = new Date();
    if (record.status === 'ACTIVE' && record.expiresAt <= now) {
      await prisma.breakTheGlassRequest.update({
        where: { id: requestId },
        data: { status: 'EXPIRED' },
      });
      (record as Record<string, unknown>).status = 'EXPIRED';
    }

    return NextResponse.json({ item: record });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'admin.audit.view' }
);

// ---------------------------------------------------------------------------
// PATCH — Review or Revoke a break-the-glass request
// ---------------------------------------------------------------------------

const patchSchema = z.object({
  action: z.enum(['review', 'revoke']),
  reviewNotes: z.string().optional(),
});

export const PATCH = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, role }) => {
    // Only admin/charge/thea-owner can review/revoke
    const roleLower = String(role || '').toLowerCase();
    const canManage =
      roleLower === 'admin' ||
      roleLower === 'charge' ||
      roleLower === 'thea-owner' ||
      roleLower === 'compliance';
    if (!canManage) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const requestId = extractRequestId(req);
    if (!requestId) {
      return NextResponse.json(
        { error: 'requestId is required' },
        { status: 400 }
      );
    }

    // Verify the request belongs to this tenant
    const record = await prisma.breakTheGlassRequest.findFirst({
      where: { tenantId, id: requestId },
      select: { id: true, status: true },
    });
    if (!record) {
      return NextResponse.json(
        { error: 'Break-the-glass request not found' },
        { status: 404 }
      );
    }

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const v = validateBody(body, patchSchema);
    if ('error' in v) return v.error;

    const { action, reviewNotes } = v.data;

    try {
      if (action === 'revoke') {
        await revokeBreakTheGlass({
          requestId,
          revokedBy: userId,
          tenantId,
        });
        return NextResponse.json({
          success: true,
          message: 'Emergency access has been revoked',
          status: 'REVOKED',
        });
      }

      if (action === 'review') {
        await reviewBreakTheGlass({
          requestId,
          reviewedBy: userId,
          reviewNotes,
          tenantId,
        });
        return NextResponse.json({
          success: true,
          message: 'Emergency access has been reviewed and acknowledged',
          status: 'REVIEWED',
        });
      }

      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    } catch (err: any) {
      const message = err?.message || 'Operation failed';
      // Map known business errors to proper status codes
      if (message.includes('not found')) {
        return NextResponse.json({ error: message }, { status: 404 });
      }
      if (message.includes('Cannot revoke') || message.includes('already been reviewed')) {
        return NextResponse.json({ error: message }, { status: 409 });
      }
      throw err; // Let withErrorHandler handle unexpected errors
    }
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'admin.audit.view' }
);
