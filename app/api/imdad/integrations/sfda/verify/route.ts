/**
 * SCM — SFDA GTIN Verification
 *
 * POST /api/imdad/integrations/sfda/verify
 *
 * Verifies a GTIN barcode against the SFDA product database.
 * Supports both GTIN and NDC lookups via the `lookupType` field.
 */

import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { createSfdaClient, SfdaError } from '@/lib/imdad/integrations/sfda';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const verifySchema = z.object({
  /** GTIN barcode or NDC code to verify */
  code: z.string().min(1, 'code is required').max(20, 'code must be 20 characters or fewer'),
  /** Type of lookup: gtin (default) or ndc */
  lookupType: z.enum(['gtin', 'ndc']).default('gtin'),
});

export const POST = withAuthTenant(
  async (req, { tenantId }) => {
    try {
      const body = await req.json();
      const parsed = verifySchema.parse(body);

      const client = createSfdaClient(tenantId);

      const result = parsed.lookupType === 'ndc'
        ? await client.getProductByNdc(parsed.code, tenantId)
        : await client.verifyGtin(parsed.code, tenantId);

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
  { platformKey: 'imdad', permissionKey: 'imdad.integrations.sfda.verify' },
);
