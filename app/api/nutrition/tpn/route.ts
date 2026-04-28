import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler, BadRequestError, NotFoundError } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import {
  calculateTpnCalories,
  calculateTpnProtein,
  calculateGIR,
  calculateOsmolarity,
  calculateBMI,
  isPeripheralSafe,
  type DextroseInput,
  type AminoAcidInput,
  type LipidInput,
} from '@/lib/nutrition/tpnDefinitions';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// =============================================================================
// Helper: compute all derived TPN values
// =============================================================================

function computeDerivedValues(body: any) {
  const dextrose: DextroseInput = body.dextrose || { concentration: '10', volume: 0 };
  const aminoAcids: AminoAcidInput = body.aminoAcids || { concentration: '10', volume: 0 };
  const lipids: LipidInput | null = body.lipids?.volume ? body.lipids : null;
  const weight: number = body.weight || 0;
  const height: number = body.height || 0;
  const infusionHours: number = body.infusionHours || 24;
  const electrolytes: Array<{ name: string; amount: number }> = body.electrolytes || [];

  const totalVolume = (dextrose.volume || 0) + (aminoAcids.volume || 0) + (lipids?.volume || 0);

  const calories = calculateTpnCalories(dextrose, aminoAcids, lipids);
  const totalProtein = calculateTpnProtein(aminoAcids);
  const gir = calculateGIR(dextrose, weight, infusionHours);
  const osmolarity = calculateOsmolarity(dextrose, aminoAcids, electrolytes, totalVolume);
  const bmi = height > 0 ? calculateBMI(weight, height) : null;
  const caloriesPerKg = weight > 0 ? Math.round((calories.totalKcal / weight) * 10) / 10 : null;
  const proteinPerKg = weight > 0 ? Math.round((totalProtein / weight) * 100) / 100 : null;
  const infusionRate = infusionHours > 0 ? Math.round((totalVolume / infusionHours) * 10) / 10 : 0;

  return {
    totalVolume,
    infusionRate,
    totalCalories: calories.totalKcal,
    totalProtein,
    caloriesPerKg,
    proteinPerKg,
    glucoseInfusionRate: gir,
    osmolarity,
    bmi,
  };
}

// =============================================================================
// GET /api/nutrition/tpn
// List TPN orders with optional filters
// =============================================================================

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const url = new URL(req.url);
    const patientMasterId = url.searchParams.get('patientMasterId');
    const status = url.searchParams.get('status');

    const where: any = { tenantId };
    if (patientMasterId) where.patientMasterId = patientMasterId;
    if (status) where.status = status;

    const orders = await (prisma as Record<string, any>).tpnOrder.findMany({
      where,
      orderBy: { orderDate: 'desc' },
      take: 100,
    });

    // Compute summary stats
    const activeOrders = orders.filter((o: any) => o.status === 'ACTIVE').length;
    const verifiedOrders = orders.filter((o: any) => o.pharmacistVerified).length;
    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);
    const monthlyOrders = orders.filter((o: any) => new Date(o.orderDate) >= thisMonth).length;

    const activeList = orders.filter((o: any) => o.status === 'ACTIVE');
    const avgCalPerKg = activeList.length > 0
      ? Math.round(activeList.reduce((sum: number, o: any) => sum + (o.caloriesPerKg || 0), 0) / activeList.length * 10) / 10
      : 0;

    return NextResponse.json({
      orders,
      stats: {
        activeOrders,
        verifiedOrders,
        monthlyOrders,
        avgCalPerKg,
      },
    });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'nutrition.view' },
);

