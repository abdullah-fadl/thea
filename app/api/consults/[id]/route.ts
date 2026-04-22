import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import prisma from '@/lib/db/prisma';

// GET /api/consults/[id]
// Returns consult request with its response
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }, params) => {
    const id = String((params as Record<string, string>)?.id || '').trim();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const consult = await prisma.consultRequest.findFirst({
      where: { id, tenantId },
    });

    if (!consult) {
      return NextResponse.json({ error: 'Consult not found' }, { status: 404 });
    }

    const response = await prisma.consultResponse.findFirst({
      where: { requestId: id, tenantId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ consult, response: response ?? null });
  }),
  { permissionKey: 'consults.view' },
);

// PUT /api/consults/[id]
// Body: { status } - updates consult status
export const PUT = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }, params) => {
    const id = String((params as Record<string, string>)?.id || '').trim();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const body = await req.json();
    const { status, consultantId } = body;

    const validStatuses = ['PENDING', 'ACKNOWLEDGED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status value' }, { status: 400 });
    }

    const existing = await prisma.consultRequest.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return NextResponse.json({ error: 'Consult not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (status) {
      updateData.status = status;
      if (status === 'ACKNOWLEDGED' && !existing.acknowledgedAt) {
        updateData.acknowledgedAt = new Date();
        updateData.consultantId = consultantId ?? userId;
      }
      if (status === 'COMPLETED' && !existing.completedAt) {
        updateData.completedAt = new Date();
      }
    }

    if (consultantId) updateData.consultantId = consultantId;

    const updated = await prisma.consultRequest.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ consult: updated });
  }),
  { permissionKey: 'consults.edit' },
);
