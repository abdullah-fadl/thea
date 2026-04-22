import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { validateBody } from '@/lib/validation/helpers';
import {
  validateDoseRange,
  validateMultipleDoses,
  listDrugDatabase,
  findDrug,
  type DoseValidationRequest,
  type BulkDoseValidationItem,
} from '@/lib/clinical/doseRangeValidation';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const doseCheckSchema = z.object({
  drugName: z.string().min(1, 'drugName is required'),
  dose: z.number().positive('dose must be positive'),
  unit: z.string().min(1, 'unit is required'),
  frequency: z.string().min(1, 'frequency is required'),
  route: z.string().default('PO'),
  patientAge: z.number().min(0).optional(),
  patientWeight: z.number().positive().optional(),
  gfr: z.number().min(0).optional(),
  hepaticFunction: z.enum(['normal', 'mild', 'moderate', 'severe']).optional(),
  isPregnant: z.boolean().optional(),
  durationDays: z.number().positive().optional(),
});

const bulkDoseCheckSchema = z.object({
  items: z.array(
    doseCheckSchema.extend({
      lineId: z.string().optional(),
    })
  ).min(1, 'At least one item is required').max(50, 'Maximum 50 items per request'),
});

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ---------------------------------------------------------------------------
// POST /api/clinical/dose-check
// ---------------------------------------------------------------------------

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest) => {
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    // Check if this is a bulk request
    if (rawBody && typeof rawBody === 'object' && 'items' in rawBody) {
      const v = validateBody(rawBody, bulkDoseCheckSchema);
      if ('error' in v) return v.error;

      const results = validateMultipleDoses(v.data.items as BulkDoseValidationItem[]);
      const hasCritical = results.some((r) => !r.valid);

      return NextResponse.json({
        bulk: true,
        totalItems: results.length,
        hasCriticalAlerts: hasCritical,
        results,
      });
    }

    // Single dose check
    const v = validateBody(rawBody, doseCheckSchema);
    if ('error' in v) return v.error;

    const result = validateDoseRange(v.data as DoseValidationRequest);

    return NextResponse.json(result);
  }),
  {
    tenantScoped: true,
    platformKey: 'thea_health',
    permissionKey: 'orders.create',
  }
);

// ---------------------------------------------------------------------------
// GET /api/clinical/dose-check — list available drugs in the database
// ---------------------------------------------------------------------------

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest) => {
    const url = new URL(req.url);
    const search = url.searchParams.get('search');

    if (search) {
      const drug = findDrug(search);
      if (!drug) {
        return NextResponse.json({
          found: false,
          message: `Drug "${search}" not found in dose-range database`,
          messageAr: `الدواء "${search}" غير موجود في قاعدة بيانات الجرعات`,
        });
      }
      return NextResponse.json({
        found: true,
        drug: {
          name: drug.drugName,
          nameAr: drug.drugNameAr,
          route: drug.route,
          adult: drug.adult,
          pediatric: drug.pediatric || null,
          geriatric: drug.geriatric || null,
          highAlert: !!drug.highAlertMedication,
          narrowTherapeuticIndex: !!drug.narrowTherapeuticIndex,
          pregnancyContraindicated: !!drug.pregnancyContraindicated,
          hasRenalAdjustment: !!drug.renalAdjustment?.length,
          hasHepaticAdjustment: !!drug.hepaticAdjustment?.length,
          maxDuration: drug.maxDuration || null,
        },
      });
    }

    const drugs = listDrugDatabase();
    return NextResponse.json({
      totalDrugs: drugs.length,
      drugs,
    });
  }),
  {
    tenantScoped: true,
    platformKey: 'thea_health',
    permissionKey: 'orders.create',
  }
);
