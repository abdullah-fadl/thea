import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { runBulkGapScan, scanPatientForGaps } from '@/lib/quality/careGapScanner';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const scanSchema = z.object({
  patientId: z.string().uuid().optional(),
  ruleIds: z.array(z.string()).optional(),
}).passthrough();

/**
 * POST /api/care-gaps/scan
 *
 * Trigger a care gap scan.
 * - If patientId is provided, scan a single patient.
 * - Otherwise, run a bulk scan on all active patients (up to 5000).
 */
export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // Empty body = bulk scan all patients
    }

    const parsed = scanSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { patientId, ruleIds } = parsed.data;

    if (patientId) {
      // Single patient scan
      const result = await scanPatientForGaps(patientId, tenantId);
      return NextResponse.json({
        ok: true,
        mode: 'single',
        patientId,
        gapsFound: result.gapsFound,
        gapsCreated: result.gapsCreated,
      });
    }

    // Bulk scan
    const result = await runBulkGapScan(tenantId, { ruleIds });
    return NextResponse.json({
      ok: true,
      mode: 'bulk',
      ...result,
    });
  }),
  {
    tenantScoped: true,
    platformKey: 'thea_health',
    permissionKey: 'care-gaps.scan',
  }
);
