import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { runFullComplianceAudit } from '@/lib/compliance/cbahi';
import { createAuditLog } from '@/lib/utils/audit';
import { validateBody } from '@/lib/validation/helpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const runAuditSchema = z.object({
  assessmentId: z.string().uuid().optional(),
  assessorName: z.string().optional(),
}).passthrough();

/**
 * POST /api/compliance/cbahi/audit/run
 * Run the automated CBAHI compliance audit against live tenant data
 * Optionally saves results to an existing assessment or creates a new one
 */
export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }) => {
    const db = prisma as unknown as Record<string, Record<string, (...args: any[]) => Promise<any>>>;

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const v = validateBody(body, runAuditSchema);
    if ('error' in v) return v.error;

    // Run the full compliance audit
    const auditResult = await runFullComplianceAudit(tenantId);

    // Build domain scores map
    const domainScoresMap: Record<string, number> = {};
    for (const ds of auditResult.domainScores) {
      domainScoresMap[ds.domain] = ds.score;
    }

    let assessmentId = v.data.assessmentId;

    if (assessmentId) {
      // Update existing assessment
      const existing = await db.cbahiAssessment.findFirst({
        where: { id: assessmentId, tenantId },
      });
      if (!existing) {
        return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
      }

      await db.cbahiAssessment.update({
        where: { id: assessmentId },
        data: {
          overallScore: auditResult.overallScore,
          domainScores: domainScoresMap,
          findings: auditResult.findings as unknown,
          status: 'in_progress',
          assessmentDate: new Date(),
        },
      });
    } else {
      // Create a new assessment with audit results
      const assessment = await db.cbahiAssessment.create({
        data: {
          tenantId,
          assessorId: userId || null,
          assessorName: v.data.assessorName || user?.displayName || `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.email || null,
          overallScore: auditResult.overallScore,
          domainScores: domainScoresMap,
          findings: auditResult.findings as unknown,
          status: 'in_progress',
          actionPlan: [],
        },
      });
      assessmentId = assessment.id;

      await createAuditLog(
        'cbahi_assessment',
        assessment.id,
        'RUN_AUDIT',
        userId || 'system',
        user?.email,
        { overallScore: auditResult.overallScore },
        tenantId
      );
    }

    return NextResponse.json({
      success: true,
      assessmentId,
      result: auditResult,
    });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'compliance.cbahi.audit' }
);
