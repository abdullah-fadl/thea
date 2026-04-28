import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const VALID_STATUSES = [
  'PENDING',
  'CROSSMATCH',
  'APPROVED',
  'ISSUED',
  'TRANSFUSING',
  'COMPLETED',
  'CANCELLED',
] as const;

interface PrismaDelegate {
  findFirst: (args: any) => Promise<any | null>;
  findMany: (args: any) => Promise<any[]>;
  update: (args: any) => Promise<any>;
}

const db = prisma as unknown as Record<string, PrismaDelegate>;

/**
 * GET /api/blood-bank/requests/[id]
 * Get a single blood bank request with associated transfusions.
 */
export const GET = withAuthTenant(
  withErrorHandler(async (_req: NextRequest, { tenantId }, params) => {
    const resolvedParams = params instanceof Promise ? await params : params;
    const id = String(resolvedParams?.id || '').trim();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const request = await db.bloodBankRequest.findFirst({
      where: { id, tenantId },
    });

    if (!request) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    const transfusions = await db.transfusion.findMany({
      where: { requestId: id, tenantId },
      orderBy: { startTime: 'desc' },
    });

    return NextResponse.json({ request, transfusions });
  }),
  { permissionKey: 'blood_bank.view' }
);

/**
 * PUT /api/blood-bank/requests/[id]
 * Update blood bank request status.
 */
export const PUT = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }, params) => {
    const resolvedParams = params instanceof Promise ? await params : params;
    const id = String(resolvedParams?.id || '').trim();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const body = await req.json();
    const { status, notes, issuedUnits } = body;

    const existing = await db.bloodBankRequest.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    if (status && !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const updateData: any = { updatedAt: new Date() };
    if (status) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;
    if (issuedUnits !== undefined) updateData.issuedUnits = issuedUnits;
    if (status === 'APPROVED') updateData.approvedBy = userId;
    if (status === 'ISSUED') updateData.issuedAt = new Date();

    const updated = await db.bloodBankRequest.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ request: updated });
  }),
  { permissionKey: 'blood_bank.manage' }
);
