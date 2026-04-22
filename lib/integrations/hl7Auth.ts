import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/db/prisma';

export type HL7AuthResult = {
  tenantId: string;
  keySource: 'global' | 'per-tenant';
};

/**
 * Validates an HL7 integration API key from a request.
 *
 * Authentication flow:
 * 1. Extract key from `x-api-key` or `Authorization: Bearer <key>` header
 * 2. If the global `HL7_INTEGRATION_API_KEY` env var is set and matches (timing-safe),
 *    use the `x-tenant-id` header to determine the tenant (backward compat).
 * 3. Otherwise, SHA-256 hash the key and look up `IntegrationApiKey` in the DB.
 *    The matched row carries the tenantId, so no header is needed.
 * 4. Validate that the resolved tenant actually exists.
 *
 * Returns the resolved tenantId + key source on success, or a NextResponse 401/400 on failure.
 */
export async function validateHL7ApiKey(
  req: NextRequest,
): Promise<HL7AuthResult | NextResponse> {
  const apiKey =
    req.headers.get('x-api-key') ||
    req.headers.get('authorization')?.replace('Bearer ', '');

  if (!apiKey) {
    return NextResponse.json(
      { error: 'Unauthorized: Missing API key / غير مصرح: مفتاح API مفقود' },
      { status: 401 },
    );
  }

  // -------------------------------------------------------------------------
  // Strategy 1: Global env key (backward compat)
  // -------------------------------------------------------------------------
  const globalKey = process.env.HL7_INTEGRATION_API_KEY;
  if (globalKey) {
    try {
      const keyBuf = Buffer.from(apiKey);
      const expectedBuf = Buffer.from(globalKey);
      if (
        keyBuf.length === expectedBuf.length &&
        crypto.timingSafeEqual(keyBuf, expectedBuf)
      ) {
        // Global key matched — tenant must come from header
        const tenantId = req.headers.get('x-tenant-id');
        if (!tenantId) {
          return NextResponse.json(
            { error: 'x-tenant-id header is required when using global API key' },
            { status: 400 },
          );
        }

        const tenantExists = await prisma.tenant.findUnique({
          where: { id: tenantId },
          select: { id: true },
        });
        if (!tenantExists) {
          return NextResponse.json(
            { error: 'Invalid tenant ID' },
            { status: 400 },
          );
        }

        return { tenantId, keySource: 'global' };
      }
    } catch {
      // Timing-safe compare can throw if buffers are drastically different encodings.
      // Fall through to per-tenant lookup.
    }
  }

  // -------------------------------------------------------------------------
  // Strategy 2: Per-tenant key lookup via SHA-256 hash
  // -------------------------------------------------------------------------
  const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

  const record = await prisma.integrationApiKey.findFirst({
    where: {
      keyHash,
      isActive: true,
      type: 'HL7',
    },
    select: {
      tenantId: true,
    },
  });

  if (!record) {
    return NextResponse.json(
      { error: 'Unauthorized: Invalid API key / غير مصرح: مفتاح API غير صالح' },
      { status: 401 },
    );
  }

  // Validate tenant still exists and is accessible
  const tenantExists = await prisma.tenant.findUnique({
    where: { id: record.tenantId },
    select: { id: true },
  });
  if (!tenantExists) {
    return NextResponse.json(
      { error: 'Tenant associated with API key no longer exists' },
      { status: 401 },
    );
  }

  return { tenantId: record.tenantId, keySource: 'per-tenant' };
}
