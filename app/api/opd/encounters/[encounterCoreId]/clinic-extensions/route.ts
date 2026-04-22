import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';

import { createAuditLog } from '@/lib/utils/audit';
import { ensureNotDeceasedFinalized } from '@/lib/core/guards/deathGuard';
import { buildClinicExtensionsPatch } from '@/lib/opd/clinicExtensions';
import { validateBody } from '@/lib/validation/helpers';
import { clinicExtensionsSchema } from '@/lib/validation/opd.schema';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }, params) => {

  const encounterCoreId = String((params as Record<string, string>)?.encounterCoreId || '').trim();
  if (!encounterCoreId) {
    return NextResponse.json({ error: 'encounterCoreId is required' }, { status: 400 });
  }

  const deathGuard = await ensureNotDeceasedFinalized({ tenantId, encounterCoreId });
  if (deathGuard) return deathGuard;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const v = validateBody(body, clinicExtensionsSchema);
  if ('error' in v) return v.error;
  const { opdClinicExtensions, extensions: extensionsField } = v.data;

  const extensions = opdClinicExtensions || extensionsField || null;
  if (!extensions || typeof extensions !== 'object' || Array.isArray(extensions)) {
    return NextResponse.json({ error: 'extensions is required' }, { status: 400 });
  }

  const encounterCore = await prisma.encounterCore.findFirst({
    where: { tenantId, id: encounterCoreId },
  });
  if (!encounterCore) {
    return NextResponse.json({ error: 'Encounter not found' }, { status: 404 });
  }
  if (encounterCore.encounterType !== 'OPD') {
    return NextResponse.json({ error: 'Encounter is not OPD' }, { status: 409 });
  }
  if (encounterCore.status === 'CLOSED') {
    return NextResponse.json({ error: 'Encounter is closed' }, { status: 409 });
  }

  const opd = await prisma.opdEncounter.findUnique({
    where: { encounterCoreId },
  });
  if (!opd) {
    return NextResponse.json({ error: 'OPD encounter not found' }, { status: 404 });
  }

  const existingExtensions = (opd.clinicExtensions as Record<string, unknown>) || {};
  const { invalidKeys, patch, nextExtensions } = buildClinicExtensionsPatch(existingExtensions, extensions);

  if (invalidKeys.length) {
    return NextResponse.json({ error: 'Invalid clinic extension keys', keys: invalidKeys }, { status: 400 });
  }
  if (!Object.keys(patch).length) {
    return NextResponse.json({ success: true, opd, noOp: true });
  }

  const updatedOpd = await prisma.opdEncounter.update({
    where: { encounterCoreId },
    data: { clinicExtensions: nextExtensions },
  });

  await createAuditLog(
    'opd_encounter',
    String(opd.id || encounterCoreId),
    'OPD_CLINIC_EXTENSIONS_UPDATE',
    userId || 'system',
    user?.email,
    { before: opd, after: updatedOpd },
    tenantId
  );

  return NextResponse.json({ success: true, opd: updatedOpd });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKeys: ['opd.doctor.encounter.view', 'opd.nursing.edit'] }
);
