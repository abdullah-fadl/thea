import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { withErrorHandler } from '@/lib/core/errors';
import { validateBody } from '@/lib/validation/helpers';
import {
  requestBreakTheGlass,
  expireStaleRequests,
} from '@/lib/audit/breakTheGlass';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ---------------------------------------------------------------------------
// GET — List break-the-glass requests (with optional filters)
// ---------------------------------------------------------------------------

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, role }) => {
    // Only admin/charge/thea-owner can view BTG audit
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

    // Expire stale requests first (lazy cleanup)
    await expireStaleRequests(tenantId);

    // Parse filters from query params
    const url = req.nextUrl;
    const status = url.searchParams.get('status') || undefined;
    const patientId = url.searchParams.get('patientId') || undefined;
    const requesterId = url.searchParams.get('requesterId') || undefined;
    const fromDate = url.searchParams.get('from') || undefined;
    const toDate = url.searchParams.get('to') || undefined;
    const pendingReview = url.searchParams.get('pendingReview') === 'true';
    const limit = Math.min(Number(url.searchParams.get('limit')) || 200, 500);

    // Build where clause
    const where: Record<string, any> = { tenantId };

    if (pendingReview) {
      // Show items awaiting supervisor review
      where.status = { in: ['ACTIVE', 'EXPIRED', 'REVOKED'] };
    } else if (status) {
      where.status = status.toUpperCase();
    }

    if (patientId) where.patientId = patientId;
    if (requesterId) where.requesterId = requesterId;

    if (fromDate || toDate) {
      where.grantedAt = {};
      if (fromDate) {
        const d = new Date(fromDate);
        if (!isNaN(d.getTime())) where.grantedAt.gte = d;
      }
      if (toDate) {
        const d = new Date(toDate);
        if (!isNaN(d.getTime())) where.grantedAt.lte = d;
      }
      if (Object.keys(where.grantedAt).length === 0) delete where.grantedAt;
    }

    const items = await prisma.breakTheGlassRequest.findMany({
      where,
      orderBy: { grantedAt: 'desc' },
      take: limit,
    });

    return NextResponse.json({ items, count: items.length });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'admin.audit.view' }
);

// ---------------------------------------------------------------------------
// POST — Create a new break-the-glass request (request emergency access)
// ---------------------------------------------------------------------------

const createSchema = z.object({
  patientId: z.string().uuid('patientId must be a valid UUID'),
  reason: z.string().min(10, 'Reason must be at least 10 characters'),
  reasonCategory: z
    .enum(['LIFE_THREATENING', 'URGENT_CARE', 'CONTINUITY_OF_CARE'])
    .optional(),
  durationMinutes: z.number().int().min(1).max(480).optional(),
});

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user, userId, role }) => {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const v = validateBody(body, createSchema);
    if ('error' in v) return v.error;

    const { patientId, reason, reasonCategory, durationMinutes } = v.data;

    // Verify the patient exists in this tenant
    const patient = await prisma.patientMaster.findFirst({
      where: { tenantId, id: patientId },
      select: { id: true },
    });
    if (!patient) {
      return NextResponse.json(
        { error: 'Patient not found in this tenant' },
        { status: 404 }
      );
    }

    // Extract IP from request headers
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      undefined;

    const grant = await requestBreakTheGlass({
      tenantId,
      userId,
      userName: user?.displayName || user?.firstName
        ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
        : undefined,
      userRole: role,
      patientId,
      reason,
      reasonCategory,
      durationMinutes,
      ip,
    });

    return NextResponse.json(
      {
        success: true,
        id: grant.id,
        expiresAt: grant.expiresAt.toISOString(),
        message: 'Emergency access granted. This access is time-limited and will be audited.',
      },
      { status: 201 }
    );
  }),
  { tenantScoped: true, platformKey: 'thea_health' }
);
