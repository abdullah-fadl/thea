import { NextRequest, NextResponse } from 'next/server';
import { buildCapabilityStatement } from '@/lib/fhir/server';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';

/**
 * GET /api/fhir/metadata
 *
 * FHIR R4 CapabilityStatement — describes what this server supports.
 * This is a public endpoint (no auth required) per FHIR spec.
 */
export const GET = withErrorHandler(async (req: NextRequest) => {
  const baseUrl = new URL(req.url).origin;
  const capability = buildCapabilityStatement(baseUrl);

  return NextResponse.json(capability, {
    headers: {
      'Content-Type': 'application/fhir+json',
    },
  });
});
