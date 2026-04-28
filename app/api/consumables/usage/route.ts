import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { validateBody } from '@/lib/validation/helpers';
import { processConsumableUsage, getEncounterConsumables, getConsumableSummaryForEncounter } from '@/lib/consumables/usageRecording';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const encounterCoreId = req.nextUrl.searchParams.get('encounterCoreId') || '';
    if (!encounterCoreId) return NextResponse.json({ error: 'encounterCoreId is required' }, { status: 400 });

    const summary = req.nextUrl.searchParams.get('summary') === 'true';

    if (summary) {
      const result = await getConsumableSummaryForEncounter(tenantId, encounterCoreId);
      return NextResponse.json(result);
    }

    const events = await getEncounterConsumables(tenantId, encounterCoreId);
    return NextResponse.json({ events });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'billing.view' }
);

const usageItemSchema = z.object({
  supplyCatalogId: z.string().min(1),
  supplyCode: z.string().min(1),
  supplyName: z.string().min(1),
  quantity: z.number().int().min(1),
  wasteQty: z.number().int().min(0).optional(),
  usageContext: z.string().min(1),
  notes: z.string().optional(),
  storeId: z.string().optional(),
  costPrice: z.number().optional(),
  isChargeable: z.boolean().optional(),
});

const recordUsageSchema = z.object({
  encounterCoreId: z.string().min(1),
  patientMasterId: z.string().optional(),
  department: z.enum(['OPD', 'ER', 'IPD', 'OR', 'ICU']),
  items: z.array(usageItemSchema).min(1),
  templateId: z.string().optional(),
  idempotencyKey: z.string().optional(),
}).passthrough();

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }) => {
    const body = await req.json();
    const v = validateBody(body, recordUsageSchema);
    if ('error' in v) return v.error;

    const result = await processConsumableUsage({
      tenantId,
      encounterCoreId: body.encounterCoreId,
      patientMasterId: body.patientMasterId,
      department: body.department,
      items: body.items,
      templateId: body.templateId,
      userId,
      userName: (user as any)?.name || user?.email || undefined,
      idempotencyKey: body.idempotencyKey,
    });

    return NextResponse.json(result);
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'billing.view' }
);
