import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { withErrorHandler } from '@/lib/core/errors';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/sam/reminders/overdue — Get overdue items that need reminders
 */
export const GET = withAuthTenant(
  withErrorHandler(async (req, { tenantId }) => {
    try {
      const now = new Date();

      // Find overdue policy reviews
      const overdueReviews = await prisma.policyDocument.findMany({
        where: {
          tenantId,
          isActive: true,
          deletedAt: null,
          OR: [
            { expiryDate: { lt: now } },
            { nextReviewDate: { lt: now } },
          ],
        },
        select: { id: true, title: true, expiryDate: true, nextReviewDate: true, theaEngineId: true },
        take: 50,
      });

      // Find overdue integrity findings
      const overdueFindings = await prisma.integrityFinding.findMany({
        where: {
          tenantId,
          status: { in: ['OPEN', 'IN_REVIEW'] },
        },
        select: { id: true, title: true, severity: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
        take: 50,
      });

      // Find overdue corrective actions
      const overdueActions = await prisma.correctiveAction.findMany({
        where: {
          tenantId,
          status: { in: ['PLANNED', 'IN_PROGRESS'] },
          dueDate: { lt: now },
        },
        select: { id: true, title: true, dueDate: true, status: true, priority: true },
        take: 50,
      });

      // Find overdue risk reviews
      const overdueRisks = await prisma.riskAssessment.findMany({
        where: {
          tenantId,
          status: { not: 'CLOSED' },
          reviewDate: { lt: now },
        },
        select: { id: true, title: true, reviewDate: true, riskLevel: true },
        take: 50,
      });

      return NextResponse.json({
        overdueReviews,
        overdueFindings,
        overdueActions,
        overdueRisks,
        summary: {
          totalOverdue: overdueReviews.length + overdueFindings.length + overdueActions.length + overdueRisks.length,
          overdueReviewCount: overdueReviews.length,
          overdueFindingCount: overdueFindings.length,
          overdueActionCount: overdueActions.length,
          overdueRiskCount: overdueRisks.length,
        },
      });
    } catch (error: unknown) {
      logger.error('Overdue reminders error:', { error });
      return NextResponse.json({ error: 'Failed to load overdue items' }, { status: 500 });
    }
  }),
  { platformKey: 'sam', tenantScoped: true }
);

/**
 * POST /api/sam/reminders/overdue — Generate reminders for all overdue items
 */
export const POST = withAuthTenant(
  withErrorHandler(async (req, { tenantId }) => {
    try {
      const now = new Date();
      let created = 0;

      // Generate reminders for overdue policy reviews
      const overdueReviews = await prisma.policyDocument.findMany({
        where: {
          tenantId,
          isActive: true,
          deletedAt: null,
          OR: [
            { expiryDate: { lt: now } },
            { nextReviewDate: { lt: now } },
          ],
        },
        select: { id: true, title: true, theaEngineId: true },
        take: 200,
      });

      for (const doc of overdueReviews) {
        // Check if reminder already exists
        const existing = await prisma.samReminder.findFirst({
          where: {
            tenantId,
            type: 'POLICY_REVIEW',
            referenceId: doc.id,
            status: 'PENDING',
          },
        });
        if (!existing) {
          await prisma.samReminder.create({
            data: {
              tenantId,
              type: 'POLICY_REVIEW',
              referenceId: doc.id,
              referenceType: 'PolicyDocument',
              title: `Policy review overdue: ${doc.title || 'Untitled'}`,
              message: `The policy "${doc.title}" is overdue for review.`,
              dueDate: now,
            },
          });
          created++;
        }
      }

      // Generate reminders for overdue corrective actions
      const overdueActions = await prisma.correctiveAction.findMany({
        where: {
          tenantId,
          status: { in: ['PLANNED', 'IN_PROGRESS'] },
          dueDate: { lt: now },
        },
        select: { id: true, title: true, assignedTo: true },
        take: 200,
      });

      for (const action of overdueActions) {
        const existing = await prisma.samReminder.findFirst({
          where: {
            tenantId,
            type: 'COMPLIANCE_DEADLINE',
            referenceId: action.id,
            status: 'PENDING',
          },
        });
        if (!existing) {
          await prisma.samReminder.create({
            data: {
              tenantId,
              type: 'COMPLIANCE_DEADLINE',
              referenceId: action.id,
              referenceType: 'CorrectiveAction',
              title: `Corrective action overdue: ${action.title}`,
              message: `The corrective action "${action.title}" has passed its due date.`,
              recipientId: action.assignedTo,
              dueDate: now,
            },
          });
          created++;
        }
      }

      return NextResponse.json({ created, message: `${created} reminders generated` });
    } catch (error: unknown) {
      logger.error('Generate overdue reminders error:', { error });
      return NextResponse.json({ error: 'Failed to generate reminders' }, { status: 500 });
    }
  }),
  { platformKey: 'sam', tenantScoped: true }
);
