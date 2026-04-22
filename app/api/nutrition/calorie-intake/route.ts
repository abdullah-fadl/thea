import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import prisma from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';

// ─── Types for items JSON field ─────────────────────────────────────────────────

interface IntakeItem {
  name: string;
  quantity: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

// ─── GET /api/nutrition/calorie-intake ───────────────────────────────────────
// List records with optional filters.
// Query: patientMasterId, startDate, endDate, mealType, summary
export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    try {
      const url = new URL(req.url);
      const patientMasterId = url.searchParams.get('patientMasterId');
      const startDate = url.searchParams.get('startDate');
      const endDate = url.searchParams.get('endDate');
      const mealType = url.searchParams.get('mealType');
      const summary = url.searchParams.get('summary');

      const where: any = { tenantId };

      if (patientMasterId) {
        where.patientMasterId = patientMasterId;
      }
      if (mealType) {
        where.mealType = mealType;
      }

      // Date range
      if (startDate || endDate) {
        const dateFilter: any = {};
        if (startDate) dateFilter.gte = new Date(startDate);
        if (endDate) {
          const end = new Date(endDate);
          end.setDate(end.getDate() + 1);
          dateFilter.lt = end;
        }
        where.recordDate = dateFilter;
      }

      const records = await (prisma as Record<string, any>).calorieIntakeRecord.findMany({
        where,
        orderBy: [{ recordDate: 'desc' }, { mealType: 'asc' }],
        take: 500,
      });

      // Summary mode: aggregate daily totals by date
      if (summary === 'true' && records.length > 0) {
        const dailyMap = new Map<string, {
          date: string;
          totalCalories: number;
          totalProtein: number;
          totalCarbs: number;
          totalFat: number;
          totalFluid: number;
          meals: Record<string, number>;
          recordCount: number;
        }>();

        for (const rec of records) {
          const dateStr = typeof rec.recordDate === 'string'
            ? rec.recordDate.slice(0, 10)
            : new Date(rec.recordDate).toISOString().slice(0, 10);

          if (!dailyMap.has(dateStr)) {
            dailyMap.set(dateStr, {
              date: dateStr,
              totalCalories: 0,
              totalProtein: 0,
              totalCarbs: 0,
              totalFat: 0,
              totalFluid: 0,
              meals: {},
              recordCount: 0,
            });
          }

          const day = dailyMap.get(dateStr)!;
          day.totalCalories += rec.totalCalories ?? 0;
          day.totalProtein += rec.totalProtein ?? 0;
          day.totalCarbs += rec.totalCarbs ?? 0;
          day.totalFat += rec.totalFat ?? 0;
          day.totalFluid += rec.fluidIntake ?? 0;
          day.recordCount += 1;

          // Track calories by meal type
          const mt = rec.mealType ?? 'OTHER';
          day.meals[mt] = (day.meals[mt] ?? 0) + (rec.totalCalories ?? 0);
        }

        const dailySummary = Array.from(dailyMap.values()).sort(
          (a, b) => b.date.localeCompare(a.date)
        );

        return NextResponse.json({ summary: dailySummary, records });
      }

      return NextResponse.json({ records });
    } catch (e) {
      logger.error('[CALORIE-INTAKE GET] Failed', {
        category: 'api',
        error: e instanceof Error ? e : undefined,
      });
      return NextResponse.json({ error: 'Failed to fetch calorie intake records' }, { status: 500 });
    }
  },
  { permissionKey: 'nutrition.view' }
);

