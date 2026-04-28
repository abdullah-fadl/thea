import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { withErrorHandler } from '@/lib/core/errors';
import { validateBody } from '@/lib/validation/helpers';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const createStandardSchema = z.object({
  code: z.string().min(1),
  title: z.string().min(1),
  titleAr: z.string().optional(),
  description: z.string().optional(),
  descriptionAr: z.string().optional(),
  framework: z.enum(['CBAHI', 'JCI', 'CUSTOM']).default('CBAHI'),
  chapter: z.string().optional(),
  section: z.string().optional(),
  version: z.string().optional(),
});

export const GET = withAuthTenant(
  withErrorHandler(async (req, { tenantId }) => {
    try {
      const { searchParams } = new URL(req.url);
      const framework = searchParams.get('framework');
      const chapter = searchParams.get('chapter');
      const search = searchParams.get('search');
      const page = parseInt(searchParams.get('page') || '1');
      const limit = parseInt(searchParams.get('limit') || '50');

      const where: Record<string, unknown> = { tenantId, isActive: true };
      if (framework) where.framework = framework;
      if (chapter) where.chapter = chapter;
      if (search) {
        where.OR = [
          { title: { contains: search, mode: 'insensitive' } },
          { code: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [standards, total] = await Promise.all([
        prisma.samStandard.findMany({
          where,
          orderBy: { code: 'asc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.samStandard.count({ where }),
      ]);

      return NextResponse.json({
        standards,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    } catch (error: unknown) {
      logger.error('Standards list error:', { error });
      return NextResponse.json({ error: 'Failed to list standards' }, { status: 500 });
    }
  }),
  { platformKey: 'sam', tenantScoped: true, permissionKey: 'sam.standards.read' }
);

export const POST = withAuthTenant(
  withErrorHandler(async (req, { tenantId, userId }) => {
    try {
      const body = await req.json();
      const v = validateBody(body, createStandardSchema);
      if ('error' in v) return v.error;

      // Check for duplicate code within framework
      const existing = await prisma.samStandard.findFirst({
        where: { tenantId, framework: v.data.framework, code: v.data.code },
      });
      if (existing) {
        return NextResponse.json({ error: 'Standard with this code already exists in this framework' }, { status: 409 });
      }

      const standard = await prisma.samStandard.create({
        data: {
          tenantId,
          ...v.data,
          createdBy: userId,
        },
      });

      return NextResponse.json({ standard }, { status: 201 });
    } catch (error: unknown) {
      logger.error('Standard create error:', { error });
      return NextResponse.json({ error: 'Failed to create standard' }, { status: 500 });
    }
  }),
  { platformKey: 'sam', tenantScoped: true, permissionKey: 'sam.standards.write' }
);
