import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET  /api/imdad/workflow/requests/[id]/audit
// ---------------------------------------------------------------------------
export const GET = withAuthTenant(
  async (request, { tenantId }, params) => {
    try {
      const resolvedParams = params instanceof Promise ? await params : params;
      const id = resolvedParams.id;

      // Verify the request exists and belongs to this tenant
      const supplyRequest = await prisma.imdadSupplyRequest.findFirst({
        where: { id: id as string, tenantId, isDeleted: false },
        select: { id: true, code: true },
      });

      if (!supplyRequest) {
        return NextResponse.json({ error: 'Request not found' }, { status: 404 });
      }

      // Fetch all audit entries ordered chronologically
      const auditEntries = await prisma.imdadSupplyRequestAudit.findMany({
        where: { tenantId, requestId: id as string },
        orderBy: { createdAt: 'asc' },
        take: 200,
      });

      return NextResponse.json(auditEntries);
    } catch (err: any) {
      console.error('[IMDAD] Failed to fetch audit trail:', err);
      return NextResponse.json(
        { error: 'Failed to fetch audit trail', details: err?.message },
        { status: 500 },
      );
    }
  },
  { platformKey: 'imdad' as any, permissionKey: 'imdad.workflow.manage' },
);
