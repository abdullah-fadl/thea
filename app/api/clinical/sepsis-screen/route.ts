import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { validateBody } from '@/lib/validation/helpers';
import {
  type SepsisScreeningInput,
  type ConsciousnessLevelSepsis,
  performComprehensiveSepsisScreening,
} from '@/lib/clinical/sepsisScreening';

/**
 * POST /api/clinical/sepsis-screen
 *
 * Performs comprehensive sepsis screening using three validated tools:
 * - qSOFA (Quick Sequential Organ Failure Assessment)
 * - SIRS (Systemic Inflammatory Response Syndrome)
 * - NEWS2 (National Early Warning Score 2)
 *
 * Returns combined risk stratification with clinical recommendations
 * following Surviving Sepsis Campaign (SSC) guidelines.
 */

const sepsisScreenSchema = z.object({
  respiratoryRate: z.number().min(0).max(80),
  systolicBP: z.number().min(0).max(300),
  heartRate: z.number().min(0).max(300),
  temperature: z.number().min(25).max(45), // Celsius
  oxygenSaturation: z.number().min(0).max(100),
  supplementalOxygen: z.boolean(),
  consciousnessLevel: z.enum(['alert', 'confused', 'voice', 'pain', 'unresponsive']),
  gcs: z.number().int().min(3).max(15).optional(),
  wbc: z.number().min(0).optional(),         // x10^3/uL
  bandPercentage: z.number().min(0).max(100).optional(),
  paco2: z.number().min(0).optional(),       // mmHg
  lactate: z.number().min(0).optional(),     // mmol/L
});

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest) => {
    const rawBody = await req.json();
    const v = validateBody(rawBody, sepsisScreenSchema);
    if ('error' in v) return v.error;

    const input: SepsisScreeningInput = {
      respiratoryRate: v.data.respiratoryRate,
      systolicBP: v.data.systolicBP,
      heartRate: v.data.heartRate,
      temperature: v.data.temperature,
      oxygenSaturation: v.data.oxygenSaturation,
      supplementalOxygen: v.data.supplementalOxygen,
      consciousnessLevel: v.data.consciousnessLevel as ConsciousnessLevelSepsis,
      gcs: v.data.gcs,
      wbc: v.data.wbc,
      bandPercentage: v.data.bandPercentage,
      paco2: v.data.paco2,
      lactate: v.data.lactate,
    };

    const result = performComprehensiveSepsisScreening(input);

    return NextResponse.json({
      success: true,
      data: result,
    });
  }),
  { tenantScoped: true, permissionKey: 'orders.view' },
);
