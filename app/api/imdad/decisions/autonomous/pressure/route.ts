import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ---------------------------------------------------------------------------
// Pressure dimension weights (must sum to 1.0)
// ---------------------------------------------------------------------------
const WEIGHTS = {
  clinicalLoad: 0.20,
  supplyStrain: 0.25,
  assetRisk: 0.15,
  budgetBurn: 0.10,
  vendorReliability: 0.10,
  procurementVelocity: 0.10,
  qualityExposure: 0.10,
} as const;

// Severity thresholds per dimension
function classifySeverity(value: number, highThreshold: number, criticalThreshold: number): string {
  if (value >= criticalThreshold) return 'CRITICAL';
  if (value >= highThreshold) return 'HIGH';
  if (value >= 40) return 'MEDIUM';
  if (value >= 20) return 'LOW';
  return 'INFO';
}

// System state from composite pressure
function systemState(composite: number): string {
  if (composite >= 80) return 'CRITICAL_PRESSURE';
  if (composite >= 60) return 'HIGH_PRESSURE';
  if (composite >= 30) return 'ELEVATED';
  return 'STABLE';
}

// Duplicate window for pressure signals: 6 hours
const SIGNAL_DUPLICATE_WINDOW_MS = 6 * 60 * 60 * 1000;

// Code generator
function makeCode(prefix: string, year: number, seq: number): string {
  return `${prefix}-${year}-${String(seq).padStart(6, '0')}`;
}

// Decision type mapping per pressure dimension
const DIMENSION_DECISION_MAP: Record<string, string> = {
  supplyStrain: 'SUPPLY_REORDER',
  assetRisk: 'DEVICE_REPLACEMENT',
  budgetBurn: 'COST_OPTIMIZATION',
  vendorReliability: 'VENDOR_SWITCH',
  procurementVelocity: 'EMERGENCY_PROCUREMENT',
};

// Severity escalation mapping
const SEVERITY_ESCALATION: Record<string, string> = {
  CRITICAL: 'CORPORATE',
  HIGH: 'HOSPITAL',
  MEDIUM: 'DEPARTMENT',
  LOW: 'NONE',
  INFO: 'NONE',
};

// ---------------------------------------------------------------------------
// Dimension result type
// ---------------------------------------------------------------------------
interface DimensionResult {
  value: number;
  severity: string;
  drivers: string[];
}

