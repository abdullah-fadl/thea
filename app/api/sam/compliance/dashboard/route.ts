import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { withErrorHandler } from '@/lib/core/errors';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/sam/compliance/dashboard — Full compliance dashboard data
 */
export const GET = withAuthTenant(
  withErrorHandler(async (req, { tenantId }) => {
    try {
      const [
        requirements,
        violations,
        correctiveActions,
        standards,
        assessments,
      ] = await Promise.all([
        prisma.complianceRequirement.findMany({
          where: { tenantId },
          select: { id: true, status: true, priority: true, category: true, dueDate: true, standardId: true },
          take: 1000,
        }),
        prisma.complianceViolation.findMany({
          where: { tenantId },
          select: { id: true, status: true, severity: true, detectedAt: true, slaDeadline: true },
          take: 1000,
        }),
        prisma.correctiveAction.findMany({
          where: { tenantId },
          select: { id: true, status: true, priority: true, dueDate: true, actionType: true },
          take: 1000,
        }),
        prisma.samStandard.findMany({
          where: { tenantId, isActive: true },
          select: { id: true, framework: true, code: true, title: true },
          take: 500,
        }),
        prisma.standardAssessment.findMany({
          where: { tenantId },
          select: { id: true, standardId: true, status: true, score: true },
          take: 1000,
        }),
      ]);

      const now = new Date();

      // Compliance summary
      const applicable = requirements.filter((r) => r.status !== 'NOT_APPLICABLE');
      const complianceRate = applicable.length > 0
        ? Math.round((applicable.filter((r) => r.status === 'MET').length / applicable.length) * 100)
        : 0;

      // Violations summary
      const openViolations = violations.filter((v) => v.status === 'OPEN' || v.status === 'IN_PROGRESS');
      const overdueViolations = openViolations.filter((v) => v.slaDeadline && new Date(v.slaDeadline) < now);

      // Corrective actions summary
      const openActions = correctiveActions.filter((a) => a.status !== 'CLOSED' && a.status !== 'VERIFIED');
      const overdueActions = openActions.filter((a) => a.dueDate && new Date(a.dueDate) < now);

      // Standards readiness
      const standardReadiness = standards.map((s) => {
        const relatedAssessments = assessments.filter((a) => a.standardId === s.id);
        const compliant = relatedAssessments.filter((a) => a.status === 'COMPLIANT').length;
        const total = relatedAssessments.length;
        return {
          standardId: s.id,
          framework: s.framework,
          code: s.code,
          title: s.title,
          assessedCount: total,
          compliantCount: compliant,
          readinessPercent: total > 0 ? Math.round((compliant / total) * 100) : 0,
        };
      });

      // Requirements by status
      const requirementsByStatus = {
        MET: requirements.filter((r) => r.status === 'MET').length,
        PARTIALLY_MET: requirements.filter((r) => r.status === 'PARTIALLY_MET').length,
        NOT_MET: requirements.filter((r) => r.status === 'NOT_MET').length,
        NOT_APPLICABLE: requirements.filter((r) => r.status === 'NOT_APPLICABLE').length,
      };

      // Violations by severity
      const violationsBySeverity = {
        CRITICAL: violations.filter((v) => v.severity === 'CRITICAL' && (v.status === 'OPEN' || v.status === 'IN_PROGRESS')).length,
        HIGH: violations.filter((v) => v.severity === 'HIGH' && (v.status === 'OPEN' || v.status === 'IN_PROGRESS')).length,
        MEDIUM: violations.filter((v) => v.severity === 'MEDIUM' && (v.status === 'OPEN' || v.status === 'IN_PROGRESS')).length,
        LOW: violations.filter((v) => v.severity === 'LOW' && (v.status === 'OPEN' || v.status === 'IN_PROGRESS')).length,
      };

      return NextResponse.json({
        complianceRate,
        totalRequirements: requirements.length,
        requirementsByStatus,
        openViolations: openViolations.length,
        overdueViolations: overdueViolations.length,
        violationsBySeverity,
        openCorrectiveActions: openActions.length,
        overdueCorrectiveActions: overdueActions.length,
        standardReadiness,
        lastUpdated: now.toISOString(),
      });
    } catch (error: unknown) {
      logger.error('Compliance dashboard error:', { error });
      return NextResponse.json({ error: 'Failed to load compliance dashboard' }, { status: 500 });
    }
  }),
  { platformKey: 'sam', tenantScoped: true, permissionKey: 'sam.compliance.read' }
);
