import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { createAuditLog } from '@/lib/utils/audit';
import { validateBody } from '@/lib/validation/helpers';

const departmentEnterSchema = z.object({
  encounterCoreId: z.string().min(1, 'encounterCoreId is required'),
  departmentKey: z.string().min(1, 'departmentKey is required'),
}).passthrough();

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DEPARTMENT_KEYS = new Set([
  'OPD',
  'LABORATORY',
  'RADIOLOGY',
  'OPERATING_ROOM',
  'CATH_LAB',
  'PHYSIOTHERAPY',
  'DELIVERY',
  'CRITICAL_CARE',
  'MORTUARY',
]);

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }) => {
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const v = validateBody(body, departmentEnterSchema);
  if ('error' in v) return v.error;

  const encounterCoreId = String(body.encounterCoreId || '').trim();
  const departmentKey = String(body.departmentKey || '').trim().toUpperCase();
  if (!encounterCoreId || !departmentKey) {
    return NextResponse.json({ error: 'encounterCoreId and departmentKey are required' }, { status: 400 });
  }
  if (!DEPARTMENT_KEYS.has(departmentKey)) {
    return NextResponse.json({ error: 'Invalid departmentKey' }, { status: 400 });
  }

  // Resolve tenant UUID from tenant key
  const tenant = await prisma.tenant.findFirst({ where: { tenantId } });
  if (!tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
  }

  const encounter = await prisma.encounterCore.findFirst({
    where: { tenantId: tenant.id, id: encounterCoreId },
  });
  if (!encounter) {
    return NextResponse.json({ error: 'Encounter not found' }, { status: 404 });
  }
  if (encounter.status === 'CLOSED') {
    return NextResponse.json({ error: 'Encounter is closed' }, { status: 409 });
  }

  const now = new Date();

  // Check if there's already an active entry (upsert behavior)
  const existingEntry = await prisma.departmentEntry.findFirst({
    where: {
      tenantId: tenant.id,
      encounterCoreId,
      departmentKey,
      status: 'IN',
      exitedAt: null,
    },
  });

  if (existingEntry) {
    // Already entered - no-op
    return NextResponse.json({ success: true, entry: existingEntry, noOp: true });
  }

  // Create new entry
  const entry = await prisma.departmentEntry.create({
    data: {
      tenantId: tenant.id,
      encounterCoreId,
      patientId: encounter.patientId || null,
      departmentKey,
      enteredAt: now,
      exitedAt: null,
      status: 'IN',
      createdByUserId: userId,
    },
  });

  await createAuditLog(
    'department_entry',
    entry.id,
    'ENTER_DEPARTMENT',
    userId || 'system',
    user?.email,
    { after: entry },
    tenantId
  );

  return NextResponse.json({ success: true, entry, noOp: false });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'registration.view' }
);
