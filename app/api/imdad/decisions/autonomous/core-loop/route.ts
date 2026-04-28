import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Signal type → Decision type mapping
// ---------------------------------------------------------------------------
const SIGNAL_DECISION_MAP: Record<string, string> = {
  LIFECYCLE_BREACH: 'DEVICE_REPLACEMENT',
  STOCKOUT_RISK: 'SUPPLY_REORDER',
  EXPIRY_WARNING: 'SUPPLY_REORDER',
  BUDGET_OVERRUN: 'COST_OPTIMIZATION',
  VENDOR_RISK: 'VENDOR_SWITCH',
  COMPLIANCE_GAP: 'COMPLIANCE_ACTION',
  DEMAND_SURGE: 'CAPACITY_EXPANSION',
};

// Severity → base confidence
const SEVERITY_CONFIDENCE: Record<string, number> = {
  CRITICAL: 92,
  HIGH: 78,
  MEDIUM: 55,
  LOW: 30,
};

// Severity → escalation level
const SEVERITY_ESCALATION: Record<string, string> = {
  CRITICAL: 'CORPORATE',
  HIGH: 'HOSPITAL',
  MEDIUM: 'DEPARTMENT',
  LOW: 'NONE',
};

const AUTO_APPROVAL_THRESHOLD = 85;
const DUPLICATE_WINDOW_MS = 24 * 60 * 60 * 1000;
const STALE_EXECUTING_MS = 60 * 60 * 1000; // 1 hour
const DUPLICATE_CLEANUP_MS = 60 * 60 * 1000; // 1 hour

// Escalation ladder for deadline escalation
const ESCALATION_LADDER: Record<string, string> = {
  NONE: 'DEPARTMENT',
  DEPARTMENT: 'HOSPITAL',
  HOSPITAL: 'CORPORATE',
};

// Decision type → action templates
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
  ],
  COMPLIANCE_ACTION: [
    { actionType: 'SCHEDULE_INSPECTION', title: 'Schedule compliance inspection', titleAr: 'جدولة فحص الامتثال' },
  ],
  VENDOR_SWITCH: [
    { actionType: 'VENDOR_EVALUATION', title: 'Evaluate new vendor candidates', titleAr: 'تقييم المرشحين من الموردين الجدد' },
  ],
  CAPACITY_EXPANSION: [
    { actionType: 'PURCHASE_REQUISITION', title: 'Purchase capacity expansion equipment', titleAr: 'شراء معدات توسعة الطاقة' },
  ],
  EMERGENCY_PROCUREMENT: [
    { actionType: 'EMERGENCY_ORDER', title: 'Create emergency procurement order', titleAr: 'إنشاء أمر شراء طارئ' },
  ],
  BUDGET_ALLOCATION: [
    { actionType: 'BUDGET_REALLOCATION', title: 'Execute budget allocation', titleAr: 'تنفيذ تخصيص الميزانية' },
  ],
  RISK_MITIGATION: [
    { actionType: 'SCHEDULE_INSPECTION', title: 'Schedule risk assessment inspection', titleAr: 'جدولة فحص تقييم المخاطر' },
  ],
};

function makeCode(prefix: string, year: number, seq: number): string {
  return `${prefix}-${year}-${String(seq).padStart(6, '0')}`;
}

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
    { actionType: 'SCHEDULE_INSPECTION', title: 'Decision action', titleAr: 'إجراء القرار' },
  ];
}

// ---------------------------------------------------------------------------
// Pressure dimension weights (total = 1.0)
// ---------------------------------------------------------------------------
const PRESSURE_WEIGHTS: Record<string, number> = {
  clinicalLoad: 0.20,
  supplyStrain: 0.25,
  assetRisk: 0.15,
  budgetBurn: 0.10,
  vendorReliability: 0.10,
  procurementVelocity: 0.10,
  qualityExposure: 0.10,
};

// Situation → cluster template
const CLUSTER_TEMPLATES: Record<string, { types: string[]; nameEn: string; nameAr: string }> = {
  SUPPLY_CRISIS: { types: ['SUPPLY_REORDER', 'VENDOR_SWITCH', 'BUDGET_ALLOCATION', 'EMERGENCY_PROCUREMENT'], nameEn: 'Supply Crisis Response', nameAr: 'استجابة أزمة الإمداد' },
  ASSET_CASCADE: { types: ['DEVICE_REPLACEMENT', 'CAPACITY_EXPANSION', 'RISK_MITIGATION', 'BUDGET_ALLOCATION'], nameEn: 'Asset Cascade Failure', nameAr: 'فشل متتالي للأصول' },
  BUDGET_PRESSURE: { types: ['COST_OPTIMIZATION', 'BUDGET_ALLOCATION', 'VENDOR_SWITCH', 'PHASED_INVESTMENT'], nameEn: 'Budget Pressure Response', nameAr: 'استجابة ضغط الميزانية' },
  QUALITY_EMERGENCY: { types: ['SUPPLY_REORDER', 'COMPLIANCE_ACTION', 'RISK_MITIGATION', 'EMERGENCY_PROCUREMENT'], nameEn: 'Quality Emergency', nameAr: 'طوارئ الجودة' },
  VENDOR_COLLAPSE: { types: ['VENDOR_SWITCH', 'SUPPLY_REORDER', 'RISK_MITIGATION', 'COST_OPTIMIZATION'], nameEn: 'Vendor Collapse Mitigation', nameAr: 'تخفيف انهيار المورد' },
};