// ─── POST /api/nutrition/calorie-intake ──────────────────────────────────────
// Create a new intake record. Auto-calculates totals from items array.
export const POST = withAuthTenant(
  async (req, { tenantId, userId }) => {
    try {
      const body = await req.json();
      const { patientMasterId, recordDate, mealType, items, intakePercent, fluidIntake, notes } = body;

      if (!patientMasterId || !mealType) {
        return NextResponse.json({ error: 'patientMasterId and mealType are required' }, { status: 400 });
      }

      const parsedItems: IntakeItem[] = Array.isArray(items) ? items : [];
      if (parsedItems.length === 0) {
        return NextResponse.json({ error: 'At least one item is required' }, { status: 400 });
      }

      // Auto-calculate totals
      const totalCalories = parsedItems.reduce((sum, i) => sum + (Number(i.calories) || 0) * (Number(i.quantity) || 1), 0);
      const totalProtein = parsedItems.reduce((sum, i) => sum + (Number(i.protein) || 0) * (Number(i.quantity) || 1), 0);
      const totalCarbs = parsedItems.reduce((sum, i) => sum + (Number(i.carbs) || 0) * (Number(i.quantity) || 1), 0);
      const totalFat = parsedItems.reduce((sum, i) => sum + (Number(i.fat) || 0) * (Number(i.quantity) || 1), 0);

      const record = await (prisma as Record<string, any>).calorieIntakeRecord.create({
        data: {
          tenantId,
          patientMasterId,
          recordDate: recordDate ? new Date(recordDate) : new Date(),
          mealType,
          items: parsedItems,
          totalCalories: Math.round(totalCalories),
          totalProtein: Math.round(totalProtein * 10) / 10,
          totalCarbs: Math.round(totalCarbs * 10) / 10,
          totalFat: Math.round(totalFat * 10) / 10,
          intakePercent: intakePercent != null ? Number(intakePercent) : null,
          fluidIntake: fluidIntake != null ? Number(fluidIntake) : null,
          recordedBy: userId,
          notes: notes ?? null,
        },
      });

      return NextResponse.json({ record }, { status: 201 });
    } catch (e) {
      logger.error('[CALORIE-INTAKE POST] Failed', {
        category: 'api',
        error: e instanceof Error ? e : undefined,
      });
      return NextResponse.json({ error: 'Failed to create calorie intake record' }, { status: 500 });
    }
  },
  { permissionKey: 'nutrition.manage' }
);

// ─── PUT /api/nutrition/calorie-intake ───────────────────────────────────────
// Update an existing record (by id). Recalculates totals if items provided.
export const PUT = withAuthTenant(
  async (req, { tenantId }) => {
    try {
      const body = await req.json();
      const { id } = body;

      if (!id) {
        return NextResponse.json({ error: 'id is required' }, { status: 400 });
      }

      const data: any = {};

      if (body.mealType !== undefined) data.mealType = body.mealType;
      if (body.intakePercent !== undefined) data.intakePercent = body.intakePercent != null ? Number(body.intakePercent) : null;
      if (body.fluidIntake !== undefined) data.fluidIntake = body.fluidIntake != null ? Number(body.fluidIntake) : null;
      if (body.notes !== undefined) data.notes = body.notes;
      if (body.recordDate !== undefined) data.recordDate = new Date(body.recordDate);

      // Recalculate totals if items are updated
      if (body.items !== undefined) {
        const parsedItems: IntakeItem[] = Array.isArray(body.items) ? body.items : [];
        data.items = parsedItems;
        data.totalCalories = Math.round(parsedItems.reduce((sum, i) => sum + (Number(i.calories) || 0) * (Number(i.quantity) || 1), 0));
        data.totalProtein = Math.round(parsedItems.reduce((sum, i) => sum + (Number(i.protein) || 0) * (Number(i.quantity) || 1), 0) * 10) / 10;
        data.totalCarbs = Math.round(parsedItems.reduce((sum, i) => sum + (Number(i.carbs) || 0) * (Number(i.quantity) || 1), 0) * 10) / 10;
        data.totalFat = Math.round(parsedItems.reduce((sum, i) => sum + (Number(i.fat) || 0) * (Number(i.quantity) || 1), 0) * 10) / 10;
      }

      const updated = await (prisma as Record<string, any>).calorieIntakeRecord.updateMany({
        where: { id, tenantId },
        data,
      });

      if (updated.count === 0) {
        return NextResponse.json({ error: 'Record not found' }, { status: 404 });
      }

      const record = await (prisma as Record<string, any>).calorieIntakeRecord.findFirst({
        where: { id, tenantId },
      });

      return NextResponse.json({ record });
    } catch (e) {
      logger.error('[CALORIE-INTAKE PUT] Failed', {
        category: 'api',
        error: e instanceof Error ? e : undefined,
      });
      return NextResponse.json({ error: 'Failed to update calorie intake record' }, { status: 500 });
    }
  },
  { permissionKey: 'nutrition.manage' }
);
