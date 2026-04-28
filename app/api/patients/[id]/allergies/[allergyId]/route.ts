import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { createAuditLog } from '@/lib/utils/audit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const DELETE = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }, params) => {
  const patientId = String((params as Record<string, string>)?.id || '').trim();
  const allergyId = String((params as Record<string, string>)?.allergyId || '').trim();
  if (!patientId || !allergyId) {
    return NextResponse.json({ error: 'patientId and allergyId are required' }, { status: 400 });
  }

  await prisma.patientAllergy.updateMany({
    where: { tenantId, patientId, id: allergyId },
    data: { status: 'INACTIVE', updatedAt: new Date(), updatedBy: userId || null },
  });

  await createAuditLog(
    'patient_allergy',
    allergyId,
    'ALLERGY_DEACTIVATED',
    userId || 'system',
    undefined,
    { patientId },
    tenantId
  );

  return NextResponse.json({ success: true });
}),
  { tenantScoped: true, permissionKey: 'clinical.edit' }
);
