import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import {
  getPopulationSummary,
  computePatientRiskScore,
  detectCareGaps,
} from '@/lib/analytics/population';

export const dynamic = 'force-dynamic';

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const params = new URL(req.url).searchParams;

    // Individual patient risk
    if (params.get('patientId')) {
      const profile = await computePatientRiskScore(tenantId, params.get('patientId')!);
      if (!profile) return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
      return NextResponse.json(profile);
    }

    // Care gaps for a patient
    if (params.get('careGaps') && params.get('pid')) {
      const gaps = await detectCareGaps(tenantId, params.get('pid')!);
      return NextResponse.json({ careGaps: gaps, total: gaps.length });
    }

    // Population summary
    const summary = await getPopulationSummary(tenantId);
    return NextResponse.json(summary);
  }),
  { tenantScoped: true, permissionKey: 'admin.settings.view' },
);