// ---------------------------------------------------------------------------
// POST /api/imdad/decisions/autonomous/pressure
// Computes multi-dimensional operational pressure across 7 domains
// ---------------------------------------------------------------------------
export const POST = withAuthTenant(
  async (req: NextRequest, { tenantId, userId }) => {
    const sp = req.nextUrl.searchParams;
    const organizationId = sp.get('organizationId')?.trim() || undefined;

    const now = new Date();
    const year = now.getFullYear();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const ninetyDaysFromNow = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    const duplicateCutoff = new Date(now.getTime() - SIGNAL_DUPLICATE_WINDOW_MS);

    const orgFilter = organizationId ? { organizationId } : {};

    // -----------------------------------------------------------------------
    // 1. CLINICAL_LOAD — Dispense request volume in last 24h
    // -----------------------------------------------------------------------
    let clinicalLoad: DimensionResult;
    try {
      const dispenseCount = await (prisma as any).imdadDispenseRequest
        ?.count({
          where: {
            tenantId,
            ...orgFilter,
            createdAt: { gte: twentyFourHoursAgo },
          },
        })
        ?.catch?.(() => 0) ?? 0;

      const pressure = Math.min(100, dispenseCount * 2);
      const severity = classifySeverity(pressure, 60, 100);
      const drivers: string[] = [];

      if (dispenseCount > 50) {
        drivers.push(`Critical dispense volume: ${dispenseCount} requests in 24h / \u062D\u062C\u0645 \u0635\u0631\u0641 \u062D\u0631\u062C: ${dispenseCount} \u0637\u0644\u0628 \u0641\u064A 24 \u0633\u0627\u0639\u0629`);
      } else if (dispenseCount > 30) {
        drivers.push(`High dispense volume: ${dispenseCount} requests in 24h / \u062D\u062C\u0645 \u0635\u0631\u0641 \u0645\u0631\u062A\u0641\u0639: ${dispenseCount} \u0637\u0644\u0628 \u0641\u064A 24 \u0633\u0627\u0639\u0629`);
      } else if (dispenseCount > 0) {
        drivers.push(`Normal dispense volume: ${dispenseCount} requests / \u062D\u062C\u0645 \u0635\u0631\u0641 \u0637\u0628\u064A\u0639\u064A: ${dispenseCount} \u0637\u0644\u0628`);
      }

      clinicalLoad = { value: pressure, severity, drivers };
    } catch {
      clinicalLoad = { value: 0, severity: 'INFO', drivers: ['Unable to query clinical load / \u062A\u0639\u0630\u0631 \u0627\u0633\u062A\u0639\u0644\u0627\u0645 \u0627\u0644\u062D\u0645\u0644 \u0627\u0644\u0633\u0631\u064A\u0631\u064A'] };
    }

    // -----------------------------------------------------------------------
    // 2. SUPPLY_STRAIN — Stock below reorder point
    // -----------------------------------------------------------------------
    let supplyStrain: DimensionResult;
    try {
      const allLocations: any[] = await (prisma as any).imdadItemLocation
        ?.findMany?.({
          where: { tenantId, ...orgFilter },
          select: { id: true, currentStock: true, reorderPoint: true, minStock: true, itemName: true },
          take: 2000,
        })
        ?.catch?.(() => []) ?? [];

      const totalLocations = allLocations.length || 1;
      const stockoutItems = allLocations.filter((loc: any) => {
        const stock = loc.currentStock ?? 0;
        const reorder = loc.reorderPoint ?? loc.minStock ?? 0;
        return reorder > 0 && stock <= reorder;
      });
      const stockoutCount = stockoutItems.length;
      const pressure = Math.min(100, (stockoutCount / totalLocations) * 100);
      const severity = classifySeverity(pressure, 20, 40);
      const drivers: string[] = [];

      if (stockoutCount > 0) {
        drivers.push(`${stockoutCount}/${totalLocations} locations at/below reorder point / ${stockoutCount}/${totalLocations} \u0645\u0648\u0642\u0639 \u0639\u0646\u062F/\u062A\u062D\u062A \u0646\u0642\u0637\u0629 \u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u0637\u0644\u0628`);
        const zeroStockCount = stockoutItems.filter((i: any) => (i.currentStock ?? 0) === 0).length;
        if (zeroStockCount > 0) {
          drivers.push(`${zeroStockCount} locations at zero stock / ${zeroStockCount} \u0645\u0648\u0642\u0639 \u0628\u062F\u0648\u0646 \u0645\u062E\u0632\u0648\u0646`);
        }
      }

      supplyStrain = { value: Math.round(pressure * 100) / 100, severity, drivers };
    } catch {
      supplyStrain = { value: 0, severity: 'INFO', drivers: ['Unable to query supply data / \u062A\u0639\u0630\u0631 \u0627\u0633\u062A\u0639\u0644\u0627\u0645 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0625\u0645\u062F\u0627\u062F'] };
    }

    // -----------------------------------------------------------------------
    // 3. ASSET_RISK — Assets out of service / maintenance / condemned
    // -----------------------------------------------------------------------
    let assetRisk: DimensionResult;
    try {
      const riskStatuses = ['OUT_OF_SERVICE', 'UNDER_MAINTENANCE', 'CALIBRATION_DUE', 'CONDEMNED'];
      const [atRiskAssets, totalAssetCount] = await Promise.all([
        (prisma as any).imdadAsset?.findMany?.({
          where: { tenantId, ...orgFilter, status: { in: riskStatuses } },
          select: { id: true, status: true, name: true, assetCode: true },
          take: 2000,
        })?.catch?.(() => []) ?? [],
        (prisma as any).imdadAsset?.count?.({
          where: { tenantId, ...orgFilter },
        })?.catch?.(() => 0) ?? 0,
      ]);

      const totalAssets = totalAssetCount || 1;
      const atRiskCount = atRiskAssets.length;
      const pressure = Math.min(100, (atRiskCount / totalAssets) * 100);
      const severity = classifySeverity(pressure, 15, 30);
      const drivers: string[] = [];

      if (atRiskCount > 0) {
        drivers.push(`${atRiskCount}/${totalAssets} assets at risk / ${atRiskCount}/${totalAssets} \u0623\u0635\u0644 \u0641\u064A \u062E\u0637\u0631`);
        const statusCounts: Record<string, number> = {};
        for (const a of atRiskAssets) {
          statusCounts[a.status] = (statusCounts[a.status] || 0) + 1;
        }
        for (const [status, count] of Object.entries(statusCounts)) {
          drivers.push(`${count} ${status} / ${count} ${status}`);
        }
      }

      assetRisk = { value: Math.round(pressure * 100) / 100, severity, drivers };
    } catch {
      assetRisk = { value: 0, severity: 'INFO', drivers: ['Unable to query asset data / \u062A\u0639\u0630\u0631 \u0627\u0633\u062A\u0639\u0644\u0627\u0645 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0623\u0635\u0648\u0644'] };
    }

    // -----------------------------------------------------------------------
    // 4. BUDGET_BURN — Average budget consumption rate
    // -----------------------------------------------------------------------
    let budgetBurn: DimensionResult;
    try {
      const budgets: any[] = await (prisma as any).imdadBudget
        ?.findMany?.({
          where: { tenantId, ...orgFilter, status: { in: ['ACTIVE', 'APPROVED'] } },
          select: { id: true, allocatedAmount: true, totalAmount: true, consumedAmount: true, usedAmount: true, name: true, budgetCode: true },
          take: 500,
        })
        ?.catch?.(() => []) ?? [];

      let totalBurnRate = 0;
      let budgetCount = 0;
      const overBudgets: string[] = [];

      for (const b of budgets) {
        const allocated = b.allocatedAmount ?? b.totalAmount ?? 0;
        const consumed = b.consumedAmount ?? b.usedAmount ?? 0;
        if (allocated <= 0) continue;
        const rate = (consumed / allocated) * 100;
        totalBurnRate += rate;
        budgetCount++;
        if (rate > 80) {
          overBudgets.push(b.budgetCode || b.name || b.id);
        }
      }

      const avgBurnRate = budgetCount > 0 ? totalBurnRate / budgetCount : 0;
      const pressure = Math.min(100, avgBurnRate);
      const severity = classifySeverity(pressure, 80, 95);
      const drivers: string[] = [];

      if (budgetCount > 0) {
        drivers.push(`Average burn rate: ${avgBurnRate.toFixed(1)}% across ${budgetCount} budgets / \u0645\u0639\u062F\u0644 \u0627\u0644\u0627\u0633\u062A\u0647\u0644\u0627\u0643: ${avgBurnRate.toFixed(1)}% \u0639\u0628\u0631 ${budgetCount} \u0645\u064A\u0632\u0627\u0646\u064A\u0629`);
        if (overBudgets.length > 0) {
          drivers.push(`${overBudgets.length} budgets over 80%: ${overBudgets.slice(0, 5).join(', ')} / ${overBudgets.length} \u0645\u064A\u0632\u0627\u0646\u064A\u0627\u062A \u062A\u062C\u0627\u0648\u0632\u062A 80%`);
        }
      }

      budgetBurn = { value: Math.round(pressure * 100) / 100, severity, drivers };
    } catch {
      budgetBurn = { value: 0, severity: 'INFO', drivers: ['Unable to query budget data / \u062A\u0639\u0630\u0631 \u0627\u0633\u062A\u0639\u0644\u0627\u0645 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u064A\u0632\u0627\u0646\u064A\u0629'] };
    }

    // -----------------------------------------------------------------------
    // 5. VENDOR_RELIABILITY — Average vendor scorecard score
    // -----------------------------------------------------------------------
    let vendorReliability: DimensionResult;
    try {
      const scorecards: any[] = await (prisma as any).imdadVendorScorecard
        ?.findMany?.({
          where: { tenantId, ...orgFilter },
          select: { id: true, overallScore: true, score: true, vendorName: true, vendorId: true },
          take: 500,
        })
        ?.catch?.(() => []) ?? [];

      let totalScore = 0;
      let cardCount = 0;
      const lowVendors: string[] = [];

      for (const sc of scorecards) {
        const score = sc.overallScore ?? sc.score ?? 0;
        totalScore += score;
        cardCount++;
        if (score < 60) {
          lowVendors.push(sc.vendorName || sc.vendorId || sc.id);
        }
      }

      const avgScore = cardCount > 0 ? totalScore / cardCount : 100;
      const pressure = Math.max(0, 100 - avgScore);
      const severity = classifySeverity(pressure, 40, 60);
      const drivers: string[] = [];

      if (cardCount > 0) {
        drivers.push(`Average vendor score: ${avgScore.toFixed(1)}/100 across ${cardCount} scorecards / \u0645\u062A\u0648\u0633\u0637 \u062A\u0642\u064A\u064A\u0645 \u0627\u0644\u0645\u0648\u0631\u062F\u064A\u0646: ${avgScore.toFixed(1)}/100 \u0639\u0628\u0631 ${cardCount} \u0628\u0637\u0627\u0642\u0629`);
        if (lowVendors.length > 0) {
          drivers.push(`${lowVendors.length} vendors below 60: ${lowVendors.slice(0, 5).join(', ')} / ${lowVendors.length} \u0645\u0648\u0631\u062F \u0623\u0642\u0644 \u0645\u0646 60`);
        }
      }

      vendorReliability = { value: Math.round(pressure * 100) / 100, severity, drivers };
    } catch {
      vendorReliability = { value: 0, severity: 'INFO', drivers: ['Unable to query vendor data / \u062A\u0639\u0630\u0631 \u0627\u0633\u062A\u0639\u0644\u0627\u0645 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u0648\u0631\u062F\u064A\u0646'] };
    }

    // -----------------------------------------------------------------------
    // 6. PROCUREMENT_VELOCITY — Pending/draft POs in last 7 days
    // -----------------------------------------------------------------------
    let procurementVelocity: DimensionResult;
    try {
      const pendingPOCount = await (prisma as any).imdadPurchaseOrder
        ?.count?.({
          where: {
            tenantId,
            ...orgFilter,
            status: { in: ['PENDING', 'DRAFT'] },
            createdAt: { gte: sevenDaysAgo },
          },
        })
        ?.catch?.(() => 0) ?? 0;

      const pressure = Math.min(100, pendingPOCount * 5);
      const severity = classifySeverity(pressure, 50, 100);
      const drivers: string[] = [];

      if (pendingPOCount > 0) {
        drivers.push(`${pendingPOCount} pending/draft POs in last 7 days / ${pendingPOCount} \u0623\u0645\u0631 \u0634\u0631\u0627\u0621 \u0645\u0639\u0644\u0642/\u0645\u0633\u0648\u062F\u0629 \u0641\u064A 7 \u0623\u064A\u0627\u0645`);
        if (pendingPOCount > 20) {
          drivers.push(`Critical procurement backlog / \u062A\u0631\u0627\u0643\u0645 \u0645\u0634\u062A\u0631\u064A\u0627\u062A \u062D\u0631\u062C`);
        } else if (pendingPOCount > 10) {
          drivers.push(`High procurement backlog / \u062A\u0631\u0627\u0643\u0645 \u0645\u0634\u062A\u0631\u064A\u0627\u062A \u0645\u0631\u062A\u0641\u0639`);
        }
      }

      procurementVelocity = { value: pressure, severity, drivers };
    } catch {
      procurementVelocity = { value: 0, severity: 'INFO', drivers: ['Unable to query procurement data / \u062A\u0639\u0630\u0631 \u0627\u0633\u062A\u0639\u0644\u0627\u0645 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u0634\u062A\u0631\u064A\u0627\u062A'] };
    }

    // -----------------------------------------------------------------------
    // 7. QUALITY_EXPOSURE — Batches expiring within 90 days
    // -----------------------------------------------------------------------
    let qualityExposure: DimensionResult;
    try {
      const expiringBatches: any[] = await (prisma as any).imdadBatchLot
        ?.findMany?.({
          where: {
            tenantId,
            ...orgFilter,
            expiryDate: { lte: ninetyDaysFromNow, gte: now },
            currentQuantity: { gt: 0 },
          },
          select: { id: true, batchNumber: true, lotNumber: true, expiryDate: true },
          take: 2000,
        })
        ?.catch?.(() => []) ?? [];

      const expiringCount = expiringBatches.length;
      const pressure = Math.min(100, expiringCount * 4);
      const severity = classifySeverity(pressure, 60, 120);
      const drivers: string[] = [];

      if (expiringCount > 0) {
        drivers.push(`${expiringCount} batch(es) expiring within 90 days / ${expiringCount} \u062F\u0641\u0639\u0629 \u062A\u0646\u062A\u0647\u064A \u062E\u0644\u0627\u0644 90 \u064A\u0648\u0645`);
        // Count those expiring within 30 days
        const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        const urgentCount = expiringBatches.filter((b: any) => new Date(b.expiryDate) <= thirtyDaysFromNow).length;
        if (urgentCount > 0) {
          drivers.push(`${urgentCount} expiring within 30 days / ${urgentCount} \u062A\u0646\u062A\u0647\u064A \u062E\u0644\u0627\u0644 30 \u064A\u0648\u0645`);
        }
      }

      qualityExposure = { value: pressure, severity, drivers };
    } catch {
      qualityExposure = { value: 0, severity: 'INFO', drivers: ['Unable to query quality data / \u062A\u0639\u0630\u0631 \u0627\u0633\u062A\u0639\u0644\u0627\u0645 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062C\u0648\u062F\u0629'] };
    }

    // -----------------------------------------------------------------------
    // COMPOSITE PRESSURE — Weighted average
    // -----------------------------------------------------------------------
    const compositeP =
      clinicalLoad.value * WEIGHTS.clinicalLoad +
      supplyStrain.value * WEIGHTS.supplyStrain +
      assetRisk.value * WEIGHTS.assetRisk +
      budgetBurn.value * WEIGHTS.budgetBurn +
      vendorReliability.value * WEIGHTS.vendorReliability +
      procurementVelocity.value * WEIGHTS.procurementVelocity +
      qualityExposure.value * WEIGHTS.qualityExposure;

    const compositeRounded = Math.round(compositeP * 100) / 100;
    const state = systemState(compositeRounded);

    // -----------------------------------------------------------------------
    // GENERATE PRESSURE SIGNALS — For dimensions with pressure > 60
    // -----------------------------------------------------------------------
    const dimensions: Record<string, DimensionResult> = {
      clinicalLoad,
      supplyStrain,
      assetRisk,
      budgetBurn,
      vendorReliability,
      procurementVelocity,
      qualityExposure,
    };

    const DIMENSION_LABELS: Record<string, { en: string; ar: string }> = {
      clinicalLoad: { en: 'Clinical Load', ar: '\u0627\u0644\u062D\u0645\u0644 \u0627\u0644\u0633\u0631\u064A\u0631\u064A' },
      supplyStrain: { en: 'Supply Strain', ar: '\u0636\u063A\u0637 \u0627\u0644\u0625\u0645\u062F\u0627\u062F' },
      assetRisk: { en: 'Asset Risk', ar: '\u0645\u062E\u0627\u0637\u0631 \u0627\u0644\u0623\u0635\u0648\u0644' },
      budgetBurn: { en: 'Budget Burn', ar: '\u0627\u0633\u062A\u0647\u0644\u0627\u0643 \u0627\u0644\u0645\u064A\u0632\u0627\u0646\u064A\u0629' },
      vendorReliability: { en: 'Vendor Reliability', ar: '\u0645\u0648\u062B\u0648\u0642\u064A\u0629 \u0627\u0644\u0645\u0648\u0631\u062F\u064A\u0646' },
      procurementVelocity: { en: 'Procurement Velocity', ar: '\u0633\u0631\u0639\u0629 \u0627\u0644\u0645\u0634\u062A\u0631\u064A\u0627\u062A' },
      qualityExposure: { en: 'Quality Exposure', ar: '\u0627\u0644\u062A\u0639\u0631\u0636 \u0644\u0644\u062C\u0648\u062F\u0629' },
    };

    const signalBaseCount = await prisma.imdadOperationalSignal.count({ where: { tenantId } }).catch(() => 0);
    const decisionBaseCount = await prisma.imdadDecision.count({ where: { tenantId } }).catch(() => 0);
    let signalSeq = signalBaseCount;
    let decisionSeq = decisionBaseCount;

    let signalsGenerated = 0;
    let signalsSkippedDuplicates = 0;
    let decisionsGenerated = 0;
    const decisionTypes: string[] = [];

    for (const [dimKey, dimResult] of Object.entries(dimensions)) {
      if (dimResult.value <= 60) continue;

      const label = DIMENSION_LABELS[dimKey];
      const signalType = 'PRESSURE_ALERT';

      // Check 6-hour duplicate window
      try {
        const existing = await prisma.imdadOperationalSignal.findFirst({
          where: {
            tenantId,
            signalType: signalType as any,
            sourceEntity: 'pressureEngine',
            sourceEntityId: dimKey,
            createdAt: { gte: duplicateCutoff },
          },
        });

        if (existing) {
          signalsSkippedDuplicates++;
          continue;
        }
      } catch {
        // If query fails, proceed with creating
      }

      signalSeq++;
      const signalCode = makeCode('SIG', year, signalSeq);

      try {
        await prisma.imdadOperationalSignal.create({
          data: {
            tenantId,
            signalCode,
            organizationId: organizationId || 'SYSTEM',
            signalType: signalType as any,
            severity: dimResult.severity as any,
            title: `Pressure alert: ${label.en} at ${dimResult.value.toFixed(1)}%`,
            titleAr: `\u062A\u0646\u0628\u064A\u0647 \u0636\u063A\u0637: ${label.ar} \u0639\u0646\u062F ${dimResult.value.toFixed(1)}%`,
            sourceEntity: 'pressureEngine',
            sourceEntityId: dimKey,
            departmentId: null,
            metricValue: dimResult.value,
            threshold: 60,
            deviationPct: dimResult.value - 60,
            acknowledged: false,
            createdAt: now,
            updatedAt: now,
          },
        });
        signalsGenerated++;
      } catch {
        // Signal creation failed — continue
      }
    }

    // -----------------------------------------------------------------------
    // GENERATE PRESSURE DECISIONS
    // -----------------------------------------------------------------------

    // Overall risk mitigation decision if composite > 70
    if (compositeRounded > 70) {
      decisionSeq++;
      const decisionCode = makeCode('DEC', year, decisionSeq);
      const severity = compositeRounded >= 80 ? 'CRITICAL' : 'HIGH';
      const confidenceScore = compositeRounded >= 80 ? 92 : 78;
      const autoApproved = confidenceScore >= 85;

      try {
        await prisma.imdadDecision.create({
          data: {
            tenantId,
            decisionCode,
            organizationId: organizationId || 'SYSTEM',
            decisionType: 'RISK_MITIGATION' as any,
            title: `System pressure risk mitigation: ${state}`,
            titleAr: `\u062A\u062E\u0641\u064A\u0641 \u0645\u062E\u0627\u0637\u0631 \u0636\u063A\u0637 \u0627\u0644\u0646\u0638\u0627\u0645: ${state}`,
            confidenceScore,
            riskScore: compositeRounded,
            status: (autoApproved ? 'AUTO_APPROVED' : 'GENERATED') as any,
            autoApproved,
            escalationLevel: (SEVERITY_ESCALATION[severity] || 'NONE') as any,
            sourceSignals: Object.entries(dimensions)
              .filter(([, d]) => d.value > 60)
              .map(([k]) => k),
            costImpact: null,
            savingsEstimate: null,
            createdBy: userId,
            createdAt: now,
            updatedAt: now,
          },
        });
        decisionsGenerated++;
        if (!decisionTypes.includes('RISK_MITIGATION')) decisionTypes.push('RISK_MITIGATION');
      } catch {
        // Decision creation failed
      }
    }

    // Per-dimension decisions for dimensions > 80
    for (const [dimKey, dimResult] of Object.entries(dimensions)) {
      if (dimResult.value <= 80) continue;

      const decisionType = DIMENSION_DECISION_MAP[dimKey];
      if (!decisionType) continue;

      decisionSeq++;
      const decisionCode = makeCode('DEC', year, decisionSeq);
      const label = DIMENSION_LABELS[dimKey];
      const confidenceScore = dimResult.severity === 'CRITICAL' ? 92 : 78;
      const autoApproved = confidenceScore >= 85;

      try {
        await prisma.imdadDecision.create({
          data: {
            tenantId,
            decisionCode,
            organizationId: organizationId || 'SYSTEM',
            decisionType: decisionType as any,
            title: `Pressure-driven ${decisionType}: ${label.en} at ${dimResult.value.toFixed(1)}%`,
            titleAr: `\u0642\u0631\u0627\u0631 \u0636\u063A\u0637 ${decisionType}: ${label.ar} \u0639\u0646\u062F ${dimResult.value.toFixed(1)}%`,
            confidenceScore,
            riskScore: dimResult.value,
            status: (autoApproved ? 'AUTO_APPROVED' : 'GENERATED') as any,
            autoApproved,
            escalationLevel: (SEVERITY_ESCALATION[dimResult.severity] || 'NONE') as any,
            sourceSignals: [dimKey],
            costImpact: null,
            savingsEstimate: null,
            createdBy: userId,
            createdAt: now,
            updatedAt: now,
          },
        });
        decisionsGenerated++;
        if (!decisionTypes.includes(decisionType)) decisionTypes.push(decisionType);
      } catch {
        // Decision creation failed
      }
    }

    // -----------------------------------------------------------------------
    // UPDATE SYSTEM PULSE
    // -----------------------------------------------------------------------
    if (organizationId) {
      try {
        const [totalAssetCount, atRiskAssetCount] = await Promise.all([
          (prisma as any).imdadAsset?.count?.({ where: { tenantId, organizationId } })?.catch?.(() => 0) ?? 0,
          (prisma as any).imdadAsset?.count?.({
            where: { tenantId, organizationId, status: { in: ['OUT_OF_SERVICE', 'UNDER_MAINTENANCE', 'CALIBRATION_DUE', 'CONDEMNED'] } },
          })?.catch?.(() => 0) ?? 0,
        ]);

        const [activeDecisionCount, criticalSignalCount, highSignalCount] = await Promise.all([
          prisma.imdadDecision.count({
            where: { tenantId, organizationId, status: { in: ['GENERATED', 'PENDING_REVIEW', 'AUTO_APPROVED', 'APPROVED', 'EXECUTING'] as any[] }, isDeleted: false },
          }).catch(() => 0),
          prisma.imdadOperationalSignal.count({
            where: { tenantId, organizationId, severity: 'CRITICAL' as any, resolvedAt: null, isDeleted: false },
          }).catch(() => 0),
          prisma.imdadOperationalSignal.count({
            where: { tenantId, organizationId, severity: 'HIGH' as any, resolvedAt: null, isDeleted: false },
          }).catch(() => 0),
        ]);

        await prisma.imdadSystemPulse.create({
          data: {
            tenantId,
            organizationId,
            pulseTimestamp: now,
            activeDecisions: activeDecisionCount,
            pendingActions: 0,
            criticalSignals: criticalSignalCount,
            highSignals: highSignalCount,
            totalAssets: totalAssetCount,
            assetsAtRisk: atRiskAssetCount,
            inventoryHealth: Math.max(0, 100 - supplyStrain.value),
            budgetHealth: Math.max(0, 100 - budgetBurn.value),
            complianceHealth: Math.max(0, 100 - qualityExposure.value),
            overallHealthScore: Math.max(0, 100 - compositeRounded),
            operationalPressure: compositeRounded,
            supplyChainVelocity: Math.max(0, 100 - procurementVelocity.value),
            riskIndex: compositeRounded,
            trendDirection: compositeRounded >= 80 ? 'DECLINING' : compositeRounded >= 60 ? 'STABLE' : 'IMPROVING',
            aiInsights: {
              engine: 'PRESSURE_ENGINE',
              dimensions: {
                clinicalLoad: clinicalLoad.value,
                supplyStrain: supplyStrain.value,
                assetRisk: assetRisk.value,
                budgetBurn: budgetBurn.value,
                vendorReliability: vendorReliability.value,
                procurementVelocity: procurementVelocity.value,
                qualityExposure: qualityExposure.value,
              },
              composite: compositeRounded,
              state,
              signalsGenerated,
              decisionsGenerated,
            },
          } as any,
        }).catch(() => null);
      } catch {
        // Pulse creation failed — non-critical
      }
    }

    // -----------------------------------------------------------------------
    // RESPONSE
    // -----------------------------------------------------------------------
    return NextResponse.json({
      pressure: {
        composite: compositeRounded,
        state,
        dimensions: {
          clinicalLoad: { value: clinicalLoad.value, severity: clinicalLoad.severity, drivers: clinicalLoad.drivers },
          supplyStrain: { value: supplyStrain.value, severity: supplyStrain.severity, drivers: supplyStrain.drivers },
          assetRisk: { value: assetRisk.value, severity: assetRisk.severity, drivers: assetRisk.drivers },
          budgetBurn: { value: budgetBurn.value, severity: budgetBurn.severity, drivers: budgetBurn.drivers },
          vendorReliability: { value: vendorReliability.value, severity: vendorReliability.severity, drivers: vendorReliability.drivers },
          procurementVelocity: { value: procurementVelocity.value, severity: procurementVelocity.severity, drivers: procurementVelocity.drivers },
          qualityExposure: { value: qualityExposure.value, severity: qualityExposure.severity, drivers: qualityExposure.drivers },
        },
      },
      signals: { generated: signalsGenerated, skippedDuplicates: signalsSkippedDuplicates },
      decisions: { generated: decisionsGenerated, types: decisionTypes },
      systemState: state,
      timestamp: now.toISOString(),
    });
  },
  {
    tenantScoped: true,
    platformKey: 'imdad' as any,
    permissionKey: 'imdad.decisions.manage',
  },
);
