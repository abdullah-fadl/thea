import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { validateBody } from '@/lib/validation/helpers';
import { checkDrugAllergy, PatientAllergy } from '@/lib/clinical/allergyCheck';

const allergyCheckSchema = z.object({
  patientId: z.string().min(1, 'patientId required'),
  drugName: z.string().optional(),
  drugs: z.array(z.string()).optional(),
}).passthrough();

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
  const rawBody = await req.json();
  const v = validateBody(rawBody, allergyCheckSchema);
  if ('error' in v) return v.error;
  const { patientId, drugName, drugs } = v.data;

  if (!drugName && !drugs) {
    return NextResponse.json({ error: 'drugName or drugs array required' }, { status: 400 });
  }

  const patient = await prisma.patientMaster.findFirst({
    where: { id: patientId, tenantId },
    select: { id: true, knownAllergies: true },
  });

  if (!patient) {
    return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
  }

  // Also fetch structured allergies from the patient_allergies table
  const patientAllergies = await prisma.patientAllergy.findMany({
    where: { patientId, tenantId, status: 'active' },
  });

  // Combine knownAllergies (JSON) and structured allergy records
  const knownAllergyList = Array.isArray(patient.knownAllergies) ? (patient.knownAllergies as Record<string, unknown>[]) : [];
  const allergies: PatientAllergy[] = [
    ...knownAllergyList.map((a: any) => ({
      allergen: typeof a === 'string' ? a : a.allergen || a.name,
      reaction: a.reaction,
      severity: a.severity,
    })),
    ...patientAllergies.map((a) => ({
      allergen: a.allergen,
      reaction: a.reaction || undefined,
      severity: a.severity || undefined,
    })),
  ];

  if (drugName) {
    const result = checkDrugAllergy(drugName, allergies);
    return NextResponse.json(result);
  }

  if (Array.isArray(drugs)) {
    const results: any = {};
    for (const drug of drugs) {
      results[drug] = checkDrugAllergy(drug, allergies);
    }
    return NextResponse.json({ results });
  }

  return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
}), { tenantScoped: true, permissionKey: 'clinical.prescribe' }
);
