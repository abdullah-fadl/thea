import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
export const dynamic = 'force-dynamic';
export const GET = withAuthTenant(
  async (req: NextRequest, { tenantId }, params: any) => {
    try {
      const [devices, readings, thresholds] = await Promise.all([
        (prisma as any).rpmDevice.findMany({ where: { tenantId, patientId: params.patientId, isActive: true }, take: 100 }),
        (prisma as any).rpmReading.findMany({ where: { tenantId, patientId: params.patientId }, orderBy: { readAt: 'desc' }, take: 100 }),
        (prisma as any).rpmThreshold.findMany({ where: { tenantId, patientId: params.patientId, isActive: true }, take: 100 }),
      ]);
      const alerts = readings.filter((r: any) => r.isAbnormal && !r.alertAckedBy);
      return NextResponse.json({ devices, readings, thresholds, alerts });
    } catch (e) { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
  },
  { permissionKey: 'telemedicine.rpm.view' }
);
