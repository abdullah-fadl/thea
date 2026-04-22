import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { validateBody } from '@/lib/validation/helpers';
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

  const record = await prisma.patientClinicalHistory.findFirst({
    where: { tenantId, patientId },
  });

  return NextResponse.json({ history: record?.history || null, record });
  }), { resourceType: 'patient', sensitive: true, extractPatientId: (req) => { const parts = req.nextUrl.pathname.split('/'); const idx = parts.indexOf('patients'); return idx >= 0 ? parts[idx + 1] || null : null; } }),
  { tenantScoped: true, permissionKey: 'clinical.view' }
);

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }, params) => {
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

  const bodySchema = z.object({
    history: z.unknown().optional(),
  }).passthrough();
  const v = validateBody(body, bodySchema);
  if ('error' in v) return v.error;

  const now = new Date();
  const existing = await prisma.patientClinicalHistory.findFirst({
    where: { tenantId, patientId },
  });

  if (existing) {
    await prisma.patientClinicalHistory.updateMany({
      where: { tenantId, patientId },
      data: {
        history: body.history || null,
        updatedAt: now,
        updatedBy: userId || null,
      },
    });
  } else {
    await prisma.patientClinicalHistory.create({
      data: {
        tenantId,
        patientId,
        history: body.history || null,
        updatedAt: now,
        updatedBy: userId || null,
        createdAt: now,
        createdBy: userId || null,
      },
    });
  }

  await createAuditLog(
    'patient_clinical_history',
    patientId,
    existing ? 'CLINICAL_HISTORY_UPDATED' : 'CLINICAL_HISTORY_CREATED',
    userId || 'system',
    undefined,
    { patientId },
    tenantId
  );

  return NextResponse.json({ success: true });
  }),
  { tenantScoped: true, permissionKey: 'clinical.edit' }
);