// =============================================================================
// POST /api/nutrition/tpn
// Create a new TPN order with auto-calculated derived values
// =============================================================================

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }) => {
    const body = await req.json();

    // Validate required fields
    if (!body.patientMasterId) throw new BadRequestError('patientMasterId is required');
    if (!body.weight || body.weight <= 0) throw new BadRequestError('weight is required and must be positive');
    if (!body.dextrose?.concentration || !body.dextrose?.volume) {
      throw new BadRequestError('dextrose concentration and volume are required');
    }
    if (!body.aminoAcids?.concentration || !body.aminoAcids?.volume) {
      throw new BadRequestError('aminoAcids concentration and volume are required');
    }

    // Compute derived values
    const derived = computeDerivedValues(body);

    const order = await (prisma as Record<string, any>).tpnOrder.create({
      data: {
        tenantId,
        patientMasterId: body.patientMasterId,
        episodeId: body.episodeId || null,
        orderedBy: userId,
        orderDate: body.orderDate ? new Date(body.orderDate) : new Date(),
        weight: body.weight,
        height: body.height || null,
        bmi: derived.bmi,
        totalVolume: derived.totalVolume,
        infusionRate: derived.infusionRate,
        infusionHours: body.infusionHours || 24,
        dextrose: body.dextrose,
        aminoAcids: body.aminoAcids,
        lipids: body.lipids || null,
        electrolytes: body.electrolytes || [],
        vitamins: body.vitamins || null,
        traceElements: body.traceElements || null,
        additives: body.additives || null,
        totalCalories: derived.totalCalories,
        totalProtein: derived.totalProtein,
        caloriesPerKg: derived.caloriesPerKg,
        proteinPerKg: derived.proteinPerKg,
        glucoseInfusionRate: derived.glucoseInfusionRate,
        osmolarity: derived.osmolarity,
        accessType: body.accessType || 'CENTRAL',
        labMonitoring: body.labMonitoring || null,
        compatibilityCheck: body.compatibilityCheck ?? false,
        pharmacistVerified: false,
        status: body.status || 'DRAFT',
        startDate: body.startDate ? new Date(body.startDate) : null,
        endDate: body.endDate ? new Date(body.endDate) : null,
        notes: body.notes || null,
      },
    });

    return NextResponse.json({ order }, { status: 201 });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'nutrition.manage' },
);

// =============================================================================
// PUT /api/nutrition/tpn
// Update a TPN order. Supports status changes and pharmacist verification.
// Recalculates derived values when components change.
// =============================================================================

export const PUT = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }) => {
    const body = await req.json();
    const { id, ...updateFields } = body;

    if (!id) throw new BadRequestError('id is required');

    // Verify order exists and belongs to tenant
    const existing = await (prisma as Record<string, any>).tpnOrder.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundError('TPN order not found');

    // Build update data
    const data: any = {};

    // If components changed, recalculate derived values
    const hasComponentChanges =
      updateFields.dextrose || updateFields.aminoAcids || updateFields.lipids ||
      updateFields.electrolytes || updateFields.weight || updateFields.height ||
      updateFields.infusionHours;

    if (hasComponentChanges) {
      const mergedBody = {
        dextrose: updateFields.dextrose || existing.dextrose,
        aminoAcids: updateFields.aminoAcids || existing.aminoAcids,
        lipids: updateFields.lipids !== undefined ? updateFields.lipids : existing.lipids,
        electrolytes: updateFields.electrolytes || existing.electrolytes,
        weight: updateFields.weight || existing.weight,
        height: updateFields.height !== undefined ? updateFields.height : existing.height,
        infusionHours: updateFields.infusionHours || existing.infusionHours,
      };

      const derived = computeDerivedValues(mergedBody);

      data.totalVolume = derived.totalVolume;
      data.infusionRate = derived.infusionRate;
      data.totalCalories = derived.totalCalories;
      data.totalProtein = derived.totalProtein;
      data.caloriesPerKg = derived.caloriesPerKg;
      data.proteinPerKg = derived.proteinPerKg;
      data.glucoseInfusionRate = derived.glucoseInfusionRate;
      data.osmolarity = derived.osmolarity;
      data.bmi = derived.bmi;
    }

    // Copy over simple fields
    const simpleFields = [
      'patientMasterId', 'episodeId', 'weight', 'height', 'infusionHours',
      'dextrose', 'aminoAcids', 'lipids', 'electrolytes', 'vitamins',
      'traceElements', 'additives', 'accessType', 'labMonitoring',
      'compatibilityCheck', 'notes',
    ];
    for (const field of simpleFields) {
      if (updateFields[field] !== undefined) {
        data[field] = updateFields[field];
      }
    }

    // Status change
    if (updateFields.status) {
      data.status = updateFields.status;
      if (updateFields.status === 'ACTIVE' && !existing.startDate) {
        data.startDate = new Date();
      }
      if (updateFields.status === 'COMPLETED' || updateFields.status === 'CANCELLED') {
        data.endDate = new Date();
      }
    }

    // Pharmacist verification
    if (updateFields.pharmacistVerified === true && !existing.pharmacistVerified) {
      data.pharmacistVerified = true;
      data.pharmacistId = userId;
      data.verifiedAt = new Date();
    }

    // Date fields
    if (updateFields.startDate) data.startDate = new Date(updateFields.startDate);
    if (updateFields.endDate) data.endDate = new Date(updateFields.endDate);
    if (updateFields.orderDate) data.orderDate = new Date(updateFields.orderDate);

    const updated = await (prisma as Record<string, any>).tpnOrder.update({
      where: { id },
      data,
    });

    return NextResponse.json({ order: updated });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'nutrition.manage' },
);
