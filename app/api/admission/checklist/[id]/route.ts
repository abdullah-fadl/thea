import { logger } from '@/lib/monitoring/logger';
import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { updateChecklistItemSchema } from '@/lib/validation/admission.schema';
import type { ChecklistItem } from '@/lib/validation/admission.schema';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ─── PATCH /api/admission/checklist/[id] ─────────────────────────────────────
export const PATCH = withAuthTenant(
  async (req: NextRequest, { tenantId, userId }: { tenantId: string; userId: string }) => {
    try {
      const id = req.nextUrl.pathname.split('/').at(-1) || '';

      const body = await req.json();
      const parsed = updateChecklistItemSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
          { status: 400 }
        );
      }

      const { itemKey, completed, notes } = parsed.data;

      // 1. Fetch checklist
      const checklist = await prisma.admissionChecklist.findFirst({
        where: { tenantId, id },
      });
      if (!checklist) {
        return NextResponse.json({ error: 'Checklist not found' }, { status: 404 });
      }

      // 2. Update the specific item in the items array
      const items: ChecklistItem[] = Array.isArray(checklist.items) ? [...checklist.items] as any : [];
      const itemIndex = items.findIndex((item) => item.key === itemKey);
      if (itemIndex === -1) {
        return NextResponse.json(
          { error: `Checklist item '${itemKey}' not found` },
          { status: 404 }
        );
      }

      const now = new Date().toISOString();
      items[itemIndex] = {
        ...items[itemIndex],
        completed,
        completedBy: completed ? userId : undefined,
        completedAt: completed ? now : undefined,
        notes: notes !== undefined ? notes : items[itemIndex].notes,
      };

      // 3. Recalculate completion percentage and required status
      const totalItems = items.length;
      const completedCount = items.filter((item) => item.completed).length;
      const completionPercentage = totalItems > 0 ? Math.round((completedCount / totalItems) * 100) : 0;

      const requiredItems = items.filter((item) => item.required);
      const allRequiredComplete = requiredItems.length > 0
        ? requiredItems.every((item) => item.completed)
        : true;

      // 4. Save
      const updated = await prisma.admissionChecklist.update({
        where: { id },
        data: {
          items: items as any,
          completionPercentage,
          allRequiredComplete,
        },
      });

      return NextResponse.json({
        success: true,
        checklist: updated,
      });
    } catch (err) {
      logger.error('[admission/checklist/[id]] PATCH error:', err);
      return NextResponse.json({ error: 'Failed to update checklist' }, { status: 500 });
    }
  },
  { permissionKey: 'admission.manage' }
);
