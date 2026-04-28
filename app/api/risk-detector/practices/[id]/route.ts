import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const updatePracticeSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  frequency: z.enum(['Rare', 'Occasional', 'Frequent', 'Daily']).optional(),
  ownerRole: z.string().optional(),
  status: z.enum(['active', 'archived']).optional(),
});

// PUT - Update practice
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  return withAuthTenant(async (req, { user, tenantId, userId }) => {
    try {
      const resolvedParams = params instanceof Promise ? await params : params;
      const practiceId = resolvedParams.id;
      const body = await req.json();
      const validated = updatePracticeSchema.parse(body);

      // Check if practice exists and belongs to tenant
      const existing = await prisma.practice.findFirst({
        where: { tenantId, id: practiceId },
      });

      if (!existing) {
        return NextResponse.json(
          { error: 'Practice not found' },
          { status: 404 }
        );
      }

      // Build update object
      const update: any = {};
      if (validated.title !== undefined) update.title = validated.title;
      if (validated.description !== undefined) update.description = validated.description;
      if (validated.frequency !== undefined) update.frequency = validated.frequency;
      if (validated.ownerRole !== undefined) update.ownerRole = validated.ownerRole;
      if (validated.status !== undefined) update.status = validated.status;

      await prisma.practice.updateMany({
        where: { tenantId, id: practiceId },
        data: update,
      });

      const updated = await prisma.practice.findFirst({
        where: { tenantId, id: practiceId },
      });

    return NextResponse.json({
      success: true,
      practice: updated,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        // [SEC-10]
        { error: 'Validation error' },
        { status: 400 }
      );
    }

    logger.error('Update practice error:', { error: error });
    // [SEC-10]
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
    }
  }, { tenantScoped: true, permissionKey: 'risk-detector.practices.update' })(request);
}

// DELETE - Archive practice (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  return withAuthTenant(async (req, { user, tenantId, userId }) => {
    try {
      const resolvedParams = params instanceof Promise ? await params : params;
      const practiceId = resolvedParams.id;

      // Check if practice exists and belongs to tenant
      const existing = await prisma.practice.findFirst({
        where: { tenantId, id: practiceId },
      });

      if (!existing) {
        return NextResponse.json(
          { error: 'Practice not found' },
          { status: 404 }
        );
      }

      // Soft delete by setting status to archived
      await prisma.practice.updateMany({
        where: { tenantId, id: practiceId },
        data: {
          status: 'archived',
        },
      });

    return NextResponse.json({
      success: true,
      message: 'Practice archived successfully',
    });
  } catch (error) {
    logger.error('Delete practice error:', { error: error });
    // [SEC-10]
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
    }
  }, { tenantScoped: true, permissionKey: 'risk-detector.practices.delete' })(request);
}
