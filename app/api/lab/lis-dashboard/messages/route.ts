import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
export const dynamic = 'force-dynamic';
export const GET = withAuthTenant(
  async (req: NextRequest, { tenantId }: { tenantId: string }) => {
    try {
      // Query integration messages from existing message audit log
      const analyzers = await (prisma as any).lisConnectionStatus.findMany({ where: { tenantId }, take: 100 });
      const totalProcessed = analyzers.reduce((s: number, a: any) => s + (a.messagesProcessed || 0), 0);
      const totalFailed = analyzers.reduce((s: number, a: any) => s + (a.messagesFailed || 0), 0);
      return NextResponse.json({ analyzers, totalProcessed, totalFailed });
    } catch (e) { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
  },
  { permissionKey: 'lab.lis-dashboard.view' }
);
