import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
export const dynamic = 'force-dynamic';
export const POST = withAuthTenant(
  async (req: NextRequest, { tenantId }, params: any) => {
    try {
      const recording = await (prisma as any).ctgRecording.findFirst({ where: { id: params.recordingId, tenantId } }) as any;
      if (!recording) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      const fhr = Array.isArray(recording.fhrData) ? recording.fhrData : [];
      const bpms = fhr.map((p: any) => p.bpm).filter(Boolean);
      const baseline = bpms.length > 0 ? Math.round(bpms.reduce((s: number, v: number) => s + v, 0) / bpms.length) : null;
      // Simplified variability calculation
      let variability = 'MODERATE';
      if (bpms.length > 1) {
        const diffs = bpms.slice(1).map((v: number, i: number) => Math.abs(v - bpms[i]));
        const avgDiff = diffs.reduce((s: number, v: number) => s + v, 0) / diffs.length;
        if (avgDiff < 2) variability = 'ABSENT';
        else if (avgDiff < 5) variability = 'MINIMAL';
        else if (avgDiff > 25) variability = 'MARKED';
      }
      // NICHD Category
      let category = 'I';
      if (baseline && (baseline < 110 || baseline > 160)) category = 'II';
      if (variability === 'ABSENT' || variability === 'MINIMAL') category = 'II';
      if (variability === 'ABSENT' && baseline && baseline < 100) category = 'III';
      const item = await (prisma as any).ctgRecording.update({
        where: { id: params.recordingId },
        data: { baselineRate: baseline, variability, category, interpretation: 'Auto-interpreted: Category ' + category },
      });
      return NextResponse.json({ item, interpretation: { baseline, variability, category } });
    } catch (e) { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
  },
  { permissionKey: 'obgyn.ctg.edit' }
);
