import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const AUTO_APPROVAL_THRESHOLD = 85;
const DUPLICATE_WINDOW_MS = 12 * 60 * 60 * 1000; // 12 hours

// Severity → escalation level
const SEVERITY_ESCALATION: Record<string, string> = {
  CRITICAL: 'CORPORATE',
  HIGH: 'HOSPITAL',
  MEDIUM: 'DEPARTMENT',
  LOW: 'NONE',
  INFO: 'NONE',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeCode(prefix: string, year: number, seq: number): string {
  return `${prefix}-${year}-${String(seq).padStart(6, '0')}`;
}

interface PredictionDetail {
  entity: string;
  metric: string;
  predictedDate: string;
  confidence: number;
}

interface ModelResult {
  model: string;
  modelAr: string;
  horizon: string;
  findings: number;
  signalsGenerated: number;
  decisionsGenerated: number;
  highestConfidence: number;
  details: PredictionDetail[];
}

interface SignalInput {
  signalType: string;
  severity: string;
  title: string;
  titleAr: string;
  sourceEntity: string;
  sourceEntityId: string;
  departmentId?: string | null;
  metricValue?: number | null;
  threshold?: number | null;
  deviationPct?: number | null;
}

interface DecisionInput {
  decisionType: string;
  title: string;
  titleAr: string;
  confidenceScore: number;
  riskScore: number;
  impactScore: number;
  costImpact?: number | null;
  savingsEstimate?: number | null;
  aiReasoning: string;
  aiReasoningAr: string;
  executionDeadline?: Date | null;
  sourceSignals: string[];
}

async function createSignalIfNotDuplicate(
  tenantId: string,
  organizationId: string,
  userId: string,
  input: SignalInput,
  now: Date,
  duplicateCutoff: Date,
  seqRef: { value: number },
  year: number,
): Promise<any | null> {
  const existing = await prisma.imdadOperationalSignal.findFirst({
    where: {
      tenantId,
      signalType: input.signalType as any,
      sourceEntity: input.sourceEntity,
      sourceEntityId: input.sourceEntityId,
      createdAt: { gte: duplicateCutoff },
    },
  }).catch(() => null);

  if (existing) return null;

  seqRef.value++;
  const signalCode = makeCode('PSG', year, seqRef.value);

  return prisma.imdadOperationalSignal.create({
    data: {
      tenantId,
      signalCode,
      organizationId,
      signalType: input.signalType as any,
      severity: input.severity as any,
      title: input.title,
      titleAr: input.titleAr,
      sourceEntity: input.sourceEntity,
      sourceEntityId: input.sourceEntityId,
      departmentId: input.departmentId || null,
      metricValue: input.metricValue ?? null,
      threshold: input.threshold ?? null,
      deviationPct: input.deviationPct ?? null,
      acknowledged: false,
      createdAt: now,
      updatedAt: now,
    },
  }).catch(() => null);
}

async function createDecision(
  tenantId: string,
  organizationId: string,
  userId: string,
  input: DecisionInput,
  now: Date,
  seqRef: { value: number },
  year: number,
): Promise<any | null> {
  seqRef.value++;
  const decisionCode = makeCode('PRD', year, seqRef.value);
  const autoApproved = input.confidenceScore >= AUTO_APPROVAL_THRESHOLD;
  const status = autoApproved ? 'AUTO_APPROVED' : 'GENERATED';
  const escalationLevel =
    input.riskScore >= 90 ? 'CORPORATE' : input.riskScore >= 70 ? 'HOSPITAL' : input.riskScore >= 40 ? 'DEPARTMENT' : 'NONE';

  return prisma.imdadDecision.create({
    data: {
      tenantId,
      decisionCode,
      organizationId,
      decisionType: input.decisionType as any,
      title: input.title,
      titleAr: input.titleAr,
      confidenceScore: input.confidenceScore,
      riskScore: input.riskScore,
      impactScore: input.impactScore,
      costImpact: input.costImpact ?? null,
      savingsEstimate: input.savingsEstimate ?? null,
      escalationLevel,
      sourceSignals: input.sourceSignals,
      recommendedActions: [],
      alternativeOptions: [],
      aiReasoning: input.aiReasoning,
      aiReasoningAr: input.aiReasoningAr,
      autoApprovalThreshold: AUTO_APPROVAL_THRESHOLD,
      autoApproved,
      status,
      executionDeadline: input.executionDeadline ?? null,
      createdBy: userId,
      metadata: { source: 'PREDICTIVE_ENGINE' },
      createdAt: now,
      updatedAt: now,
    },
  }).catch(() => null);
}

// ---------------------------------------------------------------------------
// POST /api/imdad/decisions/autonomous/predict — Predictive Engine
// Simulates near-future scenarios and generates proactive decisions
// ---------------------------------------------------------------------------
export const POST = withAuthTenant(
  async (req: NextRequest, { tenantId, userId }) => {
    const sp = req.nextUrl.searchParams;
    const organizationId = sp.get('organizationId')?.trim() || 'SYSTEM';

    const now = new Date();
    const year = now.getFullYear();
    const duplicateCutoff = new Date(now.getTime() - DUPLICATE_WINDOW_MS);

    const signalBaseCount = await prisma.imdadOperationalSignal.count({ where: { tenantId } }).catch(() => 0);
    const decisionBaseCount = await prisma.imdadDecision.count({ where: { tenantId } }).catch(() => 0);
    const signalSeq = { value: signalBaseCount };
    const decisionSeq = { value: decisionBaseCount };

    const predictions: ModelResult[] = [];

    // -----------------------------------------------------------------------
    // 1. STOCKOUT_PREDICTION (7-day horizon)
    // -----------------------------------------------------------------------
    try {
      const model: ModelResult = {
        model: 'STOCKOUT_PREDICTION',
        modelAr: '\u062a\u0648\u0642\u0639 \u0646\u0641\u0627\u062f \u0627\u0644\u0645\u062e\u0632\u0648\u0646',
        horizon: '7 days',
        findings: 0,
        signalsGenerated: 0,
        decisionsGenerated: 0,
        highestConfidence: 0,
        details: [],
      };

      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const itemLocations: any[] = await (prisma as any).imdadItemLocation
        ?.findMany?.({
          where: {
            tenantId,
            ...(organizationId !== 'SYSTEM' ? { organizationId } : {}),
          },
          take: 500,
        })
        ?.catch?.(() => []) ?? [];

      const transactions: any[] = await (prisma as any).imdadStockTransaction
        ?.findMany?.({
          where: {
            tenantId,
            ...(organizationId !== 'SYSTEM' ? { organizationId } : {}),
            createdAt: { gte: thirtyDaysAgo },
          },
          take: 5000,
        })
        ?.catch?.(() => []) ?? [];

      // Build consumption map: itemId+locationId -> total consumed
      const consumptionMap = new Map<string, number>();
      for (const tx of transactions) {
        if ((tx.transactionType === 'ISSUE' || tx.transactionType === 'DISPENSE' || tx.transactionType === 'CONSUMPTION') && tx.quantity > 0) {
          const key = `${tx.itemId || tx.itemLocationId}`;
          consumptionMap.set(key, (consumptionMap.get(key) || 0) + Math.abs(tx.quantity));
        }
      }

      for (const il of itemLocations) {
        const currentStock = il.currentStock ?? il.quantityOnHand ?? 0;
        if (currentStock <= 0) continue;

        const key = `${il.itemId || il.id}`;
        const totalConsumed = consumptionMap.get(key) || 0;
        if (totalConsumed <= 0) continue;

        const dailyConsumptionRate = totalConsumed / 30;
        const daysUntilStockout = currentStock / dailyConsumptionRate;

        if (daysUntilStockout <= 7) {
          const confidence = Math.max(50, Math.round(95 - daysUntilStockout * 5));
          model.findings++;
          model.highestConfidence = Math.max(model.highestConfidence, confidence);

          const predictedDate = new Date(now.getTime() + daysUntilStockout * 24 * 60 * 60 * 1000);
          model.details.push({
            entity: il.itemName || il.itemId || il.id,
            metric: `${daysUntilStockout.toFixed(1)} days until stockout (stock: ${currentStock}, daily rate: ${dailyConsumptionRate.toFixed(1)})`,
            predictedDate: predictedDate.toISOString().split('T')[0],
            confidence,
          });

          const signal = await createSignalIfNotDuplicate(
            tenantId, organizationId, userId,
            {
              signalType: 'STOCKOUT_RISK',
              severity: daysUntilStockout <= 2 ? 'CRITICAL' : daysUntilStockout <= 4 ? 'HIGH' : 'MEDIUM',
              title: `Predicted stockout: ${il.itemName || il.itemId} in ${daysUntilStockout.toFixed(1)} days`,
              titleAr: `\u062a\u0648\u0642\u0639 \u0646\u0641\u0627\u062f: ${il.itemNameAr || il.itemName || il.itemId} \u062e\u0644\u0627\u0644 ${daysUntilStockout.toFixed(1)} \u064a\u0648\u0645`,
              sourceEntity: 'imdadItemLocation',
              sourceEntityId: il.id,
              departmentId: il.departmentId || null,
              metricValue: daysUntilStockout,
              threshold: 7,
              deviationPct: ((7 - daysUntilStockout) / 7) * 100,
            },
            now, duplicateCutoff, signalSeq, year,
          );

          if (signal) {
            model.signalsGenerated++;
            const decision = await createDecision(
              tenantId, organizationId, userId,
              {
                decisionType: 'SUPPLY_REORDER',
                title: `Reorder: ${il.itemName || il.itemId} — predicted stockout in ${daysUntilStockout.toFixed(1)} days`,
                titleAr: `\u0625\u0639\u0627\u062f\u0629 \u0637\u0644\u0628: ${il.itemNameAr || il.itemName || il.itemId} \u2014 \u062a\u0648\u0642\u0639 \u0646\u0641\u0627\u062f \u062e\u0644\u0627\u0644 ${daysUntilStockout.toFixed(1)} \u064a\u0648\u0645`,
                confidenceScore: confidence,
                riskScore: daysUntilStockout <= 2 ? 90 : daysUntilStockout <= 4 ? 70 : 50,
                impactScore: daysUntilStockout <= 2 ? 85 : 60,
                aiReasoning: `Predictive model: daily consumption rate ${dailyConsumptionRate.toFixed(2)} units/day, current stock ${currentStock}, projected stockout on ${predictedDate.toISOString().split('T')[0]}. Confidence: ${confidence}%.`,
                aiReasoningAr: `\u0627\u0644\u0646\u0645\u0648\u0630\u062c \u0627\u0644\u062a\u0646\u0628\u0624\u064a: \u0645\u0639\u062f\u0644 \u0627\u0644\u0627\u0633\u062a\u0647\u0644\u0627\u0643 \u0627\u0644\u064a\u0648\u0645\u064a ${dailyConsumptionRate.toFixed(2)} \u0648\u062d\u062f\u0629/\u064a\u0648\u0645\u060c \u0627\u0644\u0645\u062e\u0632\u0648\u0646 \u0627\u0644\u062d\u0627\u0644\u064a ${currentStock}\u060c \u0627\u0644\u0646\u0641\u0627\u062f \u0627\u0644\u0645\u062a\u0648\u0642\u0639 \u0641\u064a ${predictedDate.toISOString().split('T')[0]}. \u0627\u0644\u062b\u0642\u0629: ${confidence}%.`,
                sourceSignals: [signal.id],
                executionDeadline: new Date(now.getTime() + Math.max(1, daysUntilStockout - 1) * 24 * 60 * 60 * 1000),
              },
              now, decisionSeq, year,
            );
            if (decision) model.decisionsGenerated++;
          }
        }
      }

      predictions.push(model);
    } catch {
      predictions.push({
        model: 'STOCKOUT_PREDICTION',
        modelAr: '\u062a\u0648\u0642\u0639 \u0646\u0641\u0627\u062f \u0627\u0644\u0645\u062e\u0632\u0648\u0646',
        horizon: '7 days',
        findings: 0, signalsGenerated: 0, decisionsGenerated: 0, highestConfidence: 0, details: [],
      });
    }

    // -----------------------------------------------------------------------
    // 2. ASSET_FAILURE_PREDICTION (30-day horizon)
    // -----------------------------------------------------------------------
    try {
      const model: ModelResult = {
        model: 'ASSET_FAILURE_PREDICTION',
        modelAr: '\u062a\u0648\u0642\u0639 \u0639\u0637\u0644 \u0627\u0644\u0623\u0635\u0648\u0644',
        horizon: '30 days',
        findings: 0,
        signalsGenerated: 0,
        decisionsGenerated: 0,
        highestConfidence: 0,
        details: [],
      };

      const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const assets: any[] = await (prisma as any).imdadAsset
        ?.findMany?.({
          where: {
            tenantId,
            ...(organizationId !== 'SYSTEM' ? { organizationId } : {}),
            status: 'ACTIVE',
            OR: [
              { nextMaintenanceDate: { lte: thirtyDaysFromNow } },
              { nextMaintenanceDate: { lt: now } },
            ],
          },
          take: 500,
        })
        ?.catch?.(() => []) ?? [];

      for (const asset of assets) {
        const maintenanceRecords: any[] = await (prisma as any).imdadMaintenanceRecord
          ?.findMany?.({
            where: {
              tenantId,
              assetId: asset.id,
            },
            take: 100,
          })
          ?.catch?.(() => []) ?? [];

        const totalRecords = maintenanceRecords.length;
        const correctiveCount = maintenanceRecords.filter(
          (r: any) => r.maintenanceType === 'CORRECTIVE' || r.maintenanceType === 'EMERGENCY' || r.maintenanceType === 'BREAKDOWN',
        ).length;
        const correctiveRatio = totalRecords > 0 ? correctiveCount / totalRecords : 0;

        const nextMaint = asset.nextMaintenanceDate ? new Date(asset.nextMaintenanceDate) : null;
        const isOverdue = nextMaint ? nextMaint < now : false;
        const daysOverdue = isOverdue && nextMaint ? Math.ceil((now.getTime() - nextMaint.getTime()) / (24 * 60 * 60 * 1000)) : 0;

        // Failure spike: high corrective ratio
        if (correctiveRatio > 0.6 && totalRecords >= 3) {
          const confidence = Math.min(95, Math.round(50 + correctiveRatio * 40 + (isOverdue ? 10 : 0)));
          model.findings++;
          model.highestConfidence = Math.max(model.highestConfidence, confidence);

          model.details.push({
            entity: asset.name || asset.assetCode || asset.id,
            metric: `Corrective ratio: ${(correctiveRatio * 100).toFixed(0)}% (${correctiveCount}/${totalRecords})`,
            predictedDate: nextMaint ? nextMaint.toISOString().split('T')[0] : 'overdue',
            confidence,
          });

          const signal = await createSignalIfNotDuplicate(
            tenantId, organizationId, userId,
            {
              signalType: 'FAILURE_SPIKE',
              severity: correctiveRatio > 0.8 ? 'CRITICAL' : 'HIGH',
              title: `Predicted failure: ${asset.name || asset.assetCode} (corrective ratio ${(correctiveRatio * 100).toFixed(0)}%)`,
              titleAr: `\u062a\u0648\u0642\u0639 \u0639\u0637\u0644: ${asset.nameAr || asset.assetCode} (\u0646\u0633\u0628\u0629 \u0627\u0644\u0625\u0635\u0644\u0627\u062d ${(correctiveRatio * 100).toFixed(0)}%)`,
              sourceEntity: 'imdadAsset',
              sourceEntityId: asset.id,
              departmentId: asset.departmentId || null,
              metricValue: correctiveRatio * 100,
              threshold: 60,
              deviationPct: ((correctiveRatio - 0.6) / 0.6) * 100,
            },
            now, duplicateCutoff, signalSeq, year,
          );

          if (signal) {
            model.signalsGenerated++;
            const decision = await createDecision(
              tenantId, organizationId, userId,
              {
                decisionType: 'DEVICE_REPLACEMENT',
                title: `Replace: ${asset.name || asset.assetCode} — high failure rate (${(correctiveRatio * 100).toFixed(0)}%)`,
                titleAr: `\u0627\u0633\u062a\u0628\u062f\u0627\u0644: ${asset.nameAr || asset.assetCode} \u2014 \u0645\u0639\u062f\u0644 \u0623\u0639\u0637\u0627\u0644 \u0645\u0631\u062a\u0641\u0639 (${(correctiveRatio * 100).toFixed(0)}%)`,
                confidenceScore: confidence,
                riskScore: correctiveRatio > 0.8 ? 90 : 75,
                impactScore: correctiveRatio > 0.8 ? 85 : 65,
                costImpact: asset.purchasePrice ?? null,
                aiReasoning: `Asset ${asset.assetCode} shows ${correctiveCount} corrective out of ${totalRecords} total maintenance records (${(correctiveRatio * 100).toFixed(0)}%). High corrective ratio indicates imminent failure risk. Confidence: ${confidence}%.`,
                aiReasoningAr: `\u0627\u0644\u0623\u0635\u0644 ${asset.assetCode} \u0623\u0638\u0647\u0631 ${correctiveCount} \u0625\u0635\u0644\u0627\u062d \u062a\u0635\u062d\u064a\u062d\u064a \u0645\u0646 ${totalRecords} \u0633\u062c\u0644 \u0635\u064a\u0627\u0646\u0629 (${(correctiveRatio * 100).toFixed(0)}%). \u0646\u0633\u0628\u0629 \u0627\u0644\u0625\u0635\u0644\u0627\u062d \u0627\u0644\u0639\u0627\u0644\u064a\u0629 \u062a\u0634\u064a\u0631 \u0625\u0644\u0649 \u062e\u0637\u0631 \u0639\u0637\u0644 \u0648\u0634\u064a\u0643. \u0627\u0644\u062b\u0642\u0629: ${confidence}%.`,
                sourceSignals: [signal.id],
                executionDeadline: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
              },
              now, decisionSeq, year,
            );
            if (decision) model.decisionsGenerated++;
          }
        }

        // Compliance gap: overdue maintenance
        if (isOverdue && daysOverdue > 0) {
          const confidence = Math.min(95, Math.round(60 + daysOverdue * 2));
          model.findings++;
          model.highestConfidence = Math.max(model.highestConfidence, confidence);

          model.details.push({
            entity: asset.name || asset.assetCode || asset.id,
            metric: `Maintenance overdue by ${daysOverdue} days`,
            predictedDate: nextMaint!.toISOString().split('T')[0],
            confidence,
          });

          const signal = await createSignalIfNotDuplicate(
            tenantId, organizationId, userId,
            {
              signalType: 'COMPLIANCE_GAP',
              severity: daysOverdue > 30 ? 'CRITICAL' : daysOverdue > 14 ? 'HIGH' : 'MEDIUM',
              title: `Overdue maintenance: ${asset.name || asset.assetCode} (${daysOverdue} days)`,
              titleAr: `\u0635\u064a\u0627\u0646\u0629 \u0645\u062a\u0623\u062e\u0631\u0629: ${asset.nameAr || asset.assetCode} (${daysOverdue} \u064a\u0648\u0645)`,
              sourceEntity: 'imdadAsset',
              sourceEntityId: asset.id,
              departmentId: asset.departmentId || null,
              metricValue: daysOverdue,
              threshold: 0,
              deviationPct: 100,
            },
            now, duplicateCutoff, signalSeq, year,
          );

          if (signal) model.signalsGenerated++;
        }
      }

      predictions.push(model);
    } catch {
      predictions.push({
        model: 'ASSET_FAILURE_PREDICTION',
        modelAr: '\u062a\u0648\u0642\u0639 \u0639\u0637\u0644 \u0627\u0644\u0623\u0635\u0648\u0644',
        horizon: '30 days',
        findings: 0, signalsGenerated: 0, decisionsGenerated: 0, highestConfidence: 0, details: [],
      });
    }

    // -----------------------------------------------------------------------
    // 3. BUDGET_EXHAUSTION_PREDICTION (30-day horizon)
    // -----------------------------------------------------------------------
    try {
      const model: ModelResult = {
        model: 'BUDGET_EXHAUSTION_PREDICTION',
        modelAr: '\u062a\u0648\u0642\u0639 \u0627\u0633\u062a\u0646\u0641\u0627\u062f \u0627\u0644\u0645\u064a\u0632\u0627\u0646\u064a\u0629',
        horizon: '30 days',
        findings: 0,
        signalsGenerated: 0,
        decisionsGenerated: 0,
        highestConfidence: 0,
        details: [],
      };

      const budgets: any[] = await (prisma as any).imdadBudget
        ?.findMany?.({
          where: {
            tenantId,
            ...(organizationId !== 'SYSTEM' ? { organizationId } : {}),
            status: { in: ['ACTIVE', 'APPROVED'] },
          },
          take: 200,
        })
        ?.catch?.(() => []) ?? [];

      for (const budget of budgets) {
        const allocated = budget.allocatedAmount ?? budget.totalAmount ?? 0;
        const consumed = budget.consumedAmount ?? budget.usedAmount ?? 0;
        if (allocated <= 0 || consumed <= 0) continue;

        const startDate = budget.startDate ? new Date(budget.startDate) : budget.createdAt ? new Date(budget.createdAt) : null;
        if (!startDate) continue;

        const daysElapsed = Math.max(1, (now.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
        const dailyBurnRate = consumed / daysElapsed;
        if (dailyBurnRate <= 0) continue;

        const remaining = allocated - consumed;
        if (remaining <= 0) continue;

        const daysUntilExhausted = remaining / dailyBurnRate;

        if (daysUntilExhausted <= 30) {
          const confidence = Math.max(55, Math.round(95 - daysUntilExhausted));
          model.findings++;
          model.highestConfidence = Math.max(model.highestConfidence, confidence);

          const predictedDate = new Date(now.getTime() + daysUntilExhausted * 24 * 60 * 60 * 1000);
          model.details.push({
            entity: budget.name || budget.budgetCode || budget.id,
            metric: `${daysUntilExhausted.toFixed(1)} days remaining (burn rate: ${dailyBurnRate.toFixed(0)}/day)`,
            predictedDate: predictedDate.toISOString().split('T')[0],
            confidence,
          });

          const signal = await createSignalIfNotDuplicate(
            tenantId, organizationId, userId,
            {
              signalType: 'BUDGET_OVERRUN',
              severity: daysUntilExhausted <= 7 ? 'CRITICAL' : daysUntilExhausted <= 14 ? 'HIGH' : 'MEDIUM',
              title: `Budget exhaustion: ${budget.name || budget.budgetCode} in ${daysUntilExhausted.toFixed(1)} days`,
              titleAr: `\u0627\u0633\u062a\u0646\u0641\u0627\u062f \u0627\u0644\u0645\u064a\u0632\u0627\u0646\u064a\u0629: ${budget.nameAr || budget.name || budget.budgetCode} \u062e\u0644\u0627\u0644 ${daysUntilExhausted.toFixed(1)} \u064a\u0648\u0645`,
              sourceEntity: 'imdadBudget',
              sourceEntityId: budget.id,
              departmentId: budget.departmentId || null,
              metricValue: daysUntilExhausted,
              threshold: 30,
              deviationPct: ((30 - daysUntilExhausted) / 30) * 100,
            },
            now, duplicateCutoff, signalSeq, year,
          );

          if (signal) {
            model.signalsGenerated++;
            const decision = await createDecision(
              tenantId, organizationId, userId,
              {
                decisionType: 'COST_OPTIMIZATION',
                title: `Optimize spend: ${budget.name || budget.budgetCode} — exhaustion in ${daysUntilExhausted.toFixed(1)} days`,
                titleAr: `\u062a\u062d\u0633\u064a\u0646 \u0627\u0644\u0625\u0646\u0641\u0627\u0642: ${budget.nameAr || budget.name || budget.budgetCode} \u2014 \u0627\u0633\u062a\u0646\u0641\u0627\u062f \u062e\u0644\u0627\u0644 ${daysUntilExhausted.toFixed(1)} \u064a\u0648\u0645`,
                confidenceScore: confidence,
                riskScore: daysUntilExhausted <= 7 ? 90 : 65,
                impactScore: 70,
                costImpact: remaining,
                savingsEstimate: remaining * 0.15,
                aiReasoning: `Budget ${budget.budgetCode || budget.id}: allocated ${allocated}, consumed ${consumed} (${((consumed / allocated) * 100).toFixed(1)}%). Daily burn rate: ${dailyBurnRate.toFixed(0)}. Projected exhaustion: ${predictedDate.toISOString().split('T')[0]}. Confidence: ${confidence}%.`,
                aiReasoningAr: `\u0627\u0644\u0645\u064a\u0632\u0627\u0646\u064a\u0629 ${budget.budgetCode || budget.id}: \u0645\u062e\u0635\u0635 ${allocated}\u060c \u0645\u0633\u062a\u0647\u0644\u0643 ${consumed} (${((consumed / allocated) * 100).toFixed(1)}%). \u0645\u0639\u062f\u0644 \u0627\u0644\u0627\u0633\u062a\u0647\u0644\u0627\u0643 \u0627\u0644\u064a\u0648\u0645\u064a: ${dailyBurnRate.toFixed(0)}. \u0627\u0644\u0627\u0633\u062a\u0646\u0641\u0627\u062f \u0627\u0644\u0645\u062a\u0648\u0642\u0639: ${predictedDate.toISOString().split('T')[0]}. \u0627\u0644\u062b\u0642\u0629: ${confidence}%.`,
                sourceSignals: [signal.id],
                executionDeadline: new Date(now.getTime() + Math.min(daysUntilExhausted, 14) * 24 * 60 * 60 * 1000),
              },
              now, decisionSeq, year,
            );
            if (decision) model.decisionsGenerated++;
          }
        }
      }

      predictions.push(model);
    } catch {
      predictions.push({
        model: 'BUDGET_EXHAUSTION_PREDICTION',
        modelAr: '\u062a\u0648\u0642\u0639 \u0627\u0633\u062a\u0646\u0641\u0627\u062f \u0627\u0644\u0645\u064a\u0632\u0627\u0646\u064a\u0629',
        horizon: '30 days',
        findings: 0, signalsGenerated: 0, decisionsGenerated: 0, highestConfidence: 0, details: [],
      });
    }

    // -----------------------------------------------------------------------
    // 4. EXPIRY_CASCADE_PREDICTION (90-day horizon)
    // -----------------------------------------------------------------------
    try {
      const model: ModelResult = {
        model: 'EXPIRY_CASCADE_PREDICTION',
        modelAr: '\u062a\u0648\u0642\u0639 \u062a\u0633\u0644\u0633\u0644 \u0627\u0646\u062a\u0647\u0627\u0621 \u0627\u0644\u0635\u0644\u0627\u062d\u064a\u0629',
        horizon: '90 days',
        findings: 0,
        signalsGenerated: 0,
        decisionsGenerated: 0,
        highestConfidence: 0,
        details: [],
      };

      const ninetyDaysFromNow = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

      const expiringBatches: any[] = await (prisma as any).imdadBatchLot
        ?.findMany?.({
          where: {
            tenantId,
            ...(organizationId !== 'SYSTEM' ? { organizationId } : {}),
            expiryDate: { lte: ninetyDaysFromNow, gte: now },
            status: 'ACTIVE',
          },
          take: 1000,
        })
        ?.catch?.(() => []) ?? [];

      // Group by item
      const itemBatchMap = new Map<string, { expiring: any[]; totalQty: number; expiringQty: number }>();
      for (const batch of expiringBatches) {
        const itemId = batch.itemId || batch.id;
        if (!itemBatchMap.has(itemId)) {
          itemBatchMap.set(itemId, { expiring: [], totalQty: 0, expiringQty: 0 });
        }
        const entry = itemBatchMap.get(itemId)!;
        entry.expiring.push(batch);
        entry.expiringQty += batch.currentQuantity ?? batch.quantity ?? 0;
      }

      // Get total stock for each item to compute cascade ratio
      for (const [itemId, entry] of itemBatchMap.entries()) {
        const allBatches: any[] = await (prisma as any).imdadBatchLot
          ?.findMany?.({
            where: {
              tenantId,
              itemId,
              status: 'ACTIVE',
              currentQuantity: { gt: 0 },
            },
          })
          ?.catch?.(() => []) ?? [];

        const totalQty = allBatches.reduce((sum: number, b: any) => sum + (b.currentQuantity ?? b.quantity ?? 0), 0);
        entry.totalQty = totalQty;
      }

      for (const [itemId, entry] of itemBatchMap.entries()) {
        if (entry.totalQty <= 0) continue;
        const cascadeRatio = entry.expiringQty / entry.totalQty;
        if (cascadeRatio <= 0.5) continue;

        // Cascade detected
        const soonestBatch = entry.expiring.reduce((min: any, b: any) => {
          const d = new Date(b.expiryDate);
          return !min || d < new Date(min.expiryDate) ? b : min;
        }, null);

        const daysUntilExpiry = soonestBatch
          ? Math.ceil((new Date(soonestBatch.expiryDate).getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
          : 90;
        const confidence = Math.max(50, Math.round(90 - daysUntilExpiry / 3));
        model.findings++;
        model.highestConfidence = Math.max(model.highestConfidence, confidence);

        const itemName = soonestBatch?.itemName || itemId;
        model.details.push({
          entity: itemName,
          metric: `${(cascadeRatio * 100).toFixed(0)}% of stock expiring (${entry.expiringQty}/${entry.totalQty} units, ${entry.expiring.length} batches)`,
          predictedDate: soonestBatch ? new Date(soonestBatch.expiryDate).toISOString().split('T')[0] : '',
          confidence,
        });

        const signal = await createSignalIfNotDuplicate(
          tenantId, organizationId, userId,
          {
            signalType: 'EXPIRY_WARNING',
            severity: daysUntilExpiry <= 14 ? 'CRITICAL' : daysUntilExpiry <= 30 ? 'HIGH' : 'MEDIUM',
            title: `Expiry cascade: ${itemName} — ${(cascadeRatio * 100).toFixed(0)}% of stock expiring`,
            titleAr: `\u062a\u0633\u0644\u0633\u0644 \u0627\u0646\u062a\u0647\u0627\u0621 \u0627\u0644\u0635\u0644\u0627\u062d\u064a\u0629: ${soonestBatch?.itemNameAr || itemName} \u2014 ${(cascadeRatio * 100).toFixed(0)}% \u0645\u0646 \u0627\u0644\u0645\u062e\u0632\u0648\u0646 \u064a\u0646\u062a\u0647\u064a`,
            sourceEntity: 'imdadBatchLot',
            sourceEntityId: soonestBatch?.id || itemId,
            departmentId: soonestBatch?.departmentId || null,
            metricValue: cascadeRatio * 100,
            threshold: 50,
            deviationPct: ((cascadeRatio - 0.5) / 0.5) * 100,
          },
          now, duplicateCutoff, signalSeq, year,
        );

        if (signal) {
          model.signalsGenerated++;
          const decision = await createDecision(
            tenantId, organizationId, userId,
            {
              decisionType: 'SUPPLY_REORDER',
              title: `Reorder before cascade: ${itemName} — ${(cascadeRatio * 100).toFixed(0)}% stock expiring within 90 days`,
              titleAr: `\u0625\u0639\u0627\u062f\u0629 \u0637\u0644\u0628 \u0642\u0628\u0644 \u0627\u0644\u062a\u0633\u0644\u0633\u0644: ${soonestBatch?.itemNameAr || itemName} \u2014 ${(cascadeRatio * 100).toFixed(0)}% \u0645\u0646 \u0627\u0644\u0645\u062e\u0632\u0648\u0646 \u064a\u0646\u062a\u0647\u064a \u062e\u0644\u0627\u0644 90 \u064a\u0648\u0645`,
              confidenceScore: confidence,
              riskScore: daysUntilExpiry <= 14 ? 85 : 60,
              impactScore: 70,
              aiReasoning: `Expiry cascade detected for ${itemName}: ${entry.expiringQty} of ${entry.totalQty} units (${(cascadeRatio * 100).toFixed(0)}%) in ${entry.expiring.length} batches expire within 90 days. Soonest expiry: ${daysUntilExpiry} days. Confidence: ${confidence}%.`,
              aiReasoningAr: `\u062a\u0645 \u0627\u0643\u062a\u0634\u0627\u0641 \u062a\u0633\u0644\u0633\u0644 \u0627\u0646\u062a\u0647\u0627\u0621 \u0635\u0644\u0627\u062d\u064a\u0629 \u0644\u0640 ${itemName}: ${entry.expiringQty} \u0645\u0646 ${entry.totalQty} \u0648\u062d\u062f\u0629 (${(cascadeRatio * 100).toFixed(0)}%) \u0641\u064a ${entry.expiring.length} \u062f\u0641\u0639\u0629 \u062a\u0646\u062a\u0647\u064a \u062e\u0644\u0627\u0644 90 \u064a\u0648\u0645. \u0623\u0642\u0631\u0628 \u0627\u0646\u062a\u0647\u0627\u0621: ${daysUntilExpiry} \u064a\u0648\u0645. \u0627\u0644\u062b\u0642\u0629: ${confidence}%.`,
              sourceSignals: [signal.id],
              executionDeadline: new Date(now.getTime() + Math.min(daysUntilExpiry, 30) * 24 * 60 * 60 * 1000),
            },
            now, decisionSeq, year,
          );
          if (decision) model.decisionsGenerated++;
        }
      }

      predictions.push(model);
    } catch {
      predictions.push({
        model: 'EXPIRY_CASCADE_PREDICTION',
        modelAr: '\u062a\u0648\u0642\u0639 \u062a\u0633\u0644\u0633\u0644 \u0627\u0646\u062a\u0647\u0627\u0621 \u0627\u0644\u0635\u0644\u0627\u062d\u064a\u0629',
        horizon: '90 days',
        findings: 0, signalsGenerated: 0, decisionsGenerated: 0, highestConfidence: 0, details: [],
      });
    }

    // -----------------------------------------------------------------------
    // 5. VENDOR_DECLINE_PREDICTION
    // -----------------------------------------------------------------------
    try {
      const model: ModelResult = {
        model: 'VENDOR_DECLINE_PREDICTION',
        modelAr: '\u062a\u0648\u0642\u0639 \u062a\u0631\u0627\u062c\u0639 \u0627\u0644\u0645\u0648\u0631\u062f',
        horizon: 'trend-based',
        findings: 0,
        signalsGenerated: 0,
        decisionsGenerated: 0,
        highestConfidence: 0,
        details: [],
      };

      const scorecards: any[] = await (prisma as any).imdadVendorScorecard
        ?.findMany?.({
          where: {
            tenantId,
            ...(organizationId !== 'SYSTEM' ? { organizationId } : {}),
          },
          orderBy: { createdAt: 'desc' },
          take: 1000,
        })
        ?.catch?.(() => []) ?? [];

      // Group by vendorId, take latest 2
      const vendorScoreMap = new Map<string, any[]>();
      for (const sc of scorecards) {
        const vid = sc.vendorId || sc.id;
        if (!vendorScoreMap.has(vid)) vendorScoreMap.set(vid, []);
        const arr = vendorScoreMap.get(vid)!;
        if (arr.length < 2) arr.push(sc);
      }

      for (const [vendorId, scores] of vendorScoreMap.entries()) {
        if (scores.length < 2) continue;

        const latestScore = scores[0].overallScore ?? scores[0].totalScore ?? 0;
        const previousScore = scores[1].overallScore ?? scores[1].totalScore ?? 0;
        const decline = previousScore - latestScore;

        if (decline > 10) {
          const confidence = Math.min(90, Math.round(50 + decline * 2));
          model.findings++;
          model.highestConfidence = Math.max(model.highestConfidence, confidence);

          const vendorName = scores[0].vendorName || vendorId;
          model.details.push({
            entity: vendorName,
            metric: `Score declined ${decline.toFixed(0)} points (${previousScore} → ${latestScore})`,
            predictedDate: now.toISOString().split('T')[0],
            confidence,
          });

          const signal = await createSignalIfNotDuplicate(
            tenantId, organizationId, userId,
            {
              signalType: 'VENDOR_RISK',
              severity: decline > 25 ? 'CRITICAL' : decline > 15 ? 'HIGH' : 'MEDIUM',
              title: `Vendor decline: ${vendorName} dropped ${decline.toFixed(0)} points`,
              titleAr: `\u062a\u0631\u0627\u062c\u0639 \u0627\u0644\u0645\u0648\u0631\u062f: ${scores[0].vendorNameAr || vendorName} \u0627\u0646\u062e\u0641\u0636 ${decline.toFixed(0)} \u0646\u0642\u0637\u0629`,
              sourceEntity: 'imdadVendorScorecard',
              sourceEntityId: scores[0].id,
              metricValue: latestScore,
              threshold: previousScore,
              deviationPct: previousScore > 0 ? (decline / previousScore) * 100 : 100,
            },
            now, duplicateCutoff, signalSeq, year,
          );

          if (signal) {
            model.signalsGenerated++;
            const decision = await createDecision(
              tenantId, organizationId, userId,
              {
                decisionType: 'VENDOR_SWITCH',
                title: `Evaluate vendor switch: ${vendorName} — score declined ${decline.toFixed(0)} points`,
                titleAr: `\u062a\u0642\u064a\u064a\u0645 \u062a\u063a\u064a\u064a\u0631 \u0627\u0644\u0645\u0648\u0631\u062f: ${scores[0].vendorNameAr || vendorName} \u2014 \u0627\u0646\u062e\u0641\u0636 ${decline.toFixed(0)} \u0646\u0642\u0637\u0629`,
                confidenceScore: confidence,
                riskScore: decline > 25 ? 85 : 65,
                impactScore: 60,
                aiReasoning: `Vendor ${vendorName} scorecard shows decline of ${decline.toFixed(0)} points (${previousScore} → ${latestScore}). Trend-based prediction indicates deteriorating vendor performance. Confidence: ${confidence}%.`,
                aiReasoningAr: `\u0628\u0637\u0627\u0642\u0629 \u0627\u0644\u0645\u0648\u0631\u062f ${vendorName} \u062a\u0638\u0647\u0631 \u0627\u0646\u062e\u0641\u0627\u0636 ${decline.toFixed(0)} \u0646\u0642\u0637\u0629 (${previousScore} \u2192 ${latestScore}). \u0627\u0644\u062a\u0648\u0642\u0639 \u0627\u0644\u0642\u0627\u0626\u0645 \u0639\u0644\u0649 \u0627\u0644\u0627\u062a\u062c\u0627\u0647 \u064a\u0634\u064a\u0631 \u0625\u0644\u0649 \u062a\u062f\u0647\u0648\u0631 \u0623\u062f\u0627\u0621 \u0627\u0644\u0645\u0648\u0631\u062f. \u0627\u0644\u062b\u0642\u0629: ${confidence}%.`,
                sourceSignals: [signal.id],
              },
              now, decisionSeq, year,
            );
            if (decision) model.decisionsGenerated++;
          }
        }
      }

      predictions.push(model);
    } catch {
      predictions.push({
        model: 'VENDOR_DECLINE_PREDICTION',
        modelAr: '\u062a\u0648\u0642\u0639 \u062a\u0631\u0627\u062c\u0639 \u0627\u0644\u0645\u0648\u0631\u062f',
        horizon: 'trend-based',
        findings: 0, signalsGenerated: 0, decisionsGenerated: 0, highestConfidence: 0, details: [],
      });
    }

    // -----------------------------------------------------------------------
    // 6. DEMAND_SURGE_PREDICTION (7-day horizon)
    // -----------------------------------------------------------------------
    try {
      const model: ModelResult = {
        model: 'DEMAND_SURGE_PREDICTION',
        modelAr: '\u062a\u0648\u0642\u0639 \u0627\u0631\u062a\u0641\u0627\u0639 \u0627\u0644\u0637\u0644\u0628',
        horizon: '7 days',
        findings: 0,
        signalsGenerated: 0,
        decisionsGenerated: 0,
        highestConfidence: 0,
        details: [],
      };

      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const dispenseRequests: any[] = await (prisma as any).imdadDispenseRequest
        ?.findMany?.({
          where: {
            tenantId,
            ...(organizationId !== 'SYSTEM' ? { organizationId } : {}),
            createdAt: { gte: thirtyDaysAgo },
          },
          take: 5000,
        })
        ?.catch?.(() => []) ?? [];

      // Group by item, compute 7-day vs 30-day avg
      const itemDemandMap = new Map<string, { last7: number; last30: number; itemName: string; itemNameAr: string; departmentId: string | null }>();

      for (const dr of dispenseRequests) {
        const itemId = dr.itemId || dr.id;
        if (!itemDemandMap.has(itemId)) {
          itemDemandMap.set(itemId, {
            last7: 0,
            last30: 0,
            itemName: dr.itemName || itemId,
            itemNameAr: dr.itemNameAr || dr.itemName || itemId,
            departmentId: dr.departmentId || null,
          });
        }
        const entry = itemDemandMap.get(itemId)!;
        const qty = dr.quantity ?? dr.requestedQuantity ?? 1;
        entry.last30 += qty;

        const createdAt = dr.createdAt ? new Date(dr.createdAt) : null;
        if (createdAt && createdAt >= sevenDaysAgo) {
          entry.last7 += qty;
        }
      }

      for (const [itemId, entry] of itemDemandMap.entries()) {
        const avg7 = entry.last7 / 7;
        const avg30 = entry.last30 / 30;

        if (avg30 <= 0) continue;
        const surgeRatio = avg7 / avg30;

        if (surgeRatio > 1.3) {
          const surgePercent = (surgeRatio - 1) * 100;
          const confidence = Math.min(90, Math.round(50 + surgePercent * 2));
          model.findings++;
          model.highestConfidence = Math.max(model.highestConfidence, confidence);

          model.details.push({
            entity: entry.itemName,
            metric: `7-day avg ${avg7.toFixed(1)} vs 30-day avg ${avg30.toFixed(1)} (+${surgePercent.toFixed(0)}% surge)`,
            predictedDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            confidence,
          });

          const signal = await createSignalIfNotDuplicate(
            tenantId, organizationId, userId,
            {
              signalType: 'DEMAND_SURGE',
              severity: surgePercent > 80 ? 'CRITICAL' : surgePercent > 50 ? 'HIGH' : 'MEDIUM',
              title: `Demand surge: ${entry.itemName} (+${surgePercent.toFixed(0)}% above baseline)`,
              titleAr: `\u0627\u0631\u062a\u0641\u0627\u0639 \u0627\u0644\u0637\u0644\u0628: ${entry.itemNameAr} (+${surgePercent.toFixed(0)}% \u0641\u0648\u0642 \u0627\u0644\u0645\u0639\u062f\u0644)`,
              sourceEntity: 'imdadDispenseRequest',
              sourceEntityId: itemId,
              departmentId: entry.departmentId,
              metricValue: avg7,
              threshold: avg30,
              deviationPct: surgePercent,
            },
            now, duplicateCutoff, signalSeq, year,
          );

          if (signal) {
            model.signalsGenerated++;
            const decision = await createDecision(
              tenantId, organizationId, userId,
              {
                decisionType: 'CAPACITY_EXPANSION',
                title: `Expand capacity: ${entry.itemName} — demand surging ${surgePercent.toFixed(0)}%`,
                titleAr: `\u062a\u0648\u0633\u064a\u0639 \u0627\u0644\u0633\u0639\u0629: ${entry.itemNameAr} \u2014 \u0627\u0631\u062a\u0641\u0627\u0639 \u0627\u0644\u0637\u0644\u0628 ${surgePercent.toFixed(0)}%`,
                confidenceScore: confidence,
                riskScore: surgePercent > 80 ? 85 : 60,
                impactScore: 65,
                aiReasoning: `Demand surge detected for ${entry.itemName}: 7-day daily avg (${avg7.toFixed(1)}) exceeds 30-day daily avg (${avg30.toFixed(1)}) by ${surgePercent.toFixed(0)}%. Sustained surge may cause stockout. Confidence: ${confidence}%.`,
                aiReasoningAr: `\u062a\u0645 \u0627\u0643\u062a\u0634\u0627\u0641 \u0627\u0631\u062a\u0641\u0627\u0639 \u0641\u064a \u0627\u0644\u0637\u0644\u0628 \u0644\u0640 ${entry.itemNameAr}: \u0627\u0644\u0645\u0639\u062f\u0644 \u0627\u0644\u064a\u0648\u0645\u064a 7 \u0623\u064a\u0627\u0645 (${avg7.toFixed(1)}) \u064a\u062a\u062c\u0627\u0648\u0632 \u0627\u0644\u0645\u0639\u062f\u0644 \u0627\u0644\u064a\u0648\u0645\u064a 30 \u064a\u0648\u0645 (${avg30.toFixed(1)}) \u0628\u0646\u0633\u0628\u0629 ${surgePercent.toFixed(0)}%. \u0627\u0644\u0627\u0631\u062a\u0641\u0627\u0639 \u0627\u0644\u0645\u0633\u062a\u0645\u0631 \u0642\u062f \u064a\u0633\u0628\u0628 \u0646\u0641\u0627\u062f \u0627\u0644\u0645\u062e\u0632\u0648\u0646. \u0627\u0644\u062b\u0642\u0629: ${confidence}%.`,
                sourceSignals: [signal.id],
                executionDeadline: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
              },
              now, decisionSeq, year,
            );
            if (decision) model.decisionsGenerated++;
          }
        }
      }

      predictions.push(model);
    } catch {
      predictions.push({
        model: 'DEMAND_SURGE_PREDICTION',
        modelAr: '\u062a\u0648\u0642\u0639 \u0627\u0631\u062a\u0641\u0627\u0639 \u0627\u0644\u0637\u0644\u0628',
        horizon: '7 days',
        findings: 0, signalsGenerated: 0, decisionsGenerated: 0, highestConfidence: 0, details: [],
      });
    }

    // -----------------------------------------------------------------------
    // Summary
    // -----------------------------------------------------------------------
    const totalPredictions = predictions.reduce((s, m) => s + m.findings, 0);
    const totalSignals = predictions.reduce((s, m) => s + m.signalsGenerated, 0);
    const totalDecisions = predictions.reduce((s, m) => s + m.decisionsGenerated, 0);

    const highestRiskModel = predictions.reduce(
      (best, m) => (m.findings > (best?.findings || 0) ? m : best),
      predictions[0],
    );

    const systemOutlook: 'CLEAR' | 'WATCH' | 'WARNING' | 'CRITICAL' =
      totalPredictions === 0 ? 'CLEAR' : totalPredictions < 5 ? 'WATCH' : totalPredictions < 15 ? 'WARNING' : 'CRITICAL';

    return NextResponse.json({
      predictions,
      summary: {
        totalPredictions,
        totalSignals,
        totalDecisions,
        highestRiskModel: highestRiskModel?.model || 'NONE',
        systemOutlook,
      },
      timestamp: now.toISOString(),
    });
  },
  {
    tenantScoped: true,
    platformKey: 'imdad' as any,
    permissionKey: 'imdad.decisions.manage',
  },
);
