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
 * GET /api/sam/standards/cbahi — List CBAHI-specific standards
 */
export const GET = withAuthTenant(
  withErrorHandler(async (req, { tenantId }) => {
    try {
      const { searchParams } = new URL(req.url);
      const chapter = searchParams.get('chapter');

      const where: Record<string, unknown> = { tenantId, framework: 'CBAHI', isActive: true };
      if (chapter) where.chapter = chapter;

      const standards = await prisma.samStandard.findMany({
        where,
        orderBy: { code: 'asc' },
        take: 500,
      });

      // Get assessments for these standards
      const standardIds = standards.map((s) => s.id);
      const assessments = await prisma.standardAssessment.findMany({
        where: { tenantId, standardId: { in: standardIds } },
      });

      const assessmentMap = new Map(assessments.map((a) => [a.standardId, a]));

      const enriched = standards.map((s) => ({
        ...s,
        assessment: assessmentMap.get(s.id) || null,
      }));

      // Chapters summary
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
      logger.error('CBAHI standards error:', { error });
      return NextResponse.json({ error: 'Failed to list CBAHI standards' }, { status: 500 });
    }
  }),
  { platformKey: 'sam', tenantScoped: true, permissionKey: 'sam.standards.read' }
);

/**
 * POST /api/sam/standards/cbahi — Bulk import CBAHI standards
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
          where: { tenantId, framework: 'CBAHI', code: s.code },
        });
        if (existing) {
          skipped++;
          continue;
        }
        await prisma.samStandard.create({
          data: { tenantId, ...s, framework: 'CBAHI', createdBy: userId },
        });
        created++;
      }

      return NextResponse.json({ created, skipped }, { status: 201 });
    } catch (error: unknown) {
      logger.error('CBAHI bulk import error:', { error });
      return NextResponse.json({ error: 'Failed to import CBAHI standards' }, { status: 500 });
    }
  }),
  { platformKey: 'sam', tenantScoped: true, permissionKey: 'sam.standards.write' }
);
