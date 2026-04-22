/**
 * SCM — SFDA Facility Compliance Status
 *
 * GET /api/imdad/integrations/sfda/compliance?licenseNumber=...
 *
 * Checks a facility's compliance status with the Saudi Food and Drug Authority.
 */

import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { createSfdaClient, SfdaError } from '@/lib/imdad/integrations/sfda';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const complianceQuerySchema = z.object({
  licenseNumber: z
    .string()
    .min(1, 'licenseNumber is required')
    .max(50, 'licenseNumber must be 50 characters or fewer'),
});

export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    try {
      const { searchParams } = new URL(req.url);
      const parsed = complianceQuerySchema.parse({
        licenseNumber: searchParams.get('licenseNumber') || '',
      });

      const client = createSfdaClient(tenantId);
      const result = await client.getComplianceStatus(parsed.licenseNumber, tenantId);

      return NextResponse.json({ data: result });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) },
          { status: 400 },
        );
      }
      if (error instanceof SfdaError) {
        return NextResponse.json(
          { error: error.message, errorCode: error.code },
          { status: error.statusCode ?? 502 },
        );
      }
      return NextResponse.json(
        { error: 'Internal Server Error' },
        { status: 500 },
      );
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.integrations.sfda.manage' },
);
