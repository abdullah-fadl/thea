import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { validateBody } from '@/lib/validation/helpers';
import { calculatePediatricDose, getDrugInfo, listAvailableDrugs } from '@/lib/clinical/dosageCalc';

const dosageCalcSchema = z.object({
  drugCode: z.string().min(1, 'drugCode is required'),
  patientWeight: z.number({ error: 'patientWeight is required' }),
  patientAge: z.number({ error: 'patientAge is required' }),
  patientAgeMonths: z.number().optional(),
  indication: z.string().optional(),
  renalFunction: z.string().optional(),
  hepaticFunction: z.string().optional(),
}).passthrough();

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest) => {
  const rawBody = await req.json();
  const v = validateBody(rawBody, dosageCalcSchema);
  if ('error' in v) return v.error;
  const { drugCode, patientWeight, patientAge, patientAgeMonths, indication, renalFunction, hepaticFunction } = v.data;

  const result = calculatePediatricDose({
    drugCode,
    patientWeight,
    patientAge,
    patientAgeMonths,
    indication,
    renalFunction: renalFunction as 'normal' | 'mild' | 'moderate' | 'severe',
    hepaticFunction: hepaticFunction as 'normal' | 'mild' | 'moderate' | 'severe',
  });

  if (!result) {
    return NextResponse.json(
      { error: 'Drug not found in pediatric database', availableDrugs: listAvailableDrugs() },
      { status: 404 }
    );
  }

  return NextResponse.json({
    drug: getDrugInfo(drugCode),
    calculation: result,
  });
}), { tenantScoped: true, permissionKey: 'clinical.prescribe' }
);

export const GET = withAuthTenant(
  withErrorHandler(async () => {
  return NextResponse.json({ drugs: listAvailableDrugs() });
}), { tenantScoped: true, permissionKey: 'clinical.prescribe' }
);
