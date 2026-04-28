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
  referenceId: z.string(),
  referenceType: z.enum(['FINDING', 'COMPLIANCE', 'RISK', 'AUDIT', 'CORRECTIVE_ACTION']),
  title: z.string().min(1),
  description: z.string().optional(),
  fileName: z.string().optional(),
  fileType: z.string().optional(),
  fileSize: z.number().optional(),
  fileUrl: z.string().optional(),
  storageKey: z.string().optional(),
});

export const GET = withAuthTenant(
  withErrorHandler(async (req, { tenantId }) => {
    try {
      const { searchParams } = new URL(req.url);
      const referenceId = searchParams.get('referenceId');
      const referenceType = searchParams.get('referenceType');
      const page = parseInt(searchParams.get('page') || '1');
      const limit = parseInt(searchParams.get('limit') || '20');

      const where: Record<string, unknown> = { tenantId, status: 'ACTIVE' };
      if (referenceId) where.referenceId = referenceId;
      if (referenceType) where.referenceType = referenceType;

      const [evidence, total] = await Promise.all([
        prisma.samEvidence.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.samEvidence.count({ where }),
      ]);

      return NextResponse.json({
        evidence,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    } catch (error: unknown) {
      logger.error('Evidence list error:', { error });
      return NextResponse.json({ error: 'Failed to list evidence' }, { status: 500 });
    }
  }),
  { platformKey: 'sam', tenantScoped: true, permissionKey: 'sam.evidence.view' }
);

export const POST = withAuthTenant(
  withErrorHandler(async (req, { tenantId, userId }) => {
    try {
      const body = await req.json();
      const v = validateBody(body, createEvidenceSchema);
      if ('error' in v) return v.error;

      const evidence = await prisma.samEvidence.create({
        data: {
          tenantId,
          ...v.data,
          uploadedBy: userId,
        },
      });

      return NextResponse.json({ evidence }, { status: 201 });
    } catch (error: unknown) {
      logger.error('Evidence create error:', { error });
      return NextResponse.json({ error: 'Failed to create evidence' }, { status: 500 });
    }
  }),
  { platformKey: 'sam', tenantScoped: true, permissionKey: 'sam.evidence.manage' }
);

export const DELETE = withAuthTenant(
  withErrorHandler(async (req, { tenantId }) => {
    try {
      const { searchParams } = new URL(req.url);
      const id = searchParams.get('id');
      if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

      // Check if evidence is linked to finalized compliance requirements
      const evidence = await prisma.samEvidence.findFirst({
        where: { tenantId, id, status: 'ACTIVE' },
      });

      if (!evidence) {
        return NextResponse.json({ error: 'Evidence not found' }, { status: 404 });
      }

      if (evidence.referenceType === 'COMPLIANCE' && evidence.referenceId) {
        const linkedCompliance = await prisma.complianceRequirement.findFirst({
          where: {
            tenantId,
            id: evidence.referenceId,
            status: { in: ['MET', 'IN_REVIEW'] },
          },
        });

        if (linkedCompliance) {
          return NextResponse.json(
            { error: 'Cannot delete evidence linked to a compliance requirement with status MET or IN_REVIEW' },
            { status: 400 }
          );
        }
      }

      const result = await prisma.samEvidence.updateMany({
        where: { tenantId, id },
        data: { status: 'ARCHIVED', updatedAt: new Date() },
      });

      if (result.count === 0) {
        return NextResponse.json({ error: 'Evidence not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true });
    } catch (error: unknown) {
      logger.error('Evidence delete error:', { error });
      return NextResponse.json({ error: 'Failed to delete evidence' }, { status: 500 });
    }
  }),
  { platformKey: 'sam', tenantScoped: true, permissionKey: 'sam.evidence.manage' }
);
