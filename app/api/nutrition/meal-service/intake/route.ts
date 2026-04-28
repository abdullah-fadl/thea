import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ─── Validation Schema ──────────────────────────────────────

const recordIntakeSchema = z.object({
  mealServiceId: z.string().min(1, 'mealServiceId is required'),
  intakePercent: z.number().int().min(0).max(100),
  notes: z.string().optional().nullable(),
  refusalReason: z.string().optional().nullable(),
});

// ─── POST /api/nutrition/meal-service/intake ─────────────────
// Record meal intake for a specific meal service

export const POST = withAuthTenant(
  async (req: NextRequest, { tenantId, userId }: { tenantId: string; userId: string }) => {
    try {
      const body = await req.json();
      const parsed = recordIntakeSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
          { status: 400 }
        );
      }

      const d = parsed.data;

      // Verify meal service exists
      const existing = await (prisma as Record<string, any>).mealService.findFirst({
        where: { id: d.mealServiceId, tenantId },
      });
      if (!existing) {
        return NextResponse.json(
          { error: 'Meal service not found' },
          { status: 404 }
        );
      }

      // Determine the resulting status
      let newStatus: string;
      if (d.intakePercent === 0) {
        newStatus = 'refused';
      } else if (d.intakePercent > 0) {
        newStatus = 'consumed';
      } else {
        newStatus = existing.status;
      }

      const meal = await (prisma as Record<string, any>).mealService.update({
        where: { id: d.mealServiceId, tenantId },
        data: {
          intakePercent: d.intakePercent,
          notes: d.notes ?? existing.notes,
          refusalReason: d.refusalReason ?? null,
          status: newStatus,
          deliveredAt: existing.deliveredAt ?? new Date(),
          deliveredBy: existing.deliveredBy ?? userId,
        },
      });

      return NextResponse.json({ meal });
    } catch (e) {
      logger.error('[MEAL-INTAKE POST] Failed', {
        category: 'api',
        error: e instanceof Error ? e : undefined,
      });
      return NextResponse.json({ error: 'Failed to record meal intake' }, { status: 500 });
    }
  },
  { permissionKey: 'nutrition.manage' }
);
