/**
 * SCM — SFDA Drug Registration Verification
 *
 * POST /api/imdad/integrations/sfda/verify-drug
 *
 * Verifies whether a drug is registered with the Saudi Food and Drug Authority.
 * Phase 5 stub — actual SFDA endpoints TBD.
 */

import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { sfdaClient } from '@/lib/imdad/integrations/sfda';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const verifyDrugSchema = z.object({
  registrationNumber: z
    .string()
    .min(1, 'registrationNumber is required')
    .max(50, 'registrationNumber must be 50 characters or fewer'),
  organizationId: z.string().uuid('organizationId must be a valid UUID'),
});

export const POST = withAuthTenant(
  async (req, { tenantId }) => {
    try {
      const body = await req.json();
      const parsed = verifyDrugSchema.parse(body);

      const result = await (sfdaClient as any).verifyDrugRegistration(
        parsed.registrationNumber,
        tenantId,
        parsed.organizationId,
      );

      if (!result.success) {
        return NextResponse.json(
          { error: result.error, errorCode: result.errorCode },
          { status: 502 },
        );
      }

      return NextResponse.json({ data: result.data });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) },
          { status: 400 },
        );
      }
      return NextResponse.json(
        { error: 'Internal Server Error' },
        { status: 500 },
      );
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.integrations.sfda.verify' },
);
