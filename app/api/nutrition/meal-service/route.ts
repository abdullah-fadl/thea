import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ─── Validation Schemas ─────────────────────────────────────

const MEAL_TYPES = [
  'BREAKFAST', 'LUNCH', 'DINNER', 'SNACK_AM', 'SNACK_PM', 'SNACK_HS',
] as const;

const MEAL_STATUSES = [
  'pending', 'prepared', 'delivered', 'consumed', 'refused', 'returned',
] as const;

const DEFAULT_MEAL_TIMES: Record<string, string> = {
  BREAKFAST: '07:00',
  SNACK_AM: '10:00',
  LUNCH: '12:00',
  SNACK_PM: '15:00',
  DINNER: '18:00',
  SNACK_HS: '21:00',
};

const createMealServiceSchema = z.object({
  dietaryOrderId: z.string().min(1, 'dietaryOrderId is required'),
  patientId: z.string().min(1, 'patientId is required'),
  scheduledDate: z.string().min(1, 'scheduledDate is required'),
  meals: z.array(z.enum(MEAL_TYPES)).min(1, 'At least one meal type is required'),
  menuItems: z.unknown().optional().nullable(),
});

const updateMealServiceSchema = z.object({
  id: z.string().min(1, 'id is required'),
  status: z.enum(MEAL_STATUSES).optional(),
  deliveredBy: z.string().optional().nullable(),
  intakePercent: z.number().int().min(0).max(100).optional().nullable(),
  refusalReason: z.string().optional().nullable(),
  menuItems: z.unknown().optional().nullable(),
  notes: z.string().optional().nullable(),
});

// ─── GET /api/nutrition/meal-service ─────────────────────────

export const GET = withAuthTenant(
  async (req: NextRequest, { tenantId }: { tenantId: string }) => {
    try {
      const url = req.nextUrl;
      const patientId = url.searchParams.get('patientId');
      const dietaryOrderId = url.searchParams.get('dietaryOrderId');
      const date = url.searchParams.get('date'); // YYYY-MM-DD
      const status = url.searchParams.get('status');
      const mealType = url.searchParams.get('mealType');

      const where: any = { tenantId };
      if (patientId) where.patientId = patientId;
      if (dietaryOrderId) where.dietaryOrderId = dietaryOrderId;
      if (status) where.status = status;
      if (mealType) where.mealType = mealType;

      // Date filter: match the scheduledDate day
      if (date) {
        const dayStart = new Date(date + 'T00:00:00.000Z');
        const dayEnd = new Date(date + 'T23:59:59.999Z');
        where.scheduledDate = { gte: dayStart, lte: dayEnd };
      }

      const meals = await prisma.mealService.findMany({
        where,
        orderBy: [{ scheduledDate: 'asc' }, { scheduledTime: 'asc' }],
        take: 500,
      });

      // Compute stats
      const total = meals.length;
      const pending = meals.filter((m) => m.status === 'pending').length;
      const prepared = meals.filter((m) => m.status === 'prepared').length;
      const delivered = meals.filter((m) => m.status === 'delivered' || m.status === 'consumed').length;
      const refused = meals.filter((m) => m.status === 'refused').length;
      const consumed = meals.filter((m) => m.status === 'consumed');
      const avgIntake = consumed.length > 0
        ? Math.round(consumed.reduce((sum: number, m) => sum + ((m.intakePercent as number | null) ?? 0), 0) / consumed.length)
        : 0;

      return NextResponse.json({
        meals,
        stats: { total, pending, prepared, delivered, refused, avgIntake },
      });
    } catch (e) {
      logger.error('[MEAL-SERVICE GET] Failed', {
        category: 'api',
        error: e instanceof Error ? e : undefined,
      });
      return NextResponse.json({ error: 'Failed to fetch meal services' }, { status: 500 });
    }
  },
  { permissionKey: 'nutrition.view' }
);

// ─── POST /api/nutrition/meal-service ────────────────────────
// Batch create meal service entries for a day's meals

