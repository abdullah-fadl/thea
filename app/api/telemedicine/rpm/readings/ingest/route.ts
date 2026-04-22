import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
export const dynamic = 'force-dynamic';
export const POST = withAuthTenant(
  async (req: NextRequest, { tenantId }: { tenantId: string }) => {
    try {
      const { readings } = await req.json();
      if (!Array.isArray(readings)) return NextResponse.json({ error: 'readings must be array' }, { status: 400 });
      const created = [];
      for (const r of readings) {
        // Check thresholds
        const threshold = await (prisma as any).rpmThreshold.findFirst({
          where: { tenantId, patientId: r.patientId, readingType: r.readingType, isActive: true },
        });
        let isAbnormal = false;
        if (threshold) {
          const val = typeof r.value === 'object' ? r.value.systolic || r.value.value : r.value;
          if ((threshold.highCritical && val >= threshold.highCritical) || (threshold.lowCritical && val <= threshold.lowCritical) || (threshold.highWarning && val >= threshold.highWarning) || (threshold.lowWarning && val <= threshold.lowWarning)) {
            isAbnormal = true;
          }
        }
        const item = await (prisma as any).rpmReading.create({
          data: { tenantId, ...r, readAt: r.readAt || new Date(), isAbnormal, alertTriggered: isAbnormal },
        });
        created.push(item);
      }
      return NextResponse.json({ created, count: created.length }, { status: 201 });
    } catch (e) { return NextResponse.json({ error: 'Failed to ingest' }, { status: 500 }); }
  },
  { permissionKey: 'telemedicine.rpm.edit' }
);
