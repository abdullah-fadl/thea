import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { createAuditLog } from '@/lib/utils/audit';
import { validateBody } from '@/lib/validation/helpers';

const departmentExitSchema = z.object({
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

  const v = validateBody(body, departmentExitSchema);
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

  const activeEntry = await prisma.departmentEntry.findFirst({
    where: {
      tenantId: tenant.id,
      encounterCoreId,
      departmentKey,
      status: 'IN',
      exitedAt: null,
    },
  });

  if (!activeEntry) {
    // Check if already exited
    const latestEntry = await prisma.departmentEntry.findFirst({
      where: {
        tenantId: tenant.id,
        encounterCoreId,
        departmentKey,
      },
      orderBy: [{ enteredAt: 'desc' }, { createdAt: 'desc' }],
    });
    if (latestEntry && latestEntry.status === 'OUT') {
      return NextResponse.json({ success: true, entry: latestEntry, noOp: true });
    }
    return NextResponse.json({ error: 'No active department entry to exit' }, { status: 409 });
  }

  const now = new Date();

  const updatedEntry = await prisma.departmentEntry.update({
    where: { id: activeEntry.id },
    data: {
      exitedAt: now,
      status: 'OUT',
    },
  });

  await createAuditLog(
    'department_entry',
    activeEntry.id,
    'EXIT_DEPARTMENT',
    userId || 'system',
    user?.email,
    { before: activeEntry, after: updatedEntry },
    tenantId
  );

  return NextResponse.json({ success: true, entry: updatedEntry });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'registration.view' }
);
