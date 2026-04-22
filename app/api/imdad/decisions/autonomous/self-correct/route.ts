import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Signal type -> Decision type mapping (mirrors scan route)
// ---------------------------------------------------------------------------
const SIGNAL_DECISION_MAP: Record<string, string> = {
  LIFECYCLE_BREACH: 'DEVICE_REPLACEMENT',
  FAILURE_SPIKE: 'DEVICE_REPLACEMENT',
  STOCKOUT_RISK: 'SUPPLY_REORDER',
  EXPIRY_WARNING: 'SUPPLY_REORDER',
  BUDGET_OVERRUN: 'COST_OPTIMIZATION',
  COMPLIANCE_GAP: 'COMPLIANCE_ACTION',
  DEMAND_SURGE: 'CAPACITY_EXPANSION',
  VENDOR_RISK: 'VENDOR_SWITCH',
  TEMPERATURE_BREACH: 'RISK_MITIGATION',
  COMPATIBILITY_GAP: 'RISK_MITIGATION',
  UTILIZATION_DROP: 'COST_OPTIMIZATION',
  MAINTENANCE_COST_SPIKE: 'BUDGET_ALLOCATION',
  SAFETY_ALERT: 'EMERGENCY_PROCUREMENT',
  RECALL_TRIGGER: 'EMERGENCY_PROCUREMENT',
};

// Escalation ladder
const ESCALATION_NEXT: Record<string, string> = {
  NONE: 'DEPARTMENT',
  DEPARTMENT: 'HOSPITAL',
  HOSPITAL: 'CORPORATE',
  CORPORATE: 'CORPORATE', // already at max
};

// Severity -> confidence (for orphan decision generation)
const SEVERITY_CONFIDENCE: Record<string, number> = {
  CRITICAL: 92,
  HIGH: 78,
  MEDIUM: 55,
  LOW: 30,
  INFO: 15,
};

const SEVERITY_ESCALATION: Record<string, string> = {
  CRITICAL: 'CORPORATE',
  HIGH: 'HOSPITAL',
  MEDIUM: 'DEPARTMENT',
  LOW: 'NONE',
  INFO: 'NONE',
};

const AUTO_APPROVAL_THRESHOLD = 85;

function makeCode(prefix: string, year: number, seq: number): string {
  return `${prefix}-${year}-${String(seq).padStart(6, '0')}`;
}

