import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
export const dynamic = 'force-dynamic';
export const POST = withAuthTenant(
  async (req: NextRequest, { tenantId }: { tenantId: string }) => {
    try {
      const { messageId } = await req.json();
      // In production this would re-queue the HL7/ASTM message
      return NextResponse.json({ success: true, retried: messageId });
    } catch (e) { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
  },
  { permissionKey: 'lab.lis-dashboard.view' }
);
