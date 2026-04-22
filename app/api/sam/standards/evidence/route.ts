import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { withErrorHandler } from '@/lib/core/errors';
import { validateBody } from '@/lib/validation/helpers';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const createEvidenceSchema = z.object({
  standardId: z.string(),
  assessmentId: z.string().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  fileName: z.string().optional(),
  fileType: z.string().optional(),
  fileSize: z.number().optional(),
  fileUrl: z.string().optional(),
});

const reviewEvidenceSchema = z.object({
  id: z.string(),
  status: z.enum(['APPROVED', 'REJECTED']),
});

export const GET = withAuthTenant(
  withErrorHandler(async (req, { tenantId }) => {
    try {
      const { searchParams } = new URL(req.url);
      const standardId = searchParams.get('standardId');
      const assessmentId = searchParams.get('assessmentId');
      const status = searchParams.get('status');

      const where: Record<string, unknown> = { tenantId };
      if (standardId) where.standardId = standardId;
      if (assessmentId) where.assessmentId = assessmentId;
      if (status) where.status = status;

      const evidence = await prisma.standardEvidence.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 100,
      });

      return NextResponse.json({ evidence });
    } catch (error: unknown) {
      logger.error('Standard evidence list error:', { error });
      return NextResponse.json({ error: 'Failed to list evidence' }, { status: 500 });
    }
  }),
  { platformKey: 'sam', tenantScoped: true, permissionKey: 'sam.standards.read' }
);

export const POST = withAuthTenant(
  withErrorHandler(async (req, { tenantId, userId }) => {
    try {
      const body = await req.json();
      const v = validateBody(body, createEvidenceSchema);
      if ('error' in v) return v.error;

      const evidence = await prisma.standardEvidence.create({
        data: {
          tenantId,
          ...v.data,
          uploadedBy: userId,
        },
      });

      return NextResponse.json({ evidence }, { status: 201 });
    } catch (error: unknown) {
      logger.error('Standard evidence create error:', { error });
      return NextResponse.json({ error: 'Failed to create evidence' }, { status: 500 });
    }
  }),
  { platformKey: 'sam', tenantScoped: true, permissionKey: 'sam.standards.write' }
);

/**
 * PATCH — Review evidence (approve/reject)
 */
export const PATCH = withAuthTenant(
  withErrorHandler(async (req, { tenantId, userId }) => {
    try {
      const body = await req.json();
      const v = validateBody(body, reviewEvidenceSchema);
      if ('error' in v) return v.error;

      const result = await prisma.standardEvidence.updateMany({
        where: { tenantId, id: v.data.id },
        data: {
          status: v.data.status,
          reviewedBy: userId,
          reviewedAt: new Date(),
          updatedAt: new Date(),
        },
      });

      if (result.count === 0) {
        return NextResponse.json({ error: 'Evidence not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true });
    } catch (error: unknown) {
      logger.error('Standard evidence review error:', { error });
      return NextResponse.json({ error: 'Failed to review evidence' }, { status: 500 });
    }
  }),
  { platformKey: 'sam', tenantScoped: true, permissionKey: 'sam.standards.write' }
);
