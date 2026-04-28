import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { validateBody } from '@/lib/validation/helpers';


const medReconciliationSchema = z.object({
  type: z.enum(['admission', 'discharge']),
  items: z.array(z.any()).optional(),
  homeMedications: z.array(z.any()).optional(),
}).passthrough();

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }, params) => {
  const encounterId = (params as { encounterId: string } | undefined)?.encounterId;
  const items = await prisma.medReconciliation.findMany({
    where: { tenantId, encounterId },
    orderBy: [{ completedAt: 'desc' }, { createdAt: 'desc' }],
    take: 100,
  });

  if (!items.length) {
    return NextResponse.json({ items: [], status: 'not_started' });
  }

  return NextResponse.json({ items });
}), { tenantScoped: true, permissionKey: 'clinical.view' }
);

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }, params) => {
  const encounterId = (params as { encounterId: string } | undefined)?.encounterId;
  const rawBody = await req.json();
  const v = validateBody(rawBody, medReconciliationSchema);
  if ('error' in v) return v.error;
  const { type, items, homeMedications } = v.data;

  const now = new Date();

  const existingRecon = await prisma.medReconciliation.findFirst({
    where: { tenantId, encounterId, type },
  });

  let reconciliation;
  if (existingRecon) {
    reconciliation = await prisma.medReconciliation.update({
      where: { id: existingRecon.id },
      data: {
        items: (items || []) as any,
        homeMedications: (homeMedications || []) as any,
        status: 'completed',
        completedBy: userId,
        completedAt: now,
      },
    });
  } else {
    reconciliation = await prisma.medReconciliation.create({
      data: {
        tenantId,
        encounterId,
        type,
        items: (items || []) as any,
        homeMedications: (homeMedications || []) as any,
        status: 'completed',
        completedBy: userId,
        completedAt: now,
      },
    });
  }

  if (type === 'discharge' && Array.isArray(items)) {
    const dischargeMeds = items.filter((i: any) => i.includeInDischarge);
    const existing = await prisma.dischargePrescription.findFirst({
      where: { tenantId, encounterId, reconciliationId: reconciliation.id },
    });

    if (!existing) {
      for (const med of dischargeMeds) {
        await prisma.dischargePrescription.create({
          data: {
            tenantId,
            encounterId,
            reconciliationId: reconciliation.id,
            drugName: med.drugName || '',
            dose: med.dose || '',
            unit: med.unit || 'mg',
            frequency: med.frequency || '',
            route: med.route || 'PO',
            duration: med.duration || null,
            quantity: med.quantity != null ? String(med.quantity) : null,
            refills: med.refills != null ? parseInt(String(med.refills), 10) || 0 : null,
            instructions: med.instructions || null,
            status: 'pending',
            createdAt: now,
            createdBy: userId,
          },
        });
      }
    }
  }

  return NextResponse.json({ success: true, reconciliation });
}), { tenantScoped: true, permissionKey: 'clinical.edit' }
);
