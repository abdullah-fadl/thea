import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { assertEncounterNotCompleted } from '@/lib/opd/guards';
import { validateBody } from '@/lib/validation/helpers';
import { physicalExamSchema } from '@/lib/validation/opd.schema';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }, params) => {
  const encounterCoreId = String((params as Record<string, string>)?.encounterCoreId || '').trim();
  if (!encounterCoreId) {
    return NextResponse.json({ error: 'encounterCoreId is required' }, { status: 400 });
  }

  const exam = await prisma.physicalExam.findFirst({
    where: { tenantId, encounterCoreId },
  });

  return NextResponse.json({ exam: exam || null });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'clinical.view' }
);

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }, params) => {
  const encounterCoreId = String((params as Record<string, string>)?.encounterCoreId || '').trim();
  if (!encounterCoreId) {
    return NextResponse.json({ error: 'encounterCoreId is required' }, { status: 400 });
  }

  // [G-01] Guard: block writes on completed/closed encounters
  const completedGuard = await assertEncounterNotCompleted(tenantId, encounterCoreId);
  if (completedGuard) return completedGuard;

  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const v = validateBody(body, physicalExamSchema);
  if ('error' in v) return v.error;
  const { systems: rawSystems, summary } = v.data;
  const systems = rawSystems as Record<string, unknown>;

  // Upsert: create or update physical exam for this encounter
  const existing = await prisma.physicalExam.findFirst({
    where: { tenantId, encounterCoreId },
    select: { id: true, updatedAt: true },
  });

  // [D-11] Optimistic locking using updatedAt timestamp
  if (existing && body._lastUpdatedAt) {
    const clientUpdatedAt = new Date(body._lastUpdatedAt).getTime();
    const serverUpdatedAt = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
    if (clientUpdatedAt < serverUpdatedAt) {
      return NextResponse.json(
        { error: 'تم تعديل البيانات من مستخدم آخر. يرجى تحديث الصفحة.', code: 'VERSION_CONFLICT' },
        { status: 409 }
      );
    }
  }

  let exam;
  if (existing) {
    exam = await prisma.physicalExam.update({
      where: { id: existing.id },
      data: {
        systems: (systems || {}) as any,
        summary: summary || null,
        updatedByUserId: userId || null,
      },
    });
  } else {
    exam = await prisma.physicalExam.create({
      data: {
        tenantId,
        encounterCoreId,
        systems: (systems || {}) as any,
        summary: summary || null,
        createdByUserId: userId || null,
        updatedByUserId: userId || null,
      },
    });
  }

  return NextResponse.json({ success: true, exam });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'clinical.edit' }
);
