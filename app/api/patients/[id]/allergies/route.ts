import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { validateBody } from '@/lib/validation/helpers';
import { createAllergySchema } from '@/lib/validation/patient.schema';
import { createAuditLog } from '@/lib/utils/audit';
import { withAccessAudit } from '@/lib/audit/accessLogger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withAccessAudit(withErrorHandler(async (req: NextRequest, { tenantId }, params) => {
  const patientId = String((params as { id?: string } | undefined)?.id || '').trim();
  if (!patientId) {
    return NextResponse.json({ error: 'patientId is required' }, { status: 400 });
  }

  // Fetch all active allergies; nkda column may not exist in older DBs
  const all = await prisma.patientAllergy.findMany({
    where: { tenantId, patientId, status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  const items = all.filter((r: any) => r.nkda !== true);
  const nkda = all.some((r: any) => r.nkda === true);
  return NextResponse.json({ items, nkda });
}), { resourceType: 'allergy', extractPatientId: (req) => { const parts = req.nextUrl.pathname.split('/'); const idx = parts.indexOf('patients'); return idx >= 0 ? parts[idx + 1] || null : null; }, logResponseMeta: true }),
  { tenantScoped: true, permissionKeys: ['clinical.view', 'opd.doctor.encounter.view', 'opd.doctor.visit.view', 'opd.nursing.edit', 'opd.visit.view'] }
);

export const POST = withAuthTenant(
  withAccessAudit(withErrorHandler(async (req: NextRequest, { tenantId, userId }, params) => {
  const patientId = String((params as { id?: string } | undefined)?.id || '').trim();
  if (!patientId) {
    return NextResponse.json({ error: 'patientId is required' }, { status: 400 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const v = validateBody(body, createAllergySchema);
  if ('error' in v) return v.error;
  const { allergen, substance, reaction, type, severity } = v.data;

  const now = new Date();
  await prisma.patientAllergy.updateMany({
    where: { tenantId, patientId, nkda: true, status: 'ACTIVE' },
    data: { status: 'INACTIVE', updatedAt: now, updatedBy: userId || null },
  });

  const record = await prisma.patientAllergy.create({
    data: {
      id: uuidv4(),
      tenantId,
      patientId,
      allergen: allergen || substance || '',
      reaction: reaction || null,
      type: type || 'DRUG',
      severity: severity || 'MODERATE',
      status: 'ACTIVE',
      nkda: false,
      createdAt: now,
      createdBy: userId || null,
      updatedAt: now,
      updatedBy: userId || null,
    },
  });

  await createAuditLog(
    'patient_allergy',
    record.id,
    'ALLERGY_CREATED',
    userId || 'system',
    undefined,
    { patientId, allergen: allergen || substance, type, severity },
    tenantId
  );

  return NextResponse.json({ success: true, allergy: record });
}), { resourceType: 'allergy', extractPatientId: (req) => { const parts = req.nextUrl.pathname.split('/'); const idx = parts.indexOf('patients'); return idx >= 0 ? parts[idx + 1] || null : null; }, action: 'data_create' }),
  { tenantScoped: true, permissionKey: 'clinical.edit' }
);
