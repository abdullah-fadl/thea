import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const createPracticeSchema = z.object({
  departmentId: z.string().min(1),
  setting: z.enum(['IPD', 'OPD', 'Corporate', 'Shared']),
  title: z.string().min(1),
  description: z.string().min(1),
  frequency: z.enum(['Rare', 'Occasional', 'Frequent', 'Daily']),
  ownerRole: z.string().optional(),
});

// GET - List practices
export const GET = withAuthTenant(async (req, { user, tenantId }) => {
  try {
    const { searchParams } = new URL(req.url);
    const departmentId = searchParams.get('departmentId');
    const setting = searchParams.get('setting') as 'IPD' | 'OPD' | 'Corporate' | 'Shared' | null;
    const status = searchParams.get('status') as 'active' | 'archived' | null;

    const where: any = { tenantId };
    if (departmentId) {
      where.departmentId = departmentId;
    }
    if (setting) {
      where.setting = setting;
    }
    if (status) {
      where.status = status;
    } else {
      // Default to active if not specified
      where.status = 'active';
    }

    const practices = await prisma.practice.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return NextResponse.json({
      success: true,
      practices: practices,
    });
  } catch (error) {
    logger.error('List practices error:', { error: error });
    // [SEC-10]
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}, { tenantScoped: true, permissionKey: 'risk-detector.practices.read' });

// POST - Create practice
export const POST = withAuthTenant(async (req, { user, tenantId, userId }) => {
  try {
    const body = await req.json();
    const validated = createPracticeSchema.parse(body);

    const practice = await prisma.practice.create({
      data: {
        tenantId,
        departmentId: validated.departmentId,
        setting: validated.setting,
        title: validated.title,
        description: validated.description,
        frequency: validated.frequency,
        ownerRole: validated.ownerRole,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any,
    });

    return NextResponse.json({
      success: true,
      practice,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        // [SEC-10]
        { error: 'Validation error' },
        { status: 400 }
      );
    }

    logger.error('Create practice error:', { error: error });
    // [SEC-10]
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}, { tenantScoped: true, permissionKey: 'risk-detector.practices.create' });
