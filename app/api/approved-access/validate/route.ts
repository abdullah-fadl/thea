/**
 * GET /api/approved-access/validate
 *
 * Lightweight endpoint called by middleware (Edge Runtime) to validate
 * the approved_access_token cookie against the database.
 *
 * Returns { valid: true, tenantId } or { valid: false }.
 * No auth guard — the middleware itself is the caller and sends the
 * auth cookie along so the user is already authenticated at that point.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withErrorHandler(async (req: NextRequest) => {
  const tokenValue = req.cookies.get('approved_access_token')?.value;
  if (!tokenValue) {
    return NextResponse.json({ valid: false });
  }

  // Look up token in database — must be approved and not expired
  const record = await prisma.approvedAccessToken.findFirst({
    where: {
      accessToken: tokenValue,
      status: 'approved',
    },
    select: {
      id: true,
      tenantId: true,
      expiresAt: true,
      ownerId: true,
    },
  });

  if (!record) {
    return NextResponse.json({ valid: false });
  }

  if (record.expiresAt < new Date()) {
    return NextResponse.json({ valid: false });
  }

  return NextResponse.json({
    valid: true,
    tenantId: record.tenantId,
    ownerId: record.ownerId,
  });
});