// ---------------------------------------------------------------------------
// POST /api/imdad/decisions/autonomous/core-loop
// Pressure-driven cycle: OBSERVE → DETECT → PRESSURE → CLUSTER → PREDICT → EXECUTE → SELF-CORRECT → PULSE
// ---------------------------------------------------------------------------
export const POST = withAuthTenant(
  async (req: NextRequest, { tenantId, userId }) => {
    const now = new Date();
    const startedAt = now.toISOString();
    const startMs = Date.now();
    const year = now.getFullYear();
    const organizationId = req.nextUrl.searchParams.get('organizationId')?.trim() || undefined;
    const duplicateCutoff = new Date(now.getTime() - DUPLICATE_WINDOW_MS);
    const ninetyDaysFromNow = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    // =====================================================================
    // PHASE 1: OBSERVE — snapshot current state
    // =====================================================================
    let observeResult = { signals: { critical: 0, high: 0, medium: 0, low: 0 }, decisions: {} as Record<string, number>, pendingActions: 0 };
    try {
      const orgFilter: Record<string, unknown> = { tenantId, isDeleted: false };
      if (organizationId) orgFilter.organizationId = organizationId;

      const [critSig, highSig, medSig, lowSig, pendingAct] = await Promise.all([
        prisma.imdadOperationalSignal.count({ where: { ...orgFilter, severity: 'CRITICAL', resolvedAt: null } }).catch(() => 0),
        prisma.imdadOperationalSignal.count({ where: { ...orgFilter, severity: 'HIGH', resolvedAt: null } }).catch(() => 0),
        prisma.imdadOperationalSignal.count({ where: { ...orgFilter, severity: 'MEDIUM', resolvedAt: null } }).catch(() => 0),
        prisma.imdadOperationalSignal.count({ where: { ...orgFilter, severity: 'LOW', resolvedAt: null } }).catch(() => 0),
        prisma.imdadDecisionAction.count({ where: { ...orgFilter, status: { in: ['PENDING', 'IN_PROGRESS'] } } }).catch(() => 0),
      ]);

      const decisionStatuses = ['GENERATED', 'PENDING_REVIEW', 'AUTO_APPROVED', 'APPROVED', 'EXECUTING', 'COMPLETED', 'REJECTED'];
      const decisionCounts: Record<string, number> = {};
      await Promise.all(
        decisionStatuses.map(async (s) => {
          decisionCounts[s] = await prisma.imdadDecision.count({ where: { ...orgFilter as any, status: s } }).catch(() => 0);
        }),
      );

      observeResult = {
        signals: { critical: critSig, high: highSig, medium: medSig, low: lowSig },
        decisions: decisionCounts,
        pendingActions: pendingAct,
      };
    } catch (_) {
      // observe is non-fatal
    }

    // =====================================================================
    // PHASE 2: DETECT — brain scan for new signals
    // =====================================================================
    interface Finding {
      signalType: string;
      severity: string;
      title: string;
      titleAr: string;
      description: string;
      descriptionAr: string;
      sourceEntity: string;
      sourceEntityId: string;
      departmentId?: string | null;
      metricValue?: number | null;
      threshold?: number | null;
      deviationPct?: number | null;
      relatedAssetIds?: string[];
      relatedItemIds?: string[];
      costImpact?: number | null;
    }

    const findings: Finding[] = [];
    let signalsCreated = 0;
    let duplicatesSkipped = 0;

    try {
      // 2a. Asset lifecycle breaches
      const assets: any[] = await (prisma as any).imdadAsset
        ?.findMany({
          where: {
            tenantId,
            ...(organizationId ? { organizationId } : {}),
            OR: [
              { lifecycleEndDate: { lt: now } },
              { status: 'ACTIVE' },
            ],
          },
          take: 500,
        })
        .catch(() => []) ?? [];

      for (const asset of assets) {
        const endDate = asset.lifecycleEndDate ? new Date(asset.lifecycleEndDate) : null;
        const isExpired = endDate && endDate < now;
        const commissionDate = asset.commissionDate ? new Date(asset.commissionDate) : null;
        const lifeYearsExceeded =
          commissionDate && asset.expectedLifeYears
            ? (now.getTime() - commissionDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000) > asset.expectedLifeYears
            : false;

        if (isExpired || lifeYearsExceeded) {
          findings.push({
            signalType: 'LIFECYCLE_BREACH',
            severity: isExpired ? 'CRITICAL' : 'HIGH',
            title: `Asset lifecycle breach: ${asset.name || asset.assetCode}`,
            titleAr: `تجاوز دورة حياة الأصل: ${asset.nameAr || asset.assetCode}`,
            description: isExpired
              ? `Asset ${asset.assetCode} has passed its lifecycle end date (${endDate?.toISOString().split('T')[0]})`
              : `Asset ${asset.assetCode} has exceeded expected life of ${asset.expectedLifeYears} years`,
            descriptionAr: isExpired
              ? `الأصل ${asset.assetCode} تجاوز تاريخ نهاية دورة الحياة (${endDate?.toISOString().split('T')[0]})`
              : `الأصل ${asset.assetCode} تجاوز العمر المتوقع ${asset.expectedLifeYears} سنة`,
            sourceEntity: 'imdadAsset',
            sourceEntityId: asset.id,
            departmentId: asset.departmentId || null,
            relatedAssetIds: [asset.id],
          });
        }
      }

      // 2b. Inventory stockout risks
      const stockoutItems: any[] = await (prisma as any).imdadItemLocation
        ?.findMany({
          where: {
            tenantId,
            ...(organizationId ? { organizationId } : {}),
          },
          take: 500,
        })
        .catch(() => []) ?? [];

      for (const item of stockoutItems) {
        const stock = item.currentStock ?? 0;
        const reorder = item.reorderPoint ?? item.minStock ?? 0;
        if (reorder <= 0 || stock > reorder) continue;

        const severity = stock === 0 ? 'CRITICAL' : stock <= reorder * 0.5 ? 'HIGH' : 'MEDIUM';
        findings.push({
          signalType: 'STOCKOUT_RISK',
          severity,
          title: `Stockout risk: ${item.itemName || item.itemId}`,
          titleAr: `خطر نفاد المخزون: ${item.itemNameAr || item.itemName || item.itemId}`,
          description: `Current stock (${stock}) at or below reorder point (${reorder}) at location ${item.locationName || item.locationId || 'unknown'}`,
          descriptionAr: `المخزون الحالي (${stock}) عند أو أقل من نقطة إعادة الطلب (${reorder}) في الموقع ${item.locationNameAr || item.locationName || item.locationId || 'غير محدد'}`,
          sourceEntity: 'imdadItemLocation',
          sourceEntityId: item.id,
          departmentId: item.departmentId || null,
          metricValue: stock,
          threshold: reorder,
          deviationPct: reorder > 0 ? ((reorder - stock) / reorder) * 100 : 100,
          relatedItemIds: [item.itemId || item.id],
        });
      }

      // 2c. Batch expiry warnings (within 90 days)
      const expiringBatches: any[] = await (prisma as any).imdadBatchLot
        ?.findMany({
          where: {
            tenantId,
            ...(organizationId ? { organizationId } : {}),
            expiryDate: { lte: ninetyDaysFromNow, gte: now },
            currentQuantity: { gt: 0 },
          },
          take: 500,
        })
        .catch(() => []) ?? [];

      for (const batch of expiringBatches) {
        const expiryDate = new Date(batch.expiryDate);
        const daysLeft = Math.ceil((expiryDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
        const severity = daysLeft <= 7 ? 'CRITICAL' : daysLeft <= 30 ? 'HIGH' : 'MEDIUM';

        findings.push({
          signalType: 'EXPIRY_WARNING',
          severity,
          title: `Expiry warning: Batch ${batch.batchNumber || batch.lotNumber} (${daysLeft} days)`,
          titleAr: `تحذير انتهاء الصلاحية: دفعة ${batch.batchNumber || batch.lotNumber} (${daysLeft} يوم)`,
          description: `Batch ${batch.batchNumber || batch.lotNumber} expires on ${expiryDate.toISOString().split('T')[0]} with ${batch.currentQuantity} units remaining`,
          descriptionAr: `الدفعة ${batch.batchNumber || batch.lotNumber} تنتهي صلاحيتها في ${expiryDate.toISOString().split('T')[0]} مع ${batch.currentQuantity} وحدة متبقية`,
          sourceEntity: 'imdadBatchLot',
          sourceEntityId: batch.id,
          departmentId: batch.departmentId || null,
          metricValue: daysLeft,
          threshold: 90,
          relatedItemIds: [batch.itemId || batch.id],
        });
      }

      // 2d. Budget overruns (>80% consumed)
      const budgets: any[] = await (prisma as any).imdadBudget
        ?.findMany({
          where: {
            tenantId,
            ...(organizationId ? { organizationId } : {}),
            status: { in: ['ACTIVE', 'APPROVED'] },
          },
          take: 200,
        })
        .catch(() => []) ?? [];

      for (const budget of budgets) {
        const allocated = budget.allocatedAmount ?? budget.totalAmount ?? 0;
        const consumed = budget.consumedAmount ?? budget.usedAmount ?? 0;
        if (allocated <= 0) continue;

        const utilizationPct = (consumed / allocated) * 100;
        if (utilizationPct < 80) continue;

        const severity = utilizationPct >= 100 ? 'CRITICAL' : utilizationPct >= 95 ? 'HIGH' : 'MEDIUM';
        findings.push({
          signalType: 'BUDGET_OVERRUN',
          severity,
          title: `Budget overrun: ${budget.name || budget.budgetCode} (${utilizationPct.toFixed(1)}%)`,
          titleAr: `تجاوز الميزانية: ${budget.nameAr || budget.name || budget.budgetCode} (${utilizationPct.toFixed(1)}%)`,
          description: `Budget ${budget.budgetCode || budget.id} consumed ${consumed.toLocaleString()} of ${allocated.toLocaleString()} allocated (${utilizationPct.toFixed(1)}%)`,
          descriptionAr: `الميزانية ${budget.budgetCode || budget.id} استهلكت ${consumed.toLocaleString()} من ${allocated.toLocaleString()} المخصصة (${utilizationPct.toFixed(1)}%)`,
          sourceEntity: 'imdadBudget',
          sourceEntityId: budget.id,
          departmentId: budget.departmentId || null,
          metricValue: utilizationPct,
          threshold: 80,
          deviationPct: utilizationPct - 80,
          costImpact: consumed > allocated ? consumed - allocated : null,
        });
      }

      // Deduplicate findings and persist signals
      const signalBaseCount = await prisma.imdadOperationalSignal.count({ where: { tenantId } });
      let signalSeq = signalBaseCount;

      for (const finding of findings) {
        const existingSignal = await prisma.imdadOperationalSignal.findFirst({
          where: {
            tenantId,
            signalType: finding.signalType as any,
            sourceEntity: finding.sourceEntity,
            sourceEntityId: finding.sourceEntityId,
            createdAt: { gte: duplicateCutoff },
          },
        });

        if (existingSignal) {
          duplicatesSkipped++;
          continue;
        }

        signalSeq++;
        const signalCode = makeCode('SIG', year, signalSeq);

        await prisma.imdadOperationalSignal.create({
          data: {
            tenantId,
            signalCode,
            organizationId: organizationId || 'SYSTEM',
            signalType: finding.signalType as any,
            severity: finding.severity as any,
            title: finding.title,
            titleAr: finding.titleAr,
            description: finding.description,
            descriptionAr: finding.descriptionAr,
            sourceEntity: finding.sourceEntity,
            sourceEntityId: finding.sourceEntityId,
            departmentId: finding.departmentId || null,
            metricValue: finding.metricValue ?? null,
            threshold: finding.threshold ?? null,
            deviationPct: finding.deviationPct ?? null,
            acknowledged: false,
            createdAt: now,
            updatedAt: now,
          },
        });

        signalsCreated++;
      }
    } catch (_) {
      // detect is non-fatal
    }

    // =====================================================================
    // PHASE 3: DECIDE — create decisions for new signals
    // =====================================================================
    let decisionsCreated = 0;
    let autoApprovedCount = 0;

    try {
      // Find signals created in this cycle that do not yet have a paired decision
      const newSignals = await prisma.imdadOperationalSignal.findMany({
        where: {
          tenantId,
          createdAt: { gte: now },
          ...(organizationId ? { organizationId } : {}),
        },
        take: 500,
      });

      const decisionBaseCount = await prisma.imdadDecision.count({ where: { tenantId } });
      let decisionSeq = decisionBaseCount;

      for (const signal of newSignals) {
        // Check if a decision already references this signal
        const existingDecision = await prisma.imdadDecision.findFirst({
          where: {
            tenantId,
            sourceSignals: { has: signal.id },
          } as any,
        }).catch(() => null);

        if (existingDecision) continue;

        decisionSeq++;
        const decisionCode = makeCode('DEC', year, decisionSeq);
        const decisionType = SIGNAL_DECISION_MAP[signal.signalType as string] || 'RISK_MITIGATION';
        const confidenceScore = SEVERITY_CONFIDENCE[signal.severity as string] ?? 55;
        const autoApproved = confidenceScore >= AUTO_APPROVAL_THRESHOLD;
        const status = autoApproved ? 'AUTO_APPROVED' : 'GENERATED';

        if (autoApproved) autoApprovedCount++;

        const executionDeadline =
          signal.severity === 'CRITICAL'
            ? new Date(now.getTime() + 24 * 60 * 60 * 1000)
            : signal.severity === 'HIGH'
              ? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
              : null;

        await prisma.imdadDecision.create({
          data: {
            tenantId,
            decisionCode,
            organizationId: (signal as any).organizationId || 'SYSTEM',
            decisionType: decisionType as any,
            title: `Auto: ${signal.title}`,
            titleAr: `تلقائي: ${signal.titleAr}`,
            description: `Core-loop auto-decision from signal ${signal.signalCode}: ${signal.description}`,
            descriptionAr: `قرار تلقائي من الحلقة الأساسية - إشارة ${signal.signalCode}: ${signal.descriptionAr}`,
            confidenceScore,
            riskScore: signal.severity === 'CRITICAL' ? 95 : signal.severity === 'HIGH' ? 75 : 50,
            impactScore: signal.severity === 'CRITICAL' ? 90 : signal.severity === 'HIGH' ? 65 : 40,
            costImpact: (signal as any).costImpact ?? null,
            escalationLevel: SEVERITY_ESCALATION[signal.severity as string] || 'NONE' as any,
            sourceSignals: [signal.id],
            recommendedActions: [],
            alternativeOptions: [],
            aiReasoning: `Core-loop detected ${signal.signalType} (${signal.severity}) on ${signal.sourceEntity}:${signal.sourceEntityId}. Decision type: ${decisionType}. Confidence: ${confidenceScore}%.`,
            aiReasoningAr: `الحلقة الأساسية اكتشفت ${signal.signalType} (${signal.severity}) على ${signal.sourceEntity}:${signal.sourceEntityId}. نوع القرار: ${decisionType}. الثقة: ${confidenceScore}%.`,
            departmentId: (signal as any).departmentId || null,
            relatedAssetIds: [],
            relatedItemIds: [],
            autoApprovalThreshold: AUTO_APPROVAL_THRESHOLD,
            autoApproved,
            status,
            executionDeadline,
            createdBy: userId,
            createdAt: now,
            updatedAt: now,
          },
        });

        decisionsCreated++;
      }
    } catch (_) {
      // decide is non-fatal
    }

    // =====================================================================
    // PHASE 4: PRESSURE — compute multi-dimensional operational pressure
    // =====================================================================
    interface PressureDimension { value: number; severity: string; drivers: string[] }
    const pressureDimensions: Record<string, PressureDimension> = {};
    let compositePressure = 0;
    let pressureState = 'STABLE';

    try {
      const orgInv = organizationId ? { organizationId } : {};

      // 4a. Clinical Load
      const clinicalCount = await (prisma as any).imdadDispenseRequest?.count?.({
        where: { tenantId, ...orgInv, createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) } },
      }).catch(() => 0) ?? 0;
      const clinP = Math.min(100, clinicalCount * 2);
      pressureDimensions.clinicalLoad = {
        value: clinP,
        severity: clinicalCount > 50 ? 'CRITICAL' : clinicalCount > 30 ? 'HIGH' : clinicalCount > 15 ? 'MEDIUM' : 'LOW',
        drivers: clinicalCount > 0 ? [`${clinicalCount} dispense requests in 24h`] : [],
      };

      // 4b. Supply Strain
      const allLocations: any[] = await (prisma as any).imdadItemLocation?.findMany?.({
        where: { tenantId, ...orgInv },
        take: 1000,
      }).catch(() => []) ?? [];
      const stockoutLocs = allLocations.filter((l: any) => {
        const s = l.currentStock ?? 0;
        const r = l.reorderPoint ?? l.minStock ?? 0;
        return r > 0 && s <= r;
      });
      const supP = allLocations.length > 0 ? Math.min(100, (stockoutLocs.length / allLocations.length) * 100) : 0;
      pressureDimensions.supplyStrain = {
        value: supP,
        severity: supP > 40 ? 'CRITICAL' : supP > 20 ? 'HIGH' : supP > 10 ? 'MEDIUM' : 'LOW',
        drivers: stockoutLocs.length > 0 ? [`${stockoutLocs.length}/${allLocations.length} locations at/below reorder`] : [],
      };

      // 4c. Asset Risk
      const totalAssetCount = await (prisma as any).imdadAsset?.count?.({ where: { tenantId, ...orgInv, isDeleted: false } }).catch(() => 0) ?? 0;
      const atRiskAssets = await (prisma as any).imdadAsset?.count?.({
        where: { tenantId, ...orgInv, isDeleted: false, status: { in: ['OUT_OF_SERVICE', 'UNDER_MAINTENANCE', 'CALIBRATION_DUE', 'CONDEMNED'] } },
      }).catch(() => 0) ?? 0;
      const assP = totalAssetCount > 0 ? Math.min(100, (atRiskAssets / totalAssetCount) * 100) : 0;
      pressureDimensions.assetRisk = {
        value: assP,
        severity: assP > 30 ? 'CRITICAL' : assP > 15 ? 'HIGH' : assP > 5 ? 'MEDIUM' : 'LOW',
        drivers: atRiskAssets > 0 ? [`${atRiskAssets}/${totalAssetCount} assets at risk`] : [],
      };

      // 4d. Budget Burn
      const allBudgets: any[] = await (prisma as any).imdadBudget?.findMany?.({
        where: { tenantId, ...orgInv },
        take: 200,
      }).catch(() => []) ?? [];
      let avgBurn = 0;
      if (allBudgets.length > 0) {
        const burns = allBudgets.map((b: any) => {
          const a = Number(b.allocatedAmount ?? b.totalAmount ?? 0);
          const c = Number(b.consumedAmount ?? b.usedAmount ?? 0);
          return a > 0 ? (c / a) * 100 : 0;
        });
        avgBurn = burns.reduce((s: number, v: number) => s + v, 0) / burns.length;
      }
      const budP = Math.min(100, avgBurn);
      pressureDimensions.budgetBurn = {
        value: budP,
        severity: avgBurn > 95 ? 'CRITICAL' : avgBurn > 80 ? 'HIGH' : avgBurn > 60 ? 'MEDIUM' : 'LOW',
        drivers: avgBurn > 60 ? [`Average burn rate: ${avgBurn.toFixed(1)}%`] : [],
      };

      // 4e. Vendor Reliability
      const scorecards: any[] = await (prisma as any).imdadVendorScorecard?.findMany?.({
        where: { tenantId, ...orgInv },
        take: 200,
      }).catch(() => []) ?? [];
      let avgVScore = 100;
      if (scorecards.length > 0) {
        avgVScore = scorecards.reduce((s: number, v: any) => s + Number(v.overallScore ?? v.score ?? 80), 0) / scorecards.length;
      }
      const venP = Math.min(100, Math.max(0, 100 - avgVScore));
      pressureDimensions.vendorReliability = {
        value: venP,
        severity: avgVScore < 40 ? 'CRITICAL' : avgVScore < 60 ? 'HIGH' : avgVScore < 75 ? 'MEDIUM' : 'LOW',
        drivers: avgVScore < 75 ? [`Average vendor score: ${avgVScore.toFixed(1)}`] : [],
      };

      // 4f. Procurement Velocity
      const pendingPOs = await (prisma as any).imdadPurchaseOrder?.count?.({
        where: { tenantId, ...orgInv, status: { in: ['PENDING', 'DRAFT'] }, createdAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) } },
      }).catch(() => 0) ?? 0;
      const proP = Math.min(100, pendingPOs * 5);
      pressureDimensions.procurementVelocity = {
        value: proP,
        severity: pendingPOs > 20 ? 'CRITICAL' : pendingPOs > 10 ? 'HIGH' : pendingPOs > 5 ? 'MEDIUM' : 'LOW',
        drivers: pendingPOs > 0 ? [`${pendingPOs} pending POs in 7 days`] : [],
      };

      // 4g. Quality Exposure
      const expiringBatchCount = await (prisma as any).imdadBatchLot?.count?.({
        where: { tenantId, ...orgInv, expiryDate: { lte: ninetyDaysFromNow, gte: now }, status: 'ACTIVE' },
      }).catch(() => 0) ?? 0;
      const qualP = Math.min(100, expiringBatchCount * 4);
      pressureDimensions.qualityExposure = {
        value: qualP,
        severity: expiringBatchCount > 30 ? 'CRITICAL' : expiringBatchCount > 15 ? 'HIGH' : expiringBatchCount > 5 ? 'MEDIUM' : 'LOW',
        drivers: expiringBatchCount > 0 ? [`${expiringBatchCount} batches expiring within 90 days`] : [],
      };

      // Composite pressure (weighted)
      compositePressure = Object.entries(PRESSURE_WEIGHTS).reduce((sum, [key, weight]) => {
        return sum + (pressureDimensions[key]?.value ?? 0) * weight;
      }, 0);

      pressureState = compositePressure < 30 ? 'STABLE' : compositePressure < 60 ? 'ELEVATED' : compositePressure < 80 ? 'HIGH_PRESSURE' : 'CRITICAL_PRESSURE';
    } catch (_) {
      // pressure is non-fatal
    }

    // =====================================================================
    // PHASE 5: CLUSTER — generate coordinated decision clusters from situations
    // =====================================================================
    let clustersGenerated = 0;
    let clusterDecisions = 0;
    const detectedSituations: string[] = [];

    try {
      const orgInv = organizationId ? { organizationId } : {};
      const clusterDecisionBase = await prisma.imdadDecision.count({ where: { tenantId } });
      let clusterSeq = clusterDecisionBase + decisionsCreated;
      let clusterNum = 0;

      // Detect situations from pressure dimensions
      const situations: { type: string; trigger: string }[] = [];

      if ((pressureDimensions.supplyStrain?.value ?? 0) > 40) {
        situations.push({ type: 'SUPPLY_CRISIS', trigger: 'supplyStrain' });
      }
      if ((pressureDimensions.assetRisk?.value ?? 0) > 30) {
        situations.push({ type: 'ASSET_CASCADE', trigger: 'assetRisk' });
      }
      if ((pressureDimensions.budgetBurn?.value ?? 0) > 85) {
        situations.push({ type: 'BUDGET_PRESSURE', trigger: 'budgetBurn' });
      }
      if ((pressureDimensions.qualityExposure?.value ?? 0) > 50) {
        situations.push({ type: 'QUALITY_EMERGENCY', trigger: 'qualityExposure' });
      }
      if ((pressureDimensions.vendorReliability?.value ?? 0) > 60) {
        situations.push({ type: 'VENDOR_COLLAPSE', trigger: 'vendorReliability' });
      }

      for (const sit of situations) {
        const template = CLUSTER_TEMPLATES[sit.type];
        if (!template) continue;

        clusterNum++;
        const clusterId = `CLU-${year}-${String(clusterNum).padStart(6, '0')}`;
        const decisionIds: string[] = [];
        detectedSituations.push(sit.type);

        for (let i = 0; i < template.types.length; i++) {
          clusterSeq++;
          const decCode = makeCode('DCS', year, clusterSeq);
          const decType = template.types[i];
          const confidence = Math.min(95, compositePressure + 10);
          const autoApp = confidence >= AUTO_APPROVAL_THRESHOLD;
          const severity = compositePressure >= 80 ? 'CRITICAL' : compositePressure >= 60 ? 'HIGH' : 'MEDIUM';

          const decision = await prisma.imdadDecision.create({
            data: {
              tenantId,
              decisionCode: decCode,
              organizationId: organizationId || 'SYSTEM',
              decisionType: decType as any,
              title: `${template.nameEn} [${i + 1}/${template.types.length}]: ${decType.replace(/_/g, ' ')}`,
              titleAr: `${template.nameAr} [${i + 1}/${template.types.length}]: ${decType.replace(/_/g, ' ')}`,
              confidenceScore: confidence,
              riskScore: compositePressure,
              impactScore: Math.min(95, compositePressure + 5),
              escalationLevel: SEVERITY_ESCALATION[severity] || 'DEPARTMENT' as any,
              sourceSignals: [],
              aiReasoning: `Cluster ${clusterId}: Situation ${sit.type} detected from ${sit.trigger} pressure (${pressureDimensions[sit.trigger]?.value?.toFixed(1)}%). Composite pressure: ${compositePressure.toFixed(1)}%. Coordinated response ${i + 1}/${template.types.length}.`,
              aiReasoningAr: `مجموعة ${clusterId}: الموقف ${sit.type} مكتشف من ضغط ${sit.trigger} (${pressureDimensions[sit.trigger]?.value?.toFixed(1)}%). الضغط المركب: ${compositePressure.toFixed(1)}%. استجابة منسقة ${i + 1}/${template.types.length}.`,
              autoApprovalThreshold: AUTO_APPROVAL_THRESHOLD,
              autoApproved: autoApp,
              status: autoApp ? 'AUTO_APPROVED' : 'GENERATED',
              executionDeadline: new Date(now.getTime() + (i === 0 ? 1 : i <= 2 ? 4 : 24) * 60 * 60 * 1000),
              metadata: { clusterId, clusterType: sit.type, clusterSize: template.types.length, clusterIndex: i },
              createdBy: userId,
              createdAt: now,
              updatedAt: now,
            },
          });

          decisionIds.push(decision.id);
          clusterDecisions++;
        }

        clustersGenerated++;
      }
    } catch (_) {
      // cluster is non-fatal
    }

    // =====================================================================
    // PHASE 6: PREDICT — simulate near-future and create proactive decisions
    // =====================================================================
    let predictionsGenerated = 0;
    let proactiveSignals = 0;
    let proactiveDecisions = 0;
    let systemOutlook = 'CLEAR';

    try {
      const orgInv = organizationId ? { organizationId } : {};
      const predCutoff = new Date(now.getTime() - 12 * 60 * 60 * 1000); // 12h dedup
      const predDecBase = await prisma.imdadDecision.count({ where: { tenantId } });
      let predDecSeq = predDecBase + decisionsCreated + clusterDecisions;
      const predSigBase = await prisma.imdadOperationalSignal.count({ where: { tenantId } });
      let predSigSeq = predSigBase + signalsCreated;

      // 6a. Asset failure prediction — overdue maintenance
      const overdueAssets: any[] = await (prisma as any).imdadAsset?.findMany?.({
        where: {
          tenantId,
          ...orgInv,
          isDeleted: false,
          nextMaintenanceDate: { lt: now },
          status: 'IN_SERVICE',
        },
        take: 100,
      }).catch(() => []) ?? [];

      for (const asset of overdueAssets) {
        const daysOverdue = Math.ceil((now.getTime() - new Date(asset.nextMaintenanceDate).getTime()) / (24 * 60 * 60 * 1000));
        if (daysOverdue < 1) continue;

        // Check dedup
        const exists = await prisma.imdadOperationalSignal.findFirst({
          where: { tenantId, signalType: 'COMPLIANCE_GAP', sourceEntity: 'imdadAsset', sourceEntityId: asset.id, createdAt: { gte: predCutoff } },
        }).catch(() => null);
        if (exists) continue;

        predSigSeq++;
        const confidence = Math.min(90, 50 + daysOverdue * 2);

        await prisma.imdadOperationalSignal.create({
          data: {
            tenantId,
            organizationId: organizationId || asset.organizationId || 'SYSTEM',
            signalCode: makeCode('PSG', year, predSigSeq),
            signalType: 'COMPLIANCE_GAP',
            severity: daysOverdue > 30 ? 'CRITICAL' : daysOverdue > 14 ? 'HIGH' : 'MEDIUM',
            title: `Predicted failure: ${asset.assetName || asset.assetTag} (${daysOverdue}d overdue)`,
            titleAr: `فشل متوقع: ${asset.assetNameAr || asset.assetName || asset.assetTag} (${daysOverdue} يوم متأخر)`,
            sourceEntity: 'imdadAsset',
            sourceEntityId: asset.id,
            metricValue: daysOverdue,
            threshold: 0,
            createdAt: now,
            updatedAt: now,
          },
        });
        proactiveSignals++;

        if (confidence >= AUTO_APPROVAL_THRESHOLD) {
          predDecSeq++;
          await prisma.imdadDecision.create({
            data: {
              tenantId,
              organizationId: organizationId || asset.organizationId || 'SYSTEM',
              decisionCode: makeCode('PRD', year, predDecSeq),
              decisionType: 'DEVICE_REPLACEMENT',
              title: `Proactive: Maintenance overdue ${asset.assetName || asset.assetTag}`,
              titleAr: `استباقي: صيانة متأخرة ${asset.assetNameAr || asset.assetName || asset.assetTag}`,
              confidenceScore: confidence,
              riskScore: Math.min(95, 40 + daysOverdue),
              autoApproved: true,
              status: 'AUTO_APPROVED',
              autoApprovalThreshold: AUTO_APPROVAL_THRESHOLD,
              escalationLevel: daysOverdue > 30 ? 'CORPORATE' : 'HOSPITAL',
              aiReasoning: `Predictive: Asset ${asset.assetTag} maintenance overdue by ${daysOverdue} days. High failure probability.`,
              aiReasoningAr: `تنبؤي: الأصل ${asset.assetTag} صيانته متأخرة بمقدار ${daysOverdue} يوم. احتمال فشل مرتفع.`,
              metadata: { predictionModel: 'ASSET_FAILURE', daysOverdue },
              sourceSignals: [],
              relatedAssetIds: [asset.id],
              createdBy: userId,
              createdAt: now,
              updatedAt: now,
            },
          });
          proactiveDecisions++;
        }

        predictionsGenerated++;
      }

      // 6b. Budget exhaustion prediction
      const predBudgets: any[] = await (prisma as any).imdadBudget?.findMany?.({ where: { tenantId, ...orgInv }, take: 50 }).catch(() => []) ?? [];
      for (const budget of predBudgets) {
        const allocated = Number(budget.allocatedAmount ?? budget.totalAmount ?? 0);
        const consumed = Number(budget.consumedAmount ?? budget.usedAmount ?? 0);
        if (allocated <= 0) continue;
        const startDate = budget.startDate ? new Date(budget.startDate) : budget.createdAt ? new Date(budget.createdAt) : now;
        const daysElapsed = Math.max(1, (now.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
        const dailyBurn = consumed / daysElapsed;
        if (dailyBurn <= 0) continue;
        const daysUntilExhausted = Math.floor((allocated - consumed) / dailyBurn);
        if (daysUntilExhausted > 30 || daysUntilExhausted < 0) continue;

        predictionsGenerated++;
      }

      systemOutlook = predictionsGenerated === 0 ? 'CLEAR' : predictionsGenerated < 5 ? 'WATCH' : predictionsGenerated < 15 ? 'WARNING' : 'CRITICAL';
    } catch (_) {
      // predict is non-fatal
    }

    // =====================================================================
    // PHASE 7: EXECUTE — execute approved decisions (including cluster & predictive)
    // =====================================================================
    let decisionsExecuted = 0;
    let actionsCreated = 0;

    try {
      const executableDecisions = await prisma.imdadDecision.findMany({
        where: {
          tenantId,
          status: { in: ['AUTO_APPROVED', 'APPROVED'] },
          executedAt: null,
          isDeleted: false,
        },
        orderBy: { createdAt: 'asc' },
        take: 50,
      });

      const actionBaseCount = await prisma.imdadDecisionAction.count({ where: { tenantId } });
      let actionSeq = actionBaseCount;

      for (const decision of executableDecisions) {
        const decisionType = decision.decisionType as string;
        const riskScore = Number(decision.riskScore ?? 0);
        const actions = resolveActions(decisionType, riskScore);

        for (let i = 0; i < actions.length; i++) {
          const action = actions[i];
          actionSeq++;
          const actionCode = makeCode('ACT', year, actionSeq);

          await prisma.imdadDecisionAction.create({
            data: {
              tenantId,
              organizationId: decision.organizationId,
              decisionId: decision.id,
              actionCode,
              actionType: action.actionType as any,
              sequenceOrder: i + 1,
              title: action.title,
              titleAr: action.titleAr,
              status: 'COMPLETED',
              completedAt: now,
              createdAt: now,
              updatedAt: now,
            },
          });

          actionsCreated++;
        }

        await prisma.imdadDecision.update({
          where: { id: decision.id },
          data: {
            status: 'COMPLETED',
            executedAt: now,
            executedBy: userId,
            updatedAt: now,
          },
        });

        decisionsExecuted++;
      }
    } catch (_) {
      // execute is non-fatal
    }

    // =====================================================================
    // PHASE 8: SELF-CORRECT — fix stale states and escalate deadlines
    // =====================================================================
    let staleReset = 0;
    let deadlinesEscalated = 0;
    let duplicatesCleaned = 0;

    try {
      // 5a. Reset decisions stuck in EXECUTING for > 1 hour
      const staleCutoff = new Date(now.getTime() - STALE_EXECUTING_MS);
      const staleDecisions = await prisma.imdadDecision.findMany({
        where: {
          tenantId,
          status: 'EXECUTING',
          updatedAt: { lt: staleCutoff },
          isDeleted: false,
        },
      });

      for (const decision of staleDecisions) {
        await prisma.imdadDecision.update({
          where: { id: decision.id },
          data: { status: 'AUTO_APPROVED', updatedAt: now },
        });
        staleReset++;
      }

      // 5b. Escalate decisions past executionDeadline
      const overdueDecisions = await prisma.imdadDecision.findMany({
        where: {
          tenantId,
          executionDeadline: { lt: now },
          status: { in: ['GENERATED', 'PENDING_REVIEW', 'AUTO_APPROVED', 'APPROVED'] },
          isDeleted: false,
        },
      });

      for (const decision of overdueDecisions) {
        const currentLevel = (decision.escalationLevel as string) || 'NONE';
        const nextLevel = ESCALATION_LADDER[currentLevel];
        if (nextLevel && nextLevel !== currentLevel) {
          await prisma.imdadDecision.update({
            where: { id: decision.id },
            data: {
              escalationLevel: nextLevel as any,
              updatedAt: now,
            },
          });
          deadlinesEscalated++;
        }
      }

      // 5c. Clean duplicate signals (same source within 1 hour, resolve older ones)
      const dupCutoff = new Date(now.getTime() - DUPLICATE_CLEANUP_MS);
      const recentSignals = await prisma.imdadOperationalSignal.findMany({
        where: {
          tenantId,
          createdAt: { gte: dupCutoff },
          resolvedAt: null,
        },
        orderBy: { createdAt: 'desc' },
      });

      const seen = new Map<string, string>(); // key → newest signal id
      for (const sig of recentSignals) {
        const key = `${sig.signalType}:${sig.sourceEntity}:${sig.sourceEntityId}`;
        if (seen.has(key)) {
          // This is an older duplicate — resolve it
          await prisma.imdadOperationalSignal.update({
            where: { id: sig.id },
            data: { resolvedAt: now, updatedAt: now },
          });
          duplicatesCleaned++;
        } else {
          seen.set(key, sig.id);
        }
      }
    } catch (_) {
      // self-correct is non-fatal
    }

    // =====================================================================
    // PHASE 9: PULSE — record system health snapshot
    // =====================================================================
    let healthScore = 100;
    let pressure = 0;
    let trend = 'STABLE';

    try {
      if (organizationId) {
        const orgFilter = { tenantId, organizationId, isDeleted: false };

        const [activeDecisionCount, pendingActionCount, criticalSignalCount, highSignalCount] = await Promise.all([
          prisma.imdadDecision.count({
            where: { ...orgFilter, status: { notIn: ['COMPLETED', 'REJECTED', 'CANCELLED'] as any } },
          }).catch(() => 0),
          prisma.imdadDecisionAction.count({
            where: { ...orgFilter, status: { in: ['PENDING', 'IN_PROGRESS'] } },
          }).catch(() => 0),
          prisma.imdadOperationalSignal.count({
            where: { ...orgFilter, severity: 'CRITICAL', resolvedAt: null },
          }).catch(() => 0),
          prisma.imdadOperationalSignal.count({
            where: { ...orgFilter, severity: 'HIGH', resolvedAt: null },
          }).catch(() => 0),
        ]);

        pressure = compositePressure > 0 ? compositePressure : Math.min(100, criticalSignalCount * 15 + highSignalCount * 8 + activeDecisionCount * 3);
        healthScore = Math.max(0, 100 - pressure);
        trend = compositePressure >= 80 ? 'CRITICAL_DECLINE' : compositePressure >= 60 ? 'DECLINING' : signalsCreated === 0 && compositePressure < 30 ? 'IMPROVING' : 'STABLE';

        await prisma.imdadSystemPulse.create({
          data: {
            tenantId,
            organizationId,
            pulseTimestamp: now,
            activeDecisions: activeDecisionCount,
            pendingActions: pendingActionCount,
            criticalSignals: criticalSignalCount,
            highSignals: highSignalCount,
            overallHealthScore: healthScore,
            operationalPressure: pressure,
            trendDirection: trend,
            aiInsights: {
              cycleType: 'PRESSURE_DRIVEN_CORE_LOOP',
              phases: 9,
              totalFindings: findings.length,
              signalsGenerated: signalsCreated,
              duplicatesSkipped,
              decisionsGenerated: decisionsCreated,
              autoApproved: autoApprovedCount,
              compositePressure: Math.round(compositePressure * 10) / 10,
              pressureState,
              clustersGenerated,
              clusterDecisions,
              detectedSituations,
              predictionsGenerated,
              proactiveSignals,
              proactiveDecisions,
              systemOutlook,
              decisionsExecuted,
              actionsCreated,
              staleReset,
              deadlinesEscalated,
              duplicatesCleaned,
            },
          } as any,
        }).catch(() => null);
      }
    } catch (_) {
      // pulse is non-fatal
    }

    const completedAt = new Date().toISOString();
    const durationMs = Date.now() - startMs;

    return NextResponse.json({
      cycle: {
        startedAt,
        completedAt,
        durationMs,
        phases: 9,
        model: 'PRESSURE_DRIVEN',
      },
      observe: observeResult,
      detect: {
        findings: findings.length,
        signalsCreated,
        duplicatesSkipped,
      },
      decide: {
        decisionsCreated,
        autoApproved: autoApprovedCount,
      },
      pressure: {
        composite: Math.round(compositePressure * 10) / 10,
        state: pressureState,
        dimensions: pressureDimensions,
      },
      cluster: {
        clustersGenerated,
        clusterDecisions,
        detectedSituations,
      },
      predict: {
        predictionsGenerated,
        proactiveSignals,
        proactiveDecisions,
        systemOutlook,
      },
      execute: {
        decisionsExecuted,
        actionsCreated,
      },
      selfCorrect: {
        staleReset,
        deadlinesEscalated,
        duplicatesCleaned,
      },
      pulse: {
        healthScore,
        pressure,
        trend,
      },
    });
  },
  {
    tenantScoped: true,
    platformKey: 'imdad' as any,
    permissionKey: 'imdad.decisions.manage',
  },
);
