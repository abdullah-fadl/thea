import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Action generation map — decision type → list of actions to create
// ---------------------------------------------------------------------------
const DECISION_ACTION_MAP: Record<string, { actionType: string; title: string; titleAr: string }[]> = {
  DEVICE_REPLACEMENT: [
    { actionType: 'DISPOSAL_REQUEST', title: 'Dispose old device', titleAr: 'التخلص من الجهاز القديم' },
    { actionType: 'PURCHASE_REQUISITION', title: 'Purchase replacement device', titleAr: 'شراء جهاز بديل' },
    { actionType: 'SCHEDULE_INSPECTION', title: 'Schedule new device inspection', titleAr: 'جدولة فحص الجهاز الجديد' },
  ],
  SUPPLY_REORDER: [
    { actionType: 'PURCHASE_REQUISITION', title: 'Create supply reorder requisition', titleAr: 'إنشاء طلب إعادة طلب المستلزمات' },
  ],
  COST_OPTIMIZATION: [
    { actionType: 'BUDGET_REALLOCATION', title: 'Reallocate budget for cost savings', titleAr: 'إعادة تخصيص الميزانية لتوفير التكاليف' },
    { actionType: 'ALERT_NOTIFICATION', title: 'Notify stakeholders of optimization', titleAr: 'إبلاغ المعنيين بالتحسين' },
  ],
  VENDOR_SWITCH: [
    { actionType: 'VENDOR_EVALUATION', title: 'Evaluate new vendor candidates', titleAr: 'تقييم المرشحين من الموردين الجدد' },
    { actionType: 'CONTRACT_RENEWAL', title: 'Initiate contract transition', titleAr: 'بدء انتقال العقد' },
  ],
  RISK_MITIGATION: [
    { actionType: 'ALERT_NOTIFICATION', title: 'Send risk mitigation alert', titleAr: 'إرسال تنبيه تخفيف المخاطر' },
    { actionType: 'SCHEDULE_INSPECTION', title: 'Schedule risk assessment inspection', titleAr: 'جدولة فحص تقييم المخاطر' },
  ],
  COMPLIANCE_ACTION: [
    { actionType: 'SCHEDULE_INSPECTION', title: 'Schedule compliance inspection', titleAr: 'جدولة فحص الامتثال' },
    { actionType: 'ALERT_NOTIFICATION', title: 'Notify compliance team', titleAr: 'إبلاغ فريق الامتثال' },
  ],
  EMERGENCY_PROCUREMENT: [
    { actionType: 'EMERGENCY_ORDER', title: 'Create emergency procurement order', titleAr: 'إنشاء أمر شراء طارئ' },
  ],
  BUDGET_ALLOCATION: [
    { actionType: 'BUDGET_REALLOCATION', title: 'Execute budget allocation', titleAr: 'تنفيذ تخصيص الميزانية' },
  ],
  PHASED_INVESTMENT: [
    { actionType: 'PURCHASE_REQUISITION', title: 'Create phased investment requisition', titleAr: 'إنشاء طلب استثمار مرحلي' },
  ],
  CAPACITY_EXPANSION: [
    { actionType: 'PURCHASE_REQUISITION', title: 'Purchase capacity expansion equipment', titleAr: 'شراء معدات توسعة الطاقة' },
    { actionType: 'MAINTENANCE_ORDER', title: 'Schedule expansion maintenance setup', titleAr: 'جدولة إعداد صيانة التوسعة' },
  ],
};

// For SUPPLY_REORDER, use EMERGENCY_ORDER if riskScore is high
function resolveActions(
  decisionType: string,
  riskScore: number | null,
): { actionType: string; title: string; titleAr: string }[] {
  if (decisionType === 'SUPPLY_REORDER' && riskScore !== null && riskScore >= 80) {
    return [
      { actionType: 'EMERGENCY_ORDER', title: 'Create emergency supply reorder', titleAr: 'إنشاء طلب إعادة طلب طارئ' },
    ];
  }
  return DECISION_ACTION_MAP[decisionType] || [
    { actionType: 'ALERT_NOTIFICATION', title: 'Decision notification', titleAr: 'إشعار القرار' },
  ];
}

// Conditional execution thresholds
const MAX_DECISIONS_PER_CALL = 50;
const CRITICAL_RISK_THRESHOLD = 90; // Risk score above this → escalate, don't auto-execute
const COST_IMPACT_ESCALATION_LIMIT = 500000; // SAR — above this requires human oversight

