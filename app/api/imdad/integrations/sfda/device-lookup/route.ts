/**
 * SCM — SFDA Medical Device UDI Lookup
 *
 * POST /api/imdad/integrations/sfda/device-lookup
 *
 * Looks up a medical device by its Unique Device Identifier (UDI) via SFDA.
 * Phase 5 stub — actual SFDA endpoints TBD.
 */

import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { sfdaClient } from '@/lib/imdad/integrations/sfda';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const deviceLookupSchema = z.object({
  udiCode: z
    .string()
    .min(1, 'udiCode is required')
    .max(100, 'udiCode must be 100 characters or fewer'),
  organizationId: z.string().uuid('organizationId must be a valid UUID'),
});

export const POST = withAuthTenant(
  async (req, { tenantId }) => {
    try {
      const body = await req.json();
      const parsed = deviceLookupSchema.parse(body);

      const result = await sfdaClient.lookupDeviceUdi(
        parsed.udiCode,
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
  { platformKey: 'imdad', permissionKey: 'imdad.integrations.sfda.device_lookup' },
);
