/**
 * Resolve the JWT-supplied tenantId (which may be a UUID or a tenant key)
 * to the canonical tenant.id UUID required by all PxCase / PxComment /
 * PxVisitExperience queries.
 *
 * Mirrors the inline pattern in `app/api/opd/departments/route.ts` but
 * centralized so every PX route shares the same resolution + error shape.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { isUuid, tenantWhere } from '@/lib/db/tenantLookup';

export async function resolvePxTenantUuid(
  tenantIdOrKey: string,
): Promise<{ tenantUuid: string } | NextResponse> {
  if (!tenantIdOrKey) {
    return NextResponse.json({ error: 'Missing tenant context' }, { status: 401 });
  }
  if (isUuid(tenantIdOrKey)) {
    return { tenantUuid: tenantIdOrKey };
  }
  const tenant = await prisma.tenant.findFirst({
    where: tenantWhere(tenantIdOrKey),
    select: { id: true },
  });
  if (!tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
  }
  return { tenantUuid: tenant.id };
}
