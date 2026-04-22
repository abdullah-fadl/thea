import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { validateBody } from '@/lib/validation/helpers';
import {
  type VteRiskInput,
  type CapriniFactorKey,
  assessVteRisk,
  CAPRINI_1PT_FACTORS,
  CAPRINI_2PT_FACTORS,
  CAPRINI_3PT_FACTORS,
  CAPRINI_5PT_FACTORS,
} from '@/lib/clinical/vteRiskAssessment';

/**
 * POST /api/clinical/vte-risk
 *
 * Performs VTE (Venous Thromboembolism) risk assessment using:
 * - Padua Prediction Score for MEDICAL patients
 * - Caprini Score for SURGICAL patients
 *
 * Includes bleeding contraindication check before recommending
 * pharmacological prophylaxis.
 */

const allCapriniKeys = [
  ...CAPRINI_1PT_FACTORS,
  ...CAPRINI_2PT_FACTORS,
  ...CAPRINI_3PT_FACTORS,
  ...CAPRINI_5PT_FACTORS,
] as const;

// Build a Zod schema for capriniFactors as a record of optional booleans
const capriniFactorsSchema = z.record(
  z.enum(allCapriniKeys as unknown as [string, ...string[]]),
  z.boolean(),
).optional();

const vteRiskSchema = z.object({
  // Padua factors
  activeCancer: z.boolean(),
  previousVte: z.boolean(),
  reducedMobility: z.boolean(),
  thrombophilicCondition: z.boolean(),
  recentTraumaSurgery: z.boolean(),
  age: z.number().int().min(0).max(150),
  heartRespiratoryFailure: z.boolean(),
  acuteMiStroke: z.boolean(),
  acuteInfection: z.boolean(),
  bmi: z.number().min(5).max(100),
  ongoingHormones: z.boolean(),

  // Bleeding risk
  activeBleeding: z.boolean(),
  plateletCount: z.number().min(0).optional(),
  gfr: z.number().min(0).optional(),
  recentIntracranialHemorrhage: z.boolean(),
  epiduralCatheter: z.boolean(),

  // Patient type
  patientType: z.enum(['medical', 'surgical']),

  // Caprini additional factors (surgical patients)
  capriniFactors: capriniFactorsSchema,
});

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest) => {
    const rawBody = await req.json();
    const v = validateBody(rawBody, vteRiskSchema);
    if ('error' in v) return v.error;

    const input: VteRiskInput = {
      activeCancer: v.data.activeCancer,
      previousVte: v.data.previousVte,
      reducedMobility: v.data.reducedMobility,
      thrombophilicCondition: v.data.thrombophilicCondition,
      recentTraumaSurgery: v.data.recentTraumaSurgery,
      age: v.data.age,
      heartRespiratoryFailure: v.data.heartRespiratoryFailure,
      acuteMiStroke: v.data.acuteMiStroke,
      acuteInfection: v.data.acuteInfection,
      bmi: v.data.bmi,
      ongoingHormones: v.data.ongoingHormones,
      activeBleeding: v.data.activeBleeding,
      plateletCount: v.data.plateletCount,
      gfr: v.data.gfr,
      recentIntracranialHemorrhage: v.data.recentIntracranialHemorrhage,
      epiduralCatheter: v.data.epiduralCatheter,
      patientType: v.data.patientType,
      capriniFactors: v.data.capriniFactors as Partial<Record<CapriniFactorKey, boolean>> | undefined,
    };

    const result = assessVteRisk(input);

    return NextResponse.json({
      success: true,
      data: result,
    });
  }),
  { tenantScoped: true, permissionKey: 'orders.view' },
);
