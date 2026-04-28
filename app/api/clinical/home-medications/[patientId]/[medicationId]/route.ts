import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { validateBody } from '@/lib/validation/helpers';

const updateHomeMedSchema = z.object({}).passthrough();

export const PATCH = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }, params) => {
  const { patientId, medicationId } = (params || {}) as { patientId: string; medicationId: string };
  const rawBody = await req.json();
  const v = validateBody(rawBody, updateHomeMedSchema);
  if ('error' in v) return v.error;
  const updates = v.data;

  const existing = await prisma.homeMedication.findFirst({
    where: { id: medicationId, patientId, tenantId },
  });

  if (!existing) {
    return NextResponse.json({ error: 'Medication not found' }, { status: 404 });
  }

  const result = await prisma.homeMedication.update({
    where: { id: medicationId },
    data: {
      ...updates,
      updatedAt: new Date(),
      updatedBy: userId,
    },
  });

  return NextResponse.json({ success: true, medication: result });
}), { tenantScoped: true, permissionKey: 'clinical.edit' }
);

export const DELETE = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }, params) => {
  const { patientId, medicationId } = (params || {}) as { patientId: string; medicationId: string };

  await prisma.homeMedication.updateMany({
    where: { id: medicationId, patientId, tenantId },
    data: { isActive: false, deletedAt: new Date() },
  });

  return NextResponse.json({ success: true });
}), { tenantScoped: true, permissionKey: 'clinical.edit' }
);