// ---------------------------------------------------------------------------
// POST /api/imdad/decisions/autonomous/self-correct
// Self-Correction Engine: detects inconsistencies and fixes them autonomously
// ---------------------------------------------------------------------------
export const POST = withAuthTenant(
  async (req: NextRequest, { tenantId, userId }) => {
    const organizationId = req.nextUrl.searchParams.get('organizationId')?.trim() || undefined;
    const now = new Date();
    const year = now.getFullYear();

    const orgFilter = organizationId ? { organizationId } : {};

    const corrections = {
      staleDecisionsReset: 0,
      orphanedSignalsFixed: 0,
      deadlinesEscalated: 0,
      duplicatesCleaned: 0,
      failedActionsRetried: 0,
      pulseGapFilled: false,
    };

    // -----------------------------------------------------------------------
    // 1. STALE DECISIONS — stuck in EXECUTING for >1 hour -> reset to AUTO_APPROVED
    // -----------------------------------------------------------------------
    try {
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      const staleDecisions = await prisma.imdadDecision.findMany({
        where: {
          tenantId,
          ...orgFilter,
          status: 'EXECUTING',
          updatedAt: { lt: oneHourAgo },
          isDeleted: false,
        },
        take: 100,
      });

      for (const decision of staleDecisions) {
        await prisma.imdadDecision.update({
          where: { id: decision.id },
          data: {
            status: 'AUTO_APPROVED',
            aiReasoning: `${decision.aiReasoning || ''}\n[SELF-CORRECT] Reset from EXECUTING (stale >1h) at ${now.toISOString()} for retry.`,
            updatedAt: now,
            updatedBy: userId,
          },
        });
      }

      corrections.staleDecisionsReset = staleDecisions.length;
    } catch (_e) {
      // Continue with other corrections
    }

    // -----------------------------------------------------------------------
    // 2. ORPHANED SIGNALS — signals with no linked decision, >6 hours old
    // -----------------------------------------------------------------------
    try {
      const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);

      const allOldSignals = await prisma.imdadOperationalSignal.findMany({
        where: {
          tenantId,
          ...orgFilter,
          createdAt: { lt: sixHoursAgo },
          resolvedAt: null,
          isDeleted: false,
        },
        take: 200,
      });

      // Find which signals are referenced by any decision
      const signalIds = allOldSignals.map((s: any) => s.id);

      if (signalIds.length > 0) {
        // Get all decisions that reference any of these signals
        const decisionsWithSignals = await prisma.imdadDecision.findMany({
          where: {
            tenantId,
            isDeleted: false,
          },
          select: { sourceSignals: true },
          take: 1000,
        });

        const linkedSignalIds = new Set<string>();
        for (const d of decisionsWithSignals) {
          const sources = d.sourceSignals as string[] | null;
          if (Array.isArray(sources)) {
            for (const sid of sources) {
              linkedSignalIds.add(sid);
            }
          }
        }

        const orphanedSignals = allOldSignals.filter(
          (s: any) => !linkedSignalIds.has(s.id),
        );

        // Generate decisions for orphaned signals
        const decisionBaseCount = await prisma.imdadDecision.count({ where: { tenantId } });
        let decisionSeq = decisionBaseCount;

        for (const signal of orphanedSignals) {
          decisionSeq++;
          const decisionCode = makeCode('DEC', year, decisionSeq);
          const signalType = signal.signalType as string;
          const severity = (signal.severity as string) || 'MEDIUM';
          const decisionType = SIGNAL_DECISION_MAP[signalType] || 'RISK_MITIGATION';
          const confidenceScore = SEVERITY_CONFIDENCE[severity] ?? 55;
          const autoApproved = confidenceScore >= AUTO_APPROVAL_THRESHOLD;

          await prisma.imdadDecision.create({
            data: {
              tenantId,
              decisionCode,
              organizationId: (signal as any).organizationId || organizationId || 'SYSTEM',
              decisionType: decisionType as any,
              title: `Self-Correct: ${(signal as any).title || signalType}`,
              titleAr: `تصحيح تلقائي: ${(signal as any).titleAr || signalType}`,
              description: `Auto-generated by self-correction engine for orphaned signal ${(signal as any).signalCode || signal.id}`,
              descriptionAr: `تم إنشاؤه تلقائيا بواسطة محرك التصحيح الذاتي للإشارة المعزولة ${(signal as any).signalCode || signal.id}`,
              confidenceScore,
              riskScore: severity === 'CRITICAL' ? 95 : severity === 'HIGH' ? 75 : 50,
              impactScore: severity === 'CRITICAL' ? 90 : severity === 'HIGH' ? 65 : 40,
              escalationLevel: SEVERITY_ESCALATION[severity] || 'NONE' as any,
              sourceSignals: [signal.id],
              recommendedActions: [],
              alternativeOptions: [],
              aiReasoning: `[SELF-CORRECT] Orphaned signal detected (${signalType}, ${severity}). Auto-generated decision at ${now.toISOString()}.`,
              aiReasoningAr: `[تصحيح تلقائي] تم اكتشاف إشارة معزولة (${signalType}, ${severity}). تم إنشاء القرار تلقائيا في ${now.toISOString()}.`,
              departmentId: (signal as any).departmentId || null,
              relatedAssetIds: [],
              relatedItemIds: [],
              autoApprovalThreshold: AUTO_APPROVAL_THRESHOLD,
              autoApproved,
              status: autoApproved ? 'AUTO_APPROVED' : 'GENERATED',
              createdBy: userId,
              createdAt: now,
              updatedAt: now,
            },
          });
        }

        corrections.orphanedSignalsFixed = orphanedSignals.length;
      }
    } catch (_e) {
      // Continue with other corrections
    }

    // -----------------------------------------------------------------------
    // 3. EXPIRED DEADLINES — decisions past executionDeadline that aren't COMPLETED
    // -----------------------------------------------------------------------
    try {
      const expiredDecisions = await prisma.imdadDecision.findMany({
        where: {
          tenantId,
          ...orgFilter,
          executionDeadline: { lt: now },
          status: { notIn: ['COMPLETED', 'REJECTED', 'CANCELLED'] as any },
          isDeleted: false,
        },
        take: 100,
      });

      for (const decision of expiredDecisions) {
        const currentLevel = (decision.escalationLevel as string) || 'NONE';
        const nextLevel = ESCALATION_NEXT[currentLevel] || 'CORPORATE';

        await prisma.imdadDecision.update({
          where: { id: decision.id },
          data: {
            status: 'PENDING_REVIEW',
            escalationLevel: nextLevel as any,
            aiReasoning: `${decision.aiReasoning || ''}\n[SELF-CORRECT] Deadline expired. Escalated ${currentLevel} -> ${nextLevel} at ${now.toISOString()}.`,
            updatedAt: now,
            updatedBy: userId,
          },
        });
      }

      corrections.deadlinesEscalated = expiredDecisions.length;
    } catch (_e) {
      // Continue with other corrections
    }

    // -----------------------------------------------------------------------
    // 4. DUPLICATE CLEANUP — multiple signals for same sourceEntity+sourceEntityId+signalType within 1 hour
    // -----------------------------------------------------------------------
    try {
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      const recentSignals = await prisma.imdadOperationalSignal.findMany({
        where: {
          tenantId,
          ...orgFilter,
          createdAt: { gte: oneHourAgo },
          resolvedAt: null,
          isDeleted: false,
        },
        orderBy: { createdAt: 'desc' },
        take: 500,
      });

      // Group by sourceEntity + sourceEntityId + signalType
      const groups = new Map<string, any[]>();
      for (const signal of recentSignals) {
        const key = `${signal.sourceEntity}::${signal.sourceEntityId}::${signal.signalType}`;
        const existing = groups.get(key);
        if (existing) {
          existing.push(signal);
        } else {
          groups.set(key, [signal]);
        }
      }

      let duplicateCount = 0;
      for (const [, signals] of groups) {
        if (signals.length <= 1) continue;

        // Keep the newest (first due to desc sort), resolve the rest
        const toResolve = signals.slice(1);
        for (const dup of toResolve) {
          await prisma.imdadOperationalSignal.update({
            where: { id: dup.id },
            data: {
              resolvedAt: now,
              resolvedBy: userId,
              resolutionNote: '[SELF-CORRECT] Duplicate signal resolved automatically.',
              updatedAt: now,
            } as any,
          });
          duplicateCount++;
        }
      }

      corrections.duplicatesCleaned = duplicateCount;
    } catch (_e) {
      // Continue with other corrections
    }

    // -----------------------------------------------------------------------
    // 5. FAILED ACTIONS — DecisionActions with status FAILED -> retry with new PENDING records
    // -----------------------------------------------------------------------
    try {
      const failedActions = await prisma.imdadDecisionAction.findMany({
        where: {
          tenantId,
          ...orgFilter,
          status: 'FAILED',
          isDeleted: false,
        },
        take: 100,
      });

      const actionBaseCount = await prisma.imdadDecisionAction.count({ where: { tenantId } });
      let actionSeq = actionBaseCount;

      for (const action of failedActions) {
        actionSeq++;
        const actionCode = makeCode('ACT', year, actionSeq);

        // Create a new retry action
        await prisma.imdadDecisionAction.create({
          data: {
            tenantId,
            organizationId: action.organizationId,
            decisionId: action.decisionId,
            actionCode,
            actionType: action.actionType,
            sequenceOrder: (action.sequenceOrder as number) + 100, // offset to avoid collision
            title: `[Retry] ${action.title}`,
            titleAr: `[إعادة] ${action.titleAr}`,
            status: 'PENDING',
            notes: `[SELF-CORRECT] Retry of failed action ${action.actionCode || action.id} at ${now.toISOString()}.`,
            createdAt: now,
            updatedAt: now,
          } as any,
        });

        // Mark the old action as superseded via notes update
        await prisma.imdadDecisionAction.update({
          where: { id: action.id },
          data: {
            notes: `${(action as any).notes || ''}\n[SELF-CORRECT] Superseded by retry action ${actionCode} at ${now.toISOString()}.`,
            updatedAt: now,
          } as any,
        });
      }

      corrections.failedActionsRetried = failedActions.length;
    } catch (_e) {
      // Continue with other corrections
    }

    // -----------------------------------------------------------------------
    // 6. HEALTH PULSE GAP — if no ImdadSystemPulse in last 30 minutes, create one
    // -----------------------------------------------------------------------
    try {
      const targetOrgId = organizationId || 'SYSTEM';
      const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);

      const recentPulse = await prisma.imdadSystemPulse.findFirst({
        where: {
          tenantId,
          organizationId: targetOrgId,
          pulseTimestamp: { gte: thirtyMinutesAgo },
        },
        orderBy: { pulseTimestamp: 'desc' },
      });

      if (!recentPulse) {
        // Gather basic metrics for the pulse
        const [activeDecisionCount, pendingActionCount, criticalSignalCount, highSignalCount] =
          await Promise.all([
            prisma.imdadDecision.count({
              where: {
                tenantId,
                ...(organizationId ? { organizationId } : {}),
                status: { in: ['GENERATED', 'PENDING_REVIEW', 'AUTO_APPROVED', 'APPROVED', 'EXECUTING'] },
                isDeleted: false,
              },
            }),
            prisma.imdadDecisionAction.count({
              where: {
                tenantId,
                ...(organizationId ? { organizationId } : {}),
                status: { in: ['PENDING', 'IN_PROGRESS'] },
                isDeleted: false,
              },
            }),
            prisma.imdadOperationalSignal.count({
              where: {
                tenantId,
                ...(organizationId ? { organizationId } : {}),
                severity: 'CRITICAL',
                resolvedAt: null,
                isDeleted: false,
              },
            }),
            prisma.imdadOperationalSignal.count({
              where: {
                tenantId,
                ...(organizationId ? { organizationId } : {}),
                severity: 'HIGH',
                resolvedAt: null,
                isDeleted: false,
              },
            }),
          ]);

        const pressureRaw = Math.min(
          100,
          criticalSignalCount * 15 + highSignalCount * 8 + activeDecisionCount * 3,
        );
        const healthRaw = Math.max(0, 100 - pressureRaw);

        await prisma.imdadSystemPulse.create({
          data: {
            tenantId,
            organizationId: targetOrgId,
            pulseTimestamp: now,
            activeDecisions: activeDecisionCount,
            pendingActions: pendingActionCount,
            criticalSignals: criticalSignalCount,
            highSignals: highSignalCount,
            overallHealthScore: healthRaw,
            operationalPressure: pressureRaw,
            trendDirection: criticalSignalCount > 0 ? 'DECLINING' : highSignalCount > 3 ? 'STABLE' : 'IMPROVING',
            aiInsights: {
              source: 'SELF_CORRECTION_ENGINE',
              corrections,
              generatedAt: now.toISOString(),
            },
          } as any,
        });

        corrections.pulseGapFilled = true;
      }
    } catch (_e) {
      // Continue — pulse is best-effort
    }

    // -----------------------------------------------------------------------
    // Response
    // -----------------------------------------------------------------------
    const totalCorrections =
      corrections.staleDecisionsReset +
      corrections.orphanedSignalsFixed +
      corrections.deadlinesEscalated +
      corrections.duplicatesCleaned +
      corrections.failedActionsRetried +
      (corrections.pulseGapFilled ? 1 : 0);

    return NextResponse.json({
      corrections,
      totalCorrections,
      timestamp: now.toISOString(),
    });
  },
  {
    tenantScoped: true,
    platformKey: 'imdad' as any,
    permissionKey: 'imdad.decisions.manage',
  },
);
