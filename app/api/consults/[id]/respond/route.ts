import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import prisma from '@/lib/db/prisma';

// POST /api/consults/[id]/respond
// Body: { findings, impression, recommendations, followUpNeeded, followUpDate }
export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }, params) => {
    const requestId = String((params as Record<string, string>)?.id || '').trim();
    if (!requestId) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const body = await req.json();
    const { findings, impression, recommendations, followUpNeeded, followUpDate } = body;

    if (!findings || !impression || !recommendations) {
      return NextResponse.json(
        { error: 'findings, impression, and recommendations are required' },
        { status: 400 },
      );
    }

    // Verify consult belongs to tenant
    const consult = await prisma.consultRequest.findFirst({
      where: { id: requestId, tenantId },
    });
    if (!consult) {
      return NextResponse.json({ error: 'Consult not found' }, { status: 404 });
    }

    // Upsert response (one response per consult; re-submitting replaces)
    const existing = await prisma.consultResponse.findFirst({
      where: { requestId, tenantId },
    });

    let response;
    if (existing) {
      response = await prisma.consultResponse.update({
        where: { id: existing.id },
        data: {
          findings,
          impression,
          recommendations,
          followUpNeeded: followUpNeeded ?? false,
          followUpDate: followUpDate ? new Date(followUpDate) : null,
          updatedAt: new Date(),
        },
      });
    } else {
      response = await prisma.consultResponse.create({
        data: {
          tenantId,
          requestId,
          consultantId: userId,
          findings,
          impression,
          recommendations,
          followUpNeeded: followUpNeeded ?? false,
          followUpDate: followUpDate ? new Date(followUpDate) : null,
        },
      });
    }

    // Auto-advance consult to COMPLETED when response is submitted
    await prisma.consultRequest.update({
      where: { id: requestId },
      data: {
        status: 'COMPLETED',
        completedAt: consult.completedAt ?? new Date(),
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ response }, { status: existing ? 200 : 201 });
  }),
  { permissionKey: 'consults.respond' },
);
