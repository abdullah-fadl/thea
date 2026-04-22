import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { withErrorHandler } from '@/lib/core/errors';
import { validateBody } from '@/lib/validation/helpers';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const bulkImportSchema = z.object({
  standards: z.array(z.object({
    code: z.string(),
    title: z.string(),
    titleAr: z.string().optional(),
    description: z.string().optional(),
    descriptionAr: z.string().optional(),
    chapter: z.string().optional(),
    section: z.string().optional(),
    version: z.string().optional(),
  })),
});

/**
 * GET /api/sam/standards/jci — List JCI-specific standards
 */
export const GET = withAuthTenant(
  withErrorHandler(async (req, { tenantId }) => {
    try {
      const { searchParams } = new URL(req.url);
      const chapter = searchParams.get('chapter');

      const where: Record<string, unknown> = { tenantId, framework: 'JCI', isActive: true };
      if (chapter) where.chapter = chapter;

      const standards = await prisma.samStandard.findMany({
        where,
        orderBy: { code: 'asc' },
        take: 500,
      });

      const standardIds = standards.map((s) => s.id);
      const assessments = await prisma.standardAssessment.findMany({
        where: { tenantId, standardId: { in: standardIds } },
      });

      const assessmentMap = new Map(assessments.map((a) => [a.standardId, a]));

      const enriched = standards.map((s) => ({
        ...s,
        assessment: assessmentMap.get(s.id) || null,
      }));

      const chapters = [...new Set(standards.map((s) => s.chapter).filter(Boolean))];
      const chapterSummary = chapters.map((ch) => {
        const chStandards = standards.filter((s) => s.chapter === ch);
        const assessed = chStandards.filter((s) => assessmentMap.has(s.id));
        const compliant = assessed.filter((s) => assessmentMap.get(s.id)?.status === 'COMPLIANT');
        return {
          chapter: ch,
          total: chStandards.length,
          assessed: assessed.length,
          compliant: compliant.length,
          readinessPercent: chStandards.length > 0 ? Math.round((compliant.length / chStandards.length) * 100) : 0,
        };
      });

      return NextResponse.json({ standards: enriched, chapterSummary });
    } catch (error: unknown) {
      logger.error('JCI standards error:', { error });
      return NextResponse.json({ error: 'Failed to list JCI standards' }, { status: 500 });
    }
  }),
  { platformKey: 'sam', tenantScoped: true, permissionKey: 'sam.standards.read' }
);

/**
 * POST /api/sam/standards/jci — Bulk import JCI standards
 */
export const POST = withAuthTenant(
  withErrorHandler(async (req, { tenantId, userId }) => {
    try {
      const body = await req.json();
      const v = validateBody(body, bulkImportSchema);
      if ('error' in v) return v.error;

      let created = 0;
      let skipped = 0;

      for (const s of v.data.standards) {
        const existing = await prisma.samStandard.findFirst({
          where: { tenantId, framework: 'JCI', code: s.code },
        });
        if (existing) {
          skipped++;
          continue;
        }
        await prisma.samStandard.create({
          data: { tenantId, ...s, framework: 'JCI', createdBy: userId },
        });
        created++;
      }

      return NextResponse.json({ created, skipped }, { status: 201 });
    } catch (error: unknown) {
      logger.error('JCI bulk import error:', { error });
      return NextResponse.json({ error: 'Failed to import JCI standards' }, { status: 500 });
    }
  }),
  { platformKey: 'sam', tenantScoped: true, permissionKey: 'sam.standards.write' }
);