export const POST = withAuthTenant(
  async (req: NextRequest, { tenantId }: { tenantId: string }) => {
    try {
      const body = await req.json();
      const parsed = createMealServiceSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
          { status: 400 }
        );
      }

      const d = parsed.data;
      const scheduledDate = new Date(d.scheduledDate);

      // Check if dietary order exists and is active
      const order = await prisma.dietaryOrder.findFirst({
        where: { id: d.dietaryOrderId, tenantId, status: 'active' },
      });
      if (!order) {
        return NextResponse.json(
          { error: 'Dietary order not found or not active' },
          { status: 404 }
        );
      }

      // NPO orders should not have meals created
      if (order.dietType === 'NPO') {
        return NextResponse.json(
          { error: 'Cannot create meals for NPO orders' },
          { status: 400 }
        );
      }

      // Check for duplicates on the same date/mealType
      const existing = await prisma.mealService.findMany({
        where: {
          tenantId,
          dietaryOrderId: d.dietaryOrderId,
          scheduledDate: {
            gte: new Date(d.scheduledDate + 'T00:00:00.000Z'),
            lte: new Date(d.scheduledDate + 'T23:59:59.999Z'),
          },
          mealType: { in: d.meals },
        },
      });

      const existingTypes = new Set(existing.map((m) => m.mealType));
      const newMeals = d.meals.filter((m: string) => !existingTypes.has(m));

      if (newMeals.length === 0) {
        return NextResponse.json(
          { error: 'All requested meals already exist for this date', existing },
          { status: 409 }
        );
      }

      // Batch create
      const created = [];
      for (const mealType of newMeals) {
        const meal = await prisma.mealService.create({
          data: {
            tenantId,
            dietaryOrderId: d.dietaryOrderId,
            patientId: d.patientId,
            mealType,
            scheduledDate,
            scheduledTime: DEFAULT_MEAL_TIMES[mealType] ?? null,
            status: 'pending',
            menuItems: d.menuItems ?? null,
          } as any,
        });
        created.push(meal);
      }

      return NextResponse.json({ meals: created, skipped: d.meals.length - newMeals.length }, { status: 201 });
    } catch (e) {
      logger.error('[MEAL-SERVICE POST] Failed', {
        category: 'api',
        error: e instanceof Error ? e : undefined,
      });
      return NextResponse.json({ error: 'Failed to create meal services' }, { status: 500 });
    }
  },
  { permissionKey: 'nutrition.manage' }
);

// ─── PATCH /api/nutrition/meal-service ───────────────────────
// Update meal service status (prepared, delivered, consumed, refused)

export const PATCH = withAuthTenant(
  async (req: NextRequest, { tenantId }: { tenantId: string }) => {
    try {
      const body = await req.json();
      const parsed = updateMealServiceSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
          { status: 400 }
        );
      }

      const { id, ...updates } = parsed.data;

      const data: any = {};
      if (updates.status !== undefined) data.status = updates.status;
      if (updates.deliveredBy !== undefined) data.deliveredBy = updates.deliveredBy;
      if (updates.intakePercent !== undefined) data.intakePercent = updates.intakePercent;
      if (updates.refusalReason !== undefined) data.refusalReason = updates.refusalReason;
      if (updates.menuItems !== undefined) data.menuItems = updates.menuItems;
      if (updates.notes !== undefined) data.notes = updates.notes;

      // Auto-set deliveredAt when status changes to delivered
      if (updates.status === 'delivered' || updates.status === 'consumed') {
        data.deliveredAt = new Date();
      }

      const meal = await prisma.mealService.update({
        where: { id, tenantId },
        data,
      });

      return NextResponse.json({ meal });
    } catch (e) {
      logger.error('[MEAL-SERVICE PATCH] Failed', {
        category: 'api',
        error: e instanceof Error ? e : undefined,
      });
      return NextResponse.json({ error: 'Failed to update meal service' }, { status: 500 });
    }
  },
  { permissionKey: 'nutrition.manage' }
);
