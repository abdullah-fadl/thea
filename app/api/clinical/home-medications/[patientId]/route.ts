import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { validateBody } from '@/lib/validation/helpers';

const createHomeMedSchema = z.object({
  drugName: z.string().optional(),
  dose: z.string().optional(),
  unit: z.string().optional(),
  frequency: z.string().optional(),
  route: z.string().optional(),
  strength: z.string().optional(),
  form: z.string().optional(),
  source: z.string().optional(),
  notes: z.string().optional(),
}).passthrough();

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }, params) => {
  const patientId = (params as { patientId: string } | undefined)?.patientId;
  try {
    const medications = await prisma.homeMedication.findMany({
      where: { tenantId, patientId: patientId || undefined, isActive: true },
      orderBy: { drugName: 'asc' },
      take: 100,
    });
    return NextResponse.json({ items: medications });
  } catch {
    return NextResponse.json({ items: [] });
  }
}), { tenantScoped: true, permissionKeys: ['clinical.view', 'opd.doctor.encounter.view', 'opd.doctor.visit.view', 'opd.nursing.edit', 'opd.visit.view'] }
);

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }, params) => {
  const patientId = (params as { patientId: string } | undefined)?.patientId;
  const rawBody = await req.json();
  const v = validateBody(rawBody, createHomeMedSchema);
  if ('error' in v) return v.error;
  const body = v.data;

  const medication = await prisma.homeMedication.create({
    data: {
      tenantId,
      patientId: patientId || undefined,
      drugName: body.drugName,
      dose: body.dose,
      unit: body.unit,
      frequency: body.frequency,
      route: body.route,
      strength: body.strength,
      form: body.form,
      source: body.source,
      notes: body.notes,
      isActive: true,
      isVerified: false,
      createdBy: userId,
    },
  });

  return NextResponse.json({ success: true, medication });
}), { tenantScoped: true, permissionKey: 'clinical.edit' }
);
