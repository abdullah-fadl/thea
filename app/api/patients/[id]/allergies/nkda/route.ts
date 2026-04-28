import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { createAuditLog } from '@/lib/utils/audit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }, params) => {
  const patientId = String((params as { id?: string } | undefined)?.id || '').trim();
  if (!patientId) {
    return NextResponse.json({ error: 'patientId is required' }, { status: 400 });
  }

  const now = new Date();
  await prisma.patientAllergy.updateMany({
    where: { tenantId, patientId, status: 'ACTIVE' },
    data: { status: 'INACTIVE', updatedAt: now, updatedBy: userId || null },
  });

  const record = await prisma.patientAllergy.create({
    data: {
      id: uuidv4(),
      tenantId,
      patientId,
      allergen: 'NKDA',
      reaction: null,
      type: 'OTHER',
      severity: 'LOW',
      nkda: true,
      status: 'ACTIVE',
      createdAt: now,
      createdBy: userId || null,
      updatedAt: now,
      updatedBy: userId || null,
    },
  });

  await createAuditLog(
    'patient_allergy',
    record.id,
    'NKDA_RECORDED',
    userId || 'system',
    undefined,
    { patientId },
    tenantId
  );

  return NextResponse.json({ success: true, allergy: record });
}),
  { tenantScoped: true, permissionKey: 'clinical.edit' }
);