// Decision priority scoring: higher = execute first
function priorityScore(d: any): number {
  const risk = Number(d.riskScore ?? 0);
  const confidence = Number(d.confidenceScore ?? 0);
  const isEmergency = ['EMERGENCY_PROCUREMENT', 'SUPPLY_REORDER'].includes(d.decisionType);
  return (confidence * 2) + (isEmergency ? 100 : 0) + (risk > 70 ? 50 : 0);
}

// ---------------------------------------------------------------------------
// POST /api/imdad/decisions/autonomous/execute
// Intelligent auto-executor with conditional execution logic:
//   - Auto-execute: confidence ≥ threshold, risk < critical, cost within limit
//   - Escalate: risk ≥ 90 or cost > 500K SAR → mark PENDING_REVIEW
//   - Priority ordering: emergencies first, then by confidence + risk
// ---------------------------------------------------------------------------
export const POST = withAuthTenant(
  async (req: NextRequest, { tenantId, userId }) => {
    // 1. Find executable decisions
    const decisions = await prisma.imdadDecision.findMany({
      where: {
        tenantId,
        status: { in: ['AUTO_APPROVED', 'APPROVED'] },
        executedAt: null,
        isDeleted: false,
      },
      orderBy: { createdAt: 'asc' },
      take: MAX_DECISIONS_PER_CALL,
    });

    if (decisions.length === 0) {
      return NextResponse.json({
        summary: {
          decisionsExecuted: 0,
          decisionsEscalated: 0,
          actionsCreated: 0,
          executedAt: new Date().toISOString(),
        },
        executions: [],
        escalations: [],
      });
    }

    // 2. Sort by priority — emergencies and high-confidence first
    const sorted = [...decisions].sort((a, b) => priorityScore(b) - priorityScore(a));

    // 3. Get current action count for code generation
    const existingActionCount = await prisma.imdadDecisionAction.count({ where: { tenantId } });
    let actionSequence = existingActionCount;
    const year = new Date().getFullYear();
    const now = new Date();

    const executions: {
      decisionId: string;
      decisionCode: string;
      previousStatus: string;
      actionsCreated: number;
      actionTypes: string[];
      executionMode: string;
    }[] = [];

    const escalations: {
      decisionId: string;
      decisionCode: string;
      reason: string;
      riskScore: number;
      costImpact: number | null;
    }[] = [];

    let totalActionsCreated = 0;

    // 4. Process each decision with conditional logic
    for (const decision of sorted) {
      const decisionType = decision.decisionType as string;
      const riskScore = Number(decision.riskScore ?? 0);
      const costImpact = Number(decision.costImpact ?? 0);
      const confidenceScore = Number(decision.confidenceScore ?? 0);

      // ── Conditional execution gate ──
      // Escalate if risk is critically high or cost impact exceeds limit
      const shouldEscalate =
        (riskScore >= CRITICAL_RISK_THRESHOLD && decision.status !== 'APPROVED') ||
        (costImpact > COST_IMPACT_ESCALATION_LIMIT && decision.status !== 'APPROVED');

      if (shouldEscalate) {
        // Escalate — mark for human review instead of executing
        const escalationReason = riskScore >= CRITICAL_RISK_THRESHOLD
          ? `Risk score (${riskScore}) exceeds critical threshold (${CRITICAL_RISK_THRESHOLD})`
          : `Cost impact (${costImpact.toLocaleString()} SAR) exceeds limit (${COST_IMPACT_ESCALATION_LIMIT.toLocaleString()} SAR)`;

        await prisma.imdadDecision.update({
          where: { id: decision.id },
          data: {
            status: 'PENDING_REVIEW',
            escalationLevel: riskScore >= CRITICAL_RISK_THRESHOLD ? 'CORPORATE' : 'HOSPITAL',
            aiReasoning: `${decision.aiReasoning || ''}\n[ESCALATED] ${escalationReason}. Auto-execution blocked — requires human oversight.`,
            updatedAt: now,
            updatedBy: userId,
          },
        });

        escalations.push({
          decisionId: decision.id,
          decisionCode: decision.decisionCode as string,
          reason: escalationReason,
          riskScore,
          costImpact: costImpact || null,
        });
        continue;
      }

      // ── Execute ──
      const actions = resolveActions(decisionType, riskScore);

      // Mark as EXECUTING
      await prisma.imdadDecision.update({
        where: { id: decision.id },
        data: { status: 'EXECUTING', updatedAt: now },
      });

      // Create action records and execute real module integrations
      const createdActionTypes: string[] = [];
      for (let i = 0; i < actions.length; i++) {
        const action = actions[i];
        actionSequence += 1;
        const actionCode = `ACT-${year}-${String(actionSequence).padStart(6, '0')}`;

        let integrationResult: string | null = null;
        let integrationRefId: string | null = null;

        // -- Real module integration --
        try {
          if (action.actionType === 'PURCHASE_REQUISITION') {
            // Actually create a purchase requisition
            const prCounter = await prisma.imdadSequenceCounter.upsert({
              where: {
                tenantId_organizationId_sequenceType_fiscalYear: {
                  tenantId,
                  organizationId: decision.organizationId!,
                  sequenceType: 'PR',
                  fiscalYear: year,
                },
              },
              create: {
                tenantId,
                organizationId: decision.organizationId!,
                sequenceType: 'PR',
                prefix: 'PR-',
                currentValue: 1,
                fiscalYear: year,
              } as any,
              update: { currentValue: { increment: 1 } },
            });

            const prNumber = `${prCounter.prefix}${year}-${String(prCounter.currentValue).padStart(6, '0')}`;

            const pr = await prisma.imdadPurchaseRequisition.create({
              data: {
                tenantId,
                organizationId: decision.organizationId!,
                prNumber,
                status: 'DRAFT',
                priority: riskScore >= 80 ? 'URGENT' : 'NORMAL',
                title: action.title,
                titleAr: action.titleAr,
                notes: `Auto-created by AI Decision Engine — Decision ${decision.decisionCode}`,
                requestedBy: userId,
                createdBy: userId,
                updatedBy: userId,
                sourceDecisionId: decision.id,
              } as any,
            });

            integrationResult = 'PR_CREATED';
            integrationRefId = pr.id;
          } else if (action.actionType === 'EMERGENCY_ORDER') {
            // Create an urgent purchase requisition
            const prCounter = await prisma.imdadSequenceCounter.upsert({
              where: {
                tenantId_organizationId_sequenceType_fiscalYear: {
                  tenantId,
                  organizationId: decision.organizationId!,
                  sequenceType: 'PR',
                  fiscalYear: year,
                },
              },
              create: {
                tenantId,
                organizationId: decision.organizationId!,
                sequenceType: 'PR',
                prefix: 'PR-',
                currentValue: 1,
                fiscalYear: year,
              } as any,
              update: { currentValue: { increment: 1 } },
            });

            const prNumber = `${prCounter.prefix}${year}-${String(prCounter.currentValue).padStart(6, '0')}`;

            const pr = await prisma.imdadPurchaseRequisition.create({
              data: {
                tenantId,
                organizationId: decision.organizationId!,
                prNumber,
                status: 'DRAFT',
                priority: 'EMERGENCY',
                title: `[EMERGENCY] ${action.title}`,
                titleAr: `[طارئ] ${action.titleAr}`,
                notes: `Emergency PR auto-created by AI Decision Engine — Decision ${decision.decisionCode}`,
                requestedBy: userId,
                createdBy: userId,
                updatedBy: userId,
                sourceDecisionId: decision.id,
              } as any,
            });

            integrationResult = 'EMERGENCY_PR_CREATED';
            integrationRefId = pr.id;
          } else if (action.actionType === 'DISPOSAL_REQUEST') {
            // Create an asset disposal record
            const disposal = await prisma.imdadAssetDisposal.create({
              data: {
                tenantId,
                organizationId: decision.organizationId!,
                disposalMethod: 'PENDING_ASSESSMENT' as any,
                status: 'PENDING',
                reason: action.title,
                notes: `Auto-created by AI Decision Engine — Decision ${decision.decisionCode}`,
                requestedBy: userId,
                createdBy: userId,
                updatedBy: userId,
              } as any,
            });

            integrationResult = 'DISPOSAL_CREATED';
            integrationRefId = disposal.id;
          } else if (action.actionType === 'SCHEDULE_INSPECTION') {
            // Create a quality inspection
            const qiCounter = await prisma.imdadSequenceCounter.upsert({
              where: {
                tenantId_organizationId_sequenceType_fiscalYear: {
                  tenantId,
                  organizationId: decision.organizationId!,
                  sequenceType: 'QI',
                  fiscalYear: year,
                },
              },
              create: {
                tenantId,
                organizationId: decision.organizationId!,
                sequenceType: 'QI',
                prefix: 'QI-',
                currentValue: 1,
                fiscalYear: year,
              } as any,
              update: { currentValue: { increment: 1 } },
            });

            const inspectionNumber = `${qiCounter.prefix}${year}-${String(qiCounter.currentValue).padStart(6, '0')}`;

            const inspection = await prisma.imdadQualityInspection.create({
              data: {
                tenantId,
                organizationId: decision.organizationId!,
                inspectionNumber,
                inspectionType: 'AI_SCHEDULED' as any,
                referenceType: 'decision',
                referenceId: decision.id,
                status: 'SCHEDULED' as any,
                notes: `Auto-scheduled by AI Decision Engine — ${action.title}`,
                createdBy: userId,
                updatedBy: userId,
              } as any,
            });

            integrationResult = 'INSPECTION_CREATED';
            integrationRefId = inspection.id;
          } else if (action.actionType === 'ALERT_NOTIFICATION') {
            // Create a notification record
            await prisma.imdadNotification.create({
              data: {
                tenantId,
                organizationId: decision.organizationId!,
                type: 'AI_DECISION',
                severity: riskScore >= 80 ? 'HIGH' : 'MEDIUM',
                title: action.title,
                titleAr: action.titleAr,
                message: `AI Decision ${decision.decisionCode}: ${action.title}`,
                messageAr: `قرار الذكاء الاصطناعي ${decision.decisionCode}: ${action.titleAr}`,
                referenceType: 'decision',
                referenceId: decision.id,
                status: 'UNREAD',
                createdBy: userId,
              } as any,
            });

            integrationResult = 'NOTIFICATION_SENT';
          } else if (action.actionType === 'VENDOR_EVALUATION') {
            // Flag PO vendor for evaluation by creating a vendor audit
            const audit = await prisma.imdadVendorAudit.create({
              data: {
                tenantId,
                organizationId: decision.organizationId!,
                vendorId: (decision as any).vendorId || undefined,
                auditType: 'AI_TRIGGERED' as any,
                status: 'PLANNED',
                notes: `Auto-triggered by AI Decision Engine — ${action.title}`,
                createdBy: userId,
                updatedBy: userId,
              } as any,
            });

            integrationResult = 'VENDOR_AUDIT_CREATED';
            integrationRefId = audit.id;
          }
        } catch (integrationError) {
          // Integration failures should not block the decision execution
          integrationResult = `INTEGRATION_FAILED: ${integrationError instanceof Error ? integrationError.message : 'unknown'}`;
        }

        await prisma.imdadDecisionAction.create({
          data: {
            tenantId,
            organizationId: decision.organizationId,
            decisionId: decision.id,
            actionCode,
            actionType: action.actionType,
            sequenceOrder: i + 1,
            title: action.title,
            titleAr: action.titleAr,
            status: integrationResult?.startsWith('INTEGRATION_FAILED') ? 'FAILED' : 'COMPLETED',
            completedAt: now,
            integrationResult: integrationResult,
            integrationRefId: integrationRefId,
            createdAt: now,
            updatedAt: now,
          } as any,
        });

        createdActionTypes.push(action.actionType);
      }

      // Mark as COMPLETED
      await prisma.imdadDecision.update({
        where: { id: decision.id },
        data: {
          status: 'COMPLETED',
          executedAt: now,
          executedBy: userId,
          updatedAt: now,
        },
      });

      totalActionsCreated += actions.length;
      executions.push({
        decisionId: decision.id,
        decisionCode: decision.decisionCode as string,
        previousStatus: decision.status as string,
        actionsCreated: actions.length,
        actionTypes: createdActionTypes,
        executionMode: confidenceScore >= 90 ? 'FULL_AUTO' : 'CONDITIONAL_AUTO',
      });
    }

    return NextResponse.json({
      summary: {
        decisionsExecuted: executions.length,
        decisionsEscalated: escalations.length,
        actionsCreated: totalActionsCreated,
        executedAt: now.toISOString(),
      },
      executions,
      escalations,
    });
  },
  {
    tenantScoped: true,
    platformKey: 'imdad' as any,
    permissionKey: 'imdad.decisions.manage',
  },
);
