import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ─── Validation Schemas ─────────────────────────────────────

const DIET_TYPES = [
  'REGULAR', 'SOFT', 'LIQUID', 'CLEAR_LIQUID', 'NPO',
  'DIABETIC', 'RENAL', 'CARDIAC', 'LOW_SODIUM', 'HIGH_PROTEIN',
  'GLUTEN_FREE', 'TUBE_FEEDING', 'PARENTERAL',
] as const;

const TEXTURES = ['REGULAR', 'MINCED', 'PUREED', 'THICKENED_LIQUID'] as const;

const STATUSES = ['active', 'completed', 'cancelled', 'on_hold'] as const;

const createDietaryOrderSchema = z.object({
  patientId: z.string().min(1, 'patientId is required'),
  encounterId: z.string().optional().nullable(),
  episodeId: z.string().optional().nullable(),
  dietType: z.enum(DIET_TYPES),
  specialInstructions: z.string().optional().nullable(),
  allergies: z.string().optional().nullable(),
  texture: z.enum(TEXTURES).optional().nullable(),
  fluidRestriction: z.number().int().min(0).optional().nullable(),
  calorieTarget: z.number().int().min(0).optional().nullable(),
  proteinTarget: z.number().int().min(0).optional().nullable(),
  startDate: z.string().optional(),
  endDate: z.string().optional().nullable(),
  orderedByName: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const updateDietaryOrderSchema = z.object({
  id: z.string().min(1, 'id is required'),
  dietType: z.enum(DIET_TYPES).optional(),
  specialInstructions: z.string().optional().nullable(),
  allergies: z.string().optional().nullable(),
  texture: z.enum(TEXTURES).optional().nullable(),
  fluidRestriction: z.number().int().min(0).optional().nullable(),
  calorieTarget: z.number().int().min(0).optional().nullable(),
  proteinTarget: z.number().int().min(0).optional().nullable(),
  status: z.enum(STATUSES).optional(),
  endDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

// ─── GET /api/nutrition/dietary-orders ───────────────────────

export const GET = withAuthTenant(
  async (req: NextRequest, { tenantId }: { tenantId: string }) => {
    try {
      const url = req.nextUrl;
      const patientId = url.searchParams.get('patientId');
      const episodeId = url.searchParams.get('episodeId');
      const status = url.searchParams.get('status');

      const where: any = { tenantId };
      if (patientId) where.patientId = patientId;
      if (episodeId) where.episodeId = episodeId;
      if (status) where.status = status;

      const orders = await (prisma as Record<string, any>).dietaryOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 200,
      });

      // KPIs
      const allActive = orders.filter((o: any) => o.status === 'active');
      const npoCount = allActive.filter((o: any) => o.dietType === 'NPO').length;
      const restrictedCount = allActive.filter(
        (o: any) => o.fluidRestriction != null || o.calorieTarget != null
      ).length;

      return NextResponse.json({
        orders,
        kpis: {
          total: orders.length,
          active: allActive.length,
          npo: npoCount,
          restricted: restrictedCount,
        },
      });
    } catch (e) {
      logger.error('[DIETARY-ORDERS GET] Failed', {
        category: 'api',
        error: e instanceof Error ? e : undefined,
      });
      return NextResponse.json({ error: 'Failed to fetch dietary orders' }, { status: 500 });
    }
  },
  { permissionKey: 'nutrition.view' }
);

// ─── POST /api/nutrition/dietary-orders ──────────────────────

export const POST = withAuthTenant(
  async (req: NextRequest, { tenantId, userId }: { tenantId: string; userId: string }) => {
    try {
      const body = await req.json();
      const parsed = createDietaryOrderSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
          { status: 400 }
        );
      }

      const d = parsed.data;

      const order = await (prisma as Record<string, any>).dietaryOrder.create({
        data: {
          tenantId,
          patientId: d.patientId,
          encounterId: d.encounterId ?? null,
          episodeId: d.episodeId ?? null,
          dietType: d.dietType,
          specialInstructions: d.specialInstructions ?? null,
          allergies: d.allergies ?? null,
          texture: d.texture ?? null,
          fluidRestriction: d.fluidRestriction ?? null,
          calorieTarget: d.calorieTarget ?? null,
          proteinTarget: d.proteinTarget ?? null,
          status: 'active',
          startDate: d.startDate ? new Date(d.startDate) : new Date(),
          endDate: d.endDate ? new Date(d.endDate) : null,
          orderedBy: userId,
          orderedByName: d.orderedByName ?? null,
          notes: d.notes ?? null,
        },
      });

      return NextResponse.json({ order }, { status: 201 });
    } catch (e) {
      logger.error('[DIETARY-ORDERS POST] Failed', {
        category: 'api',
        error: e instanceof Error ? e : undefined,
      });
      return NextResponse.json({ error: 'Failed to create dietary order' }, { status: 500 });
    }
  },
  { permissionKey: 'nutrition.manage' }
);

// ─── PATCH /api/nutrition/dietary-orders ─────────────────────

export const PATCH = withAuthTenant(
  async (req: NextRequest, { tenantId }: { tenantId: string }) => {
    try {
      const body = await req.json();
      const parsed = updateDietaryOrderSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
          { status: 400 }
        );
      }

      const { id, ...updates } = parsed.data;

      // Build update data - only include fields that were explicitly provided
      const data: any = {};
      if (updates.dietType !== undefined) data.dietType = updates.dietType;
      if (updates.specialInstructions !== undefined) data.specialInstructions = updates.specialInstructions;
      if (updates.allergies !== undefined) data.allergies = updates.allergies;
      if (updates.texture !== undefined) data.texture = updates.texture;
      if (updates.fluidRestriction !== undefined) data.fluidRestriction = updates.fluidRestriction;
      if (updates.calorieTarget !== undefined) data.calorieTarget = updates.calorieTarget;
      if (updates.proteinTarget !== undefined) data.proteinTarget = updates.proteinTarget;
      if (updates.status !== undefined) data.status = updates.status;
      if (updates.endDate !== undefined) data.endDate = updates.endDate ? new Date(updates.endDate) : null;
      if (updates.notes !== undefined) data.notes = updates.notes;

      // If cancelling or completing, set endDate if not already set
      if ((updates.status === 'completed' || updates.status === 'cancelled') && !updates.endDate) {
        data.endDate = new Date();
      }

      const order = await (prisma as Record<string, any>).dietaryOrder.update({
        where: { id, tenantId },
        data,
      });

      return NextResponse.json({ order });
    } catch (e) {
      logger.error('[DIETARY-ORDERS PATCH] Failed', {
        category: 'api',
        error: e instanceof Error ? e : undefined,
      });
      return NextResponse.json({ error: 'Failed to update dietary order' }, { status: 500 });
    }
  },
  { permissionKey: 'nutrition.manage' }
);
