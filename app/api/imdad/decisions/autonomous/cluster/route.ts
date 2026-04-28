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

type SituationType =
  | 'SUPPLY_CRISIS'
  | 'ASSET_CASCADE_FAILURE'
  | 'BUDGET_PRESSURE'
  | 'QUALITY_EMERGENCY'
  | 'VENDOR_COLLAPSE';

const SITUATION_LABELS: Record<SituationType, { en: string; ar: string }> = {
  SUPPLY_CRISIS: { en: 'Supply Crisis', ar: '\u0623\u0632\u0645\u0629 \u0625\u0645\u062f\u0627\u062f' },
  ASSET_CASCADE_FAILURE: { en: 'Asset Cascade Failure', ar: '\u0641\u0634\u0644 \u0645\u062a\u0633\u0644\u0633\u0644 \u0644\u0644\u0623\u0635\u0648\u0644' },
  BUDGET_PRESSURE: { en: 'Budget Pressure', ar: '\u0636\u063a\u0637 \u0627\u0644\u0645\u064a\u0632\u0627\u0646\u064a\u0629' },
  QUALITY_EMERGENCY: { en: 'Quality Emergency', ar: '\u0637\u0648\u0627\u0631\u0626 \u0627\u0644\u062c\u0648\u062f\u0629' },
  VENDOR_COLLAPSE: { en: 'Vendor Collapse', ar: '\u0627\u0646\u0647\u064a\u0627\u0631 \u0627\u0644\u0645\u0648\u0631\u062f' },
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeCode(prefix: string, year: number, seq: number): string {
  return `${prefix}-${year}-${String(seq).padStart(6, '0')}`;
}

interface ClusterDecisionDef {
  decisionType: string;
  title: string;
  titleAr: string;
  severity: string;
  aiReasoning: string;
  aiReasoningAr: string;
  costImpact?: number | null;
  savingsEstimate?: number | null;
  relatedAssetIds?: string[];
  relatedItemIds?: string[];
  deadlineHours: number; // cascading deadline offset
}

interface DetectedCluster {
  situation: SituationType;
  decisions: ClusterDecisionDef[];
}

// ---------------------------------------------------------------------------
// POST /api/imdad/decisions/autonomous/cluster
// Decision Cluster Generator — situational multi-decision clusters
// ---------------------------------------------------------------------------
export const POST = withAuthTenant(
  async (req: NextRequest, { tenantId, userId }) => {
    const sp = req.nextUrl.searchParams;
    const organizationId = sp.get('organizationId')?.trim() || undefined;

    let body: any = {};
    try { body = await req.json(); } catch { /* empty body is ok */ }
    const _pressureData = body?.pressureData; // optional from pressure endpoint

    const now = new Date();
    const year = now.getFullYear();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const orgFilter = organizationId ? { organizationId } : {};

    const detectedClusters: DetectedCluster[] = [];

    // -----------------------------------------------------------------------
    // 1. SUPPLY_CRISIS — >= 3 items at stockout risk simultaneously
    // -----------------------------------------------------------------------
    try {
      let stockoutItems: any[] = await (prisma as any).imdadItemLocation
        ?.findMany({
          where: { tenantId, ...orgFilter },
          take: 1000,
        })
        ?.catch?.(() => []) ?? [];

      // Filter to items at or below reorder point
      stockoutItems = stockoutItems.filter((item: any) => {
        const stock = item.currentStock ?? 0;
        const reorder = item.reorderPoint ?? item.minStock ?? 0;
        return reorder > 0 && stock <= reorder;
      });

      if (stockoutItems.length >= 3) {
        const decisions: ClusterDecisionDef[] = [];
        const criticalItems = stockoutItems.filter((i: any) => (i.currentStock ?? 0) === 0);
        const allItemIds = stockoutItems.map((i: any) => i.itemId || i.id).filter(Boolean);

        // SUPPLY_REORDER for each stockout item (limit to top 10)
        for (const item of stockoutItems.slice(0, 10)) {
          const stock = item.currentStock ?? 0;
          const reorder = item.reorderPoint ?? item.minStock ?? 0;
          const severity = stock === 0 ? 'CRITICAL' : stock <= reorder * 0.5 ? 'HIGH' : 'MEDIUM';
          decisions.push({
            decisionType: 'SUPPLY_REORDER',
            title: `Reorder: ${item.itemName || item.itemId || 'Unknown item'} (stock: ${stock})`,
            titleAr: `\u0625\u0639\u0627\u062f\u0629 \u0637\u0644\u0628: ${item.itemNameAr || item.itemName || item.itemId || '\u0635\u0646\u0641 \u063a\u064a\u0631 \u0645\u062d\u062f\u062f'} (\u0627\u0644\u0645\u062e\u0632\u0648\u0646: ${stock})`,
            severity,
            aiReasoning: `Supply crisis detected: ${stockoutItems.length} items at stockout risk. Item ${item.itemName || item.itemId} has ${stock} units vs reorder point ${reorder}.`,
            aiReasoningAr: `\u062a\u0645 \u0627\u0643\u062a\u0634\u0627\u0641 \u0623\u0632\u0645\u0629 \u0625\u0645\u062f\u0627\u062f: ${stockoutItems.length} \u0635\u0646\u0641 \u0641\u064a \u062e\u0637\u0631 \u0646\u0641\u0627\u062f. \u0627\u0644\u0635\u0646\u0641 ${item.itemNameAr || item.itemName || item.itemId} \u0644\u062f\u064a\u0647 ${stock} \u0648\u062d\u062f\u0629 \u0645\u0642\u0627\u0628\u0644 \u0646\u0642\u0637\u0629 \u0625\u0639\u0627\u062f\u0629 \u0627\u0644\u0637\u0644\u0628 ${reorder}.`,
            relatedItemIds: [item.itemId || item.id].filter(Boolean),
            deadlineHours: 1,
          });
        }

        // VENDOR_SWITCH — check for delayed vendor POs
        const delayedPOs: any[] = await (prisma as any).imdadPurchaseOrder
          ?.findMany({
            where: {
              tenantId,
              ...orgFilter,
              status: { in: ['APPROVED', 'SENT', 'PARTIALLY_RECEIVED'] },
              expectedDeliveryDate: { lt: now },
            },
            take: 50,
          })
          ?.catch?.(() => []) ?? [];

        if (delayedPOs.length > 0) {
          decisions.push({
            decisionType: 'VENDOR_SWITCH',
            title: `Switch vendor: ${delayedPOs.length} overdue POs during supply crisis`,
            titleAr: `\u062a\u063a\u064a\u064a\u0631 \u0627\u0644\u0645\u0648\u0631\u062f: ${delayedPOs.length} \u0623\u0648\u0627\u0645\u0631 \u0634\u0631\u0627\u0621 \u0645\u062a\u0623\u062e\u0631\u0629 \u0623\u062b\u0646\u0627\u0621 \u0623\u0632\u0645\u0629 \u0627\u0644\u0625\u0645\u062f\u0627\u062f`,
            severity: 'HIGH',
            aiReasoning: `${delayedPOs.length} purchase orders are overdue while ${stockoutItems.length} items face stockout. Vendor switch recommended to restore supply chain.`,
            aiReasoningAr: `${delayedPOs.length} \u0623\u0645\u0631 \u0634\u0631\u0627\u0621 \u0645\u062a\u0623\u062e\u0631 \u0628\u064a\u0646\u0645\u0627 ${stockoutItems.length} \u0635\u0646\u0641 \u064a\u0648\u0627\u062c\u0647 \u0646\u0641\u0627\u062f\u0627\u064b. \u064a\u064f\u0646\u0635\u062d \u0628\u062a\u063a\u064a\u064a\u0631 \u0627\u0644\u0645\u0648\u0631\u062f \u0644\u0627\u0633\u062a\u0639\u0627\u062f\u0629 \u0633\u0644\u0633\u0644\u0629 \u0627\u0644\u0625\u0645\u062f\u0627\u062f.`,
            deadlineHours: 4,
          });
        }

        // BUDGET_ALLOCATION — emergency budget for crisis
        decisions.push({
          decisionType: 'BUDGET_ALLOCATION',
          title: `Emergency budget: supply crisis with ${stockoutItems.length} items at risk`,
          titleAr: `\u0645\u064a\u0632\u0627\u0646\u064a\u0629 \u0637\u0627\u0631\u0626\u0629: \u0623\u0632\u0645\u0629 \u0625\u0645\u062f\u0627\u062f \u0645\u0639 ${stockoutItems.length} \u0635\u0646\u0641 \u0641\u064a \u062e\u0637\u0631`,
          severity: 'HIGH',
          aiReasoning: `Emergency budget allocation needed to address supply crisis affecting ${stockoutItems.length} items across the organization.`,
          aiReasoningAr: `\u0645\u0637\u0644\u0648\u0628 \u062a\u062e\u0635\u064a\u0635 \u0645\u064a\u0632\u0627\u0646\u064a\u0629 \u0637\u0627\u0631\u0626\u0629 \u0644\u0645\u0639\u0627\u0644\u062c\u0629 \u0623\u0632\u0645\u0629 \u0627\u0644\u0625\u0645\u062f\u0627\u062f \u0627\u0644\u062a\u064a \u062a\u0624\u062b\u0631 \u0639\u0644\u0649 ${stockoutItems.length} \u0635\u0646\u0641.`,
          deadlineHours: 4,
        });

        // EMERGENCY_PROCUREMENT for critical (zero-stock) items
        if (criticalItems.length > 0) {
          decisions.push({
            decisionType: 'EMERGENCY_PROCUREMENT',
            title: `Emergency procurement: ${criticalItems.length} items at zero stock`,
            titleAr: `\u0634\u0631\u0627\u0621 \u0637\u0627\u0631\u0626: ${criticalItems.length} \u0635\u0646\u0641 \u0628\u0645\u062e\u0632\u0648\u0646 \u0635\u0641\u0631\u064a`,
            severity: 'CRITICAL',
            aiReasoning: `${criticalItems.length} items have reached zero stock during a supply crisis. Emergency procurement is critical to avoid service disruption.`,
            aiReasoningAr: `${criticalItems.length} \u0635\u0646\u0641 \u0648\u0635\u0644 \u0625\u0644\u0649 \u0645\u062e\u0632\u0648\u0646 \u0635\u0641\u0631\u064a \u0623\u062b\u0646\u0627\u0621 \u0623\u0632\u0645\u0629 \u0627\u0644\u0625\u0645\u062f\u0627\u062f. \u0627\u0644\u0634\u0631\u0627\u0621 \u0627\u0644\u0637\u0627\u0631\u0626 \u0636\u0631\u0648\u0631\u064a \u0644\u062a\u062c\u0646\u0628 \u0627\u0646\u0642\u0637\u0627\u0639 \u0627\u0644\u062e\u062f\u0645\u0629.`,
            relatedItemIds: criticalItems.map((i: any) => i.itemId || i.id).filter(Boolean),
            deadlineHours: 1,
          });
        }

        detectedClusters.push({ situation: 'SUPPLY_CRISIS', decisions });
      }
    } catch { /* safe fallback */ }

    // -----------------------------------------------------------------------
    // 2. ASSET_CASCADE_FAILURE — >= 2 assets in same dept OUT_OF_SERVICE/CONDEMNED
    // -----------------------------------------------------------------------
    try {
      const failedAssets: any[] = await (prisma as any).imdadAsset
        ?.findMany({
          where: {
            tenantId,
            ...orgFilter,
            status: { in: ['OUT_OF_SERVICE', 'CONDEMNED'] },
          },
          take: 500,
        })
        ?.catch?.(() => []) ?? [];

      // Group by department
      const deptGroups: Record<string, any[]> = {};
      for (const asset of failedAssets) {
        const deptId = asset.departmentId || '__none__';
        if (!deptGroups[deptId]) deptGroups[deptId] = [];
        deptGroups[deptId].push(asset);
      }

      for (const [deptId, assets] of Object.entries(deptGroups)) {
        if (assets.length < 2) continue;

        const decisions: ClusterDecisionDef[] = [];
        const assetIds = assets.map((a: any) => a.id).filter(Boolean);
        const deptName = assets[0]?.departmentName || deptId;
        const deptNameAr = assets[0]?.departmentNameAr || deptName;
        const totalReplacementCost = assets.reduce(
          (sum: number, a: any) => sum + (a.replacementCost ?? a.purchasePrice ?? 0), 0
        );

        // DEVICE_REPLACEMENT for each failed asset
        for (const asset of assets.slice(0, 8)) {
          decisions.push({
            decisionType: 'DEVICE_REPLACEMENT',
            title: `Replace ${asset.status.toLowerCase()} asset: ${asset.name || asset.assetCode}`,
            titleAr: `\u0627\u0633\u062a\u0628\u062f\u0627\u0644 \u0627\u0644\u0623\u0635\u0644 ${asset.status === 'CONDEMNED' ? '\u0627\u0644\u0645\u062d\u0643\u0648\u0645 \u0639\u0644\u064a\u0647' : '\u0627\u0644\u0645\u062a\u0648\u0642\u0641'}: ${asset.nameAr || asset.name || asset.assetCode}`,
            severity: asset.status === 'CONDEMNED' ? 'CRITICAL' : 'HIGH',
            aiReasoning: `Asset ${asset.assetCode} is ${asset.status} in department ${deptName}. Part of cascade failure with ${assets.length} assets down.`,
            aiReasoningAr: `\u0627\u0644\u0623\u0635\u0644 ${asset.assetCode} \u0628\u062d\u0627\u0644\u0629 ${asset.status} \u0641\u064a \u0642\u0633\u0645 ${deptNameAr}. \u062c\u0632\u0621 \u0645\u0646 \u0641\u0634\u0644 \u0645\u062a\u0633\u0644\u0633\u0644 \u0645\u0639 ${assets.length} \u0623\u0635\u0648\u0644 \u0645\u062a\u0639\u0637\u0644\u0629.`,
            costImpact: asset.replacementCost ?? asset.purchasePrice ?? null,
            relatedAssetIds: [asset.id],
            deadlineHours: 1,
          });
        }

        // CAPACITY_EXPANSION
        decisions.push({
          decisionType: 'CAPACITY_EXPANSION',
          title: `Capacity expansion: ${deptName} cannot operate (${assets.length} assets down)`,
          titleAr: `\u062a\u0648\u0633\u064a\u0639 \u0627\u0644\u0642\u062f\u0631\u0627\u062a: ${deptNameAr} \u0644\u0627 \u064a\u0645\u0643\u0646\u0647 \u0627\u0644\u0639\u0645\u0644 (${assets.length} \u0623\u0635\u0648\u0644 \u0645\u062a\u0639\u0637\u0644\u0629)`,
          severity: 'CRITICAL',
          aiReasoning: `Department ${deptName} has ${assets.length} assets out of service. Operational capacity is critically impacted.`,
          aiReasoningAr: `\u0627\u0644\u0642\u0633\u0645 ${deptNameAr} \u0644\u062f\u064a\u0647 ${assets.length} \u0623\u0635\u0648\u0644 \u062e\u0627\u0631\u062c \u0627\u0644\u062e\u062f\u0645\u0629. \u0627\u0644\u0642\u062f\u0631\u0629 \u0627\u0644\u062a\u0634\u063a\u064a\u0644\u064a\u0629 \u0645\u062a\u0623\u062b\u0631\u0629 \u0628\u0634\u0643\u0644 \u062d\u0631\u062c.`,
          relatedAssetIds: assetIds,
          deadlineHours: 4,
        });

        // RISK_MITIGATION — patient safety
        decisions.push({
          decisionType: 'RISK_MITIGATION',
          title: `Patient safety risk: ${deptName} asset cascade failure`,
          titleAr: `\u062e\u0637\u0631 \u0633\u0644\u0627\u0645\u0629 \u0627\u0644\u0645\u0631\u0636\u0649: \u0641\u0634\u0644 \u0645\u062a\u0633\u0644\u0633\u0644 \u0644\u0644\u0623\u0635\u0648\u0644 \u0641\u064a ${deptNameAr}`,
          severity: 'CRITICAL',
          aiReasoning: `Multiple asset failures in ${deptName} create patient safety risk. Immediate mitigation required.`,
          aiReasoningAr: `\u0641\u0634\u0644 \u0645\u062a\u0639\u062f\u062f \u0644\u0644\u0623\u0635\u0648\u0644 \u0641\u064a ${deptNameAr} \u064a\u062e\u0644\u0642 \u062e\u0637\u0631\u0627\u064b \u0639\u0644\u0649 \u0633\u0644\u0627\u0645\u0629 \u0627\u0644\u0645\u0631\u0636\u0649. \u0645\u0637\u0644\u0648\u0628 \u062a\u062e\u0641\u064a\u0641 \u0641\u0648\u0631\u064a.`,
          relatedAssetIds: assetIds,
          deadlineHours: 1,
        });

        // BUDGET_ALLOCATION — capital needed
        decisions.push({
          decisionType: 'BUDGET_ALLOCATION',
          title: `Capital budget: ${deptName} asset replacement (est. ${totalReplacementCost.toLocaleString()})`,
          titleAr: `\u0645\u064a\u0632\u0627\u0646\u064a\u0629 \u0631\u0623\u0633\u0645\u0627\u0644\u064a\u0629: \u0627\u0633\u062a\u0628\u062f\u0627\u0644 \u0623\u0635\u0648\u0644 ${deptNameAr} (\u062a\u0642\u062f\u064a\u0631 ${totalReplacementCost.toLocaleString()})`,
          severity: 'HIGH',
          aiReasoning: `Estimated replacement cost of ${totalReplacementCost.toLocaleString()} needed for ${assets.length} assets in ${deptName}.`,
          aiReasoningAr: `\u062a\u0643\u0644\u0641\u0629 \u0627\u0633\u062a\u0628\u062f\u0627\u0644 \u062a\u0642\u062f\u064a\u0631\u064a\u0629 ${totalReplacementCost.toLocaleString()} \u0645\u0637\u0644\u0648\u0628\u0629 \u0644\u0640 ${assets.length} \u0623\u0635\u0648\u0644 \u0641\u064a ${deptNameAr}.`,
          costImpact: totalReplacementCost,
          relatedAssetIds: assetIds,
          deadlineHours: 24,
        });

        detectedClusters.push({ situation: 'ASSET_CASCADE_FAILURE', decisions });
      }
    } catch { /* safe fallback */ }

    // -----------------------------------------------------------------------
    // 3. BUDGET_PRESSURE — budget consumed > 85%
    // -----------------------------------------------------------------------
    try {
      const budgets: any[] = await (prisma as any).imdadBudget
        ?.findMany({
          where: {
            tenantId,
            ...orgFilter,
            status: { in: ['ACTIVE', 'APPROVED'] },
          },
          take: 200,
        })
        ?.catch?.(() => []) ?? [];

      const pressuredBudgets = budgets.filter((b: any) => {
        const allocated = b.allocatedAmount ?? b.totalAmount ?? 0;
        const consumed = b.consumedAmount ?? b.usedAmount ?? 0;
        return allocated > 0 && (consumed / allocated) * 100 > 85;
      });

      if (pressuredBudgets.length > 0) {
        const decisions: ClusterDecisionDef[] = [];
        const totalOverspend = pressuredBudgets.reduce((sum: number, b: any) => {
          const allocated = b.allocatedAmount ?? b.totalAmount ?? 0;
          const consumed = b.consumedAmount ?? b.usedAmount ?? 0;
          return sum + Math.max(0, consumed - allocated);
        }, 0);

        // COST_OPTIMIZATION
        decisions.push({
          decisionType: 'COST_OPTIMIZATION',
          title: `Cost optimization: ${pressuredBudgets.length} budgets above 85% utilization`,
          titleAr: `\u062a\u062d\u0633\u064a\u0646 \u0627\u0644\u062a\u0643\u0627\u0644\u064a\u0641: ${pressuredBudgets.length} \u0645\u064a\u0632\u0627\u0646\u064a\u0629 \u062a\u062c\u0627\u0648\u0632\u062a 85% \u0627\u0633\u062a\u0647\u0644\u0627\u0643`,
          severity: 'HIGH',
          aiReasoning: `${pressuredBudgets.length} budgets have exceeded 85% utilization. Cost reduction strategies needed across departments.`,
          aiReasoningAr: `${pressuredBudgets.length} \u0645\u064a\u0632\u0627\u0646\u064a\u0629 \u062a\u062c\u0627\u0648\u0632\u062a 85% \u0627\u0633\u062a\u0647\u0644\u0627\u0643. \u0645\u0637\u0644\u0648\u0628 \u0627\u0633\u062a\u0631\u0627\u062a\u064a\u062c\u064a\u0627\u062a \u062e\u0641\u0636 \u0627\u0644\u062a\u0643\u0627\u0644\u064a\u0641 \u0639\u0628\u0631 \u0627\u0644\u0623\u0642\u0633\u0627\u0645.`,
          savingsEstimate: totalOverspend > 0 ? totalOverspend * 0.15 : null,
          deadlineHours: 4,
        });

        // BUDGET_ALLOCATION
        decisions.push({
          decisionType: 'BUDGET_ALLOCATION',
          title: `Budget increase request: ${pressuredBudgets.length} budgets near exhaustion`,
          titleAr: `\u0637\u0644\u0628 \u0632\u064a\u0627\u062f\u0629 \u0627\u0644\u0645\u064a\u0632\u0627\u0646\u064a\u0629: ${pressuredBudgets.length} \u0645\u064a\u0632\u0627\u0646\u064a\u0629 \u0642\u0631\u064a\u0628\u0629 \u0645\u0646 \u0627\u0644\u0646\u0641\u0627\u062f`,
          severity: totalOverspend > 0 ? 'CRITICAL' : 'HIGH',
          aiReasoning: `Budget pressure detected. Total overspend: ${totalOverspend.toLocaleString()}. Request budget increase to maintain operations.`,
          aiReasoningAr: `\u062a\u0645 \u0627\u0643\u062a\u0634\u0627\u0641 \u0636\u063a\u0637 \u0627\u0644\u0645\u064a\u0632\u0627\u0646\u064a\u0629. \u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u062a\u062c\u0627\u0648\u0632: ${totalOverspend.toLocaleString()}. \u0645\u0637\u0644\u0648\u0628 \u0632\u064a\u0627\u062f\u0629 \u0627\u0644\u0645\u064a\u0632\u0627\u0646\u064a\u0629 \u0644\u0644\u062d\u0641\u0627\u0638 \u0639\u0644\u0649 \u0627\u0644\u0639\u0645\u0644\u064a\u0627\u062a.`,
          costImpact: totalOverspend,
          deadlineHours: 24,
        });

        // VENDOR_SWITCH — find cheaper vendors
        decisions.push({
          decisionType: 'VENDOR_SWITCH',
          title: `Vendor renegotiation: reduce costs across pressured budgets`,
          titleAr: `\u0625\u0639\u0627\u062f\u0629 \u0627\u0644\u062a\u0641\u0627\u0648\u0636 \u0645\u0639 \u0627\u0644\u0645\u0648\u0631\u062f\u064a\u0646: \u062e\u0641\u0636 \u0627\u0644\u062a\u0643\u0627\u0644\u064a\u0641 \u0639\u0628\u0631 \u0627\u0644\u0645\u064a\u0632\u0627\u0646\u064a\u0627\u062a \u0627\u0644\u0645\u0636\u063a\u0648\u0637\u0629`,
          severity: 'MEDIUM',
          aiReasoning: `Budget pressure warrants vendor renegotiation or switching to reduce unit costs and stretch remaining budgets.`,
          aiReasoningAr: `\u0636\u063a\u0637 \u0627\u0644\u0645\u064a\u0632\u0627\u0646\u064a\u0629 \u064a\u0633\u062a\u062f\u0639\u064a \u0625\u0639\u0627\u062f\u0629 \u0627\u0644\u062a\u0641\u0627\u0648\u0636 \u0645\u0639 \u0627\u0644\u0645\u0648\u0631\u062f\u064a\u0646 \u0623\u0648 \u0627\u0644\u062a\u063a\u064a\u064a\u0631 \u0644\u062e\u0641\u0636 \u062a\u0643\u0627\u0644\u064a\u0641 \u0627\u0644\u0648\u062d\u062f\u0629.`,
          deadlineHours: 24,
        });

        // PHASED_INVESTMENT — defer non-critical
        decisions.push({
          decisionType: 'PHASED_INVESTMENT',
          title: `Defer non-critical spending: protect critical operations`,
          titleAr: `\u062a\u0623\u062c\u064a\u0644 \u0627\u0644\u0625\u0646\u0641\u0627\u0642 \u063a\u064a\u0631 \u0627\u0644\u062d\u0631\u062c: \u062d\u0645\u0627\u064a\u0629 \u0627\u0644\u0639\u0645\u0644\u064a\u0627\u062a \u0627\u0644\u062d\u064a\u0648\u064a\u0629`,
          severity: 'MEDIUM',
          aiReasoning: `With ${pressuredBudgets.length} budgets under pressure, non-critical investments should be phased to preserve capital for essential operations.`,
          aiReasoningAr: `\u0645\u0639 ${pressuredBudgets.length} \u0645\u064a\u0632\u0627\u0646\u064a\u0629 \u062a\u062d\u062a \u0627\u0644\u0636\u063a\u0637\u060c \u064a\u062c\u0628 \u062a\u0623\u062c\u064a\u0644 \u0627\u0644\u0627\u0633\u062a\u062b\u0645\u0627\u0631\u0627\u062a \u063a\u064a\u0631 \u0627\u0644\u062d\u0631\u062c\u0629 \u0644\u0644\u062d\u0641\u0627\u0638 \u0639\u0644\u0649 \u0631\u0623\u0633 \u0627\u0644\u0645\u0627\u0644 \u0644\u0644\u0639\u0645\u0644\u064a\u0627\u062a \u0627\u0644\u0623\u0633\u0627\u0633\u064a\u0629.`,
          deadlineHours: 24,
        });

        detectedClusters.push({ situation: 'BUDGET_PRESSURE', decisions });
      }
    } catch { /* safe fallback */ }

    // -----------------------------------------------------------------------
    // 4. QUALITY_EMERGENCY — multiple batches expiring within 30 days
    // -----------------------------------------------------------------------
    try {
      const expiringBatches: any[] = await (prisma as any).imdadBatchLot
        ?.findMany({
          where: {
            tenantId,
            ...orgFilter,
            expiryDate: { lte: thirtyDaysFromNow, gte: now },
            currentQuantity: { gt: 0 },
          },
          take: 500,
        })
        ?.catch?.(() => []) ?? [];

      if (expiringBatches.length >= 2) {
        const decisions: ClusterDecisionDef[] = [];
        const expiringItemIds = expiringBatches.map((b: any) => b.itemId || b.id).filter(Boolean);
        const totalExpiringQty = expiringBatches.reduce((sum: number, b: any) => sum + (b.currentQuantity ?? 0), 0);

        // SUPPLY_REORDER — replace expiring
        decisions.push({
          decisionType: 'SUPPLY_REORDER',
          title: `Reorder for ${expiringBatches.length} expiring batches (${totalExpiringQty} units)`,
          titleAr: `\u0625\u0639\u0627\u062f\u0629 \u0637\u0644\u0628 \u0644\u0640 ${expiringBatches.length} \u062f\u0641\u0639\u0629 \u062a\u0646\u062a\u0647\u064a \u0635\u0644\u0627\u062d\u064a\u062a\u0647\u0627 (${totalExpiringQty} \u0648\u062d\u062f\u0629)`,
          severity: 'HIGH',
          aiReasoning: `${expiringBatches.length} batches with ${totalExpiringQty} total units expiring within 30 days. Replacement orders required.`,
          aiReasoningAr: `${expiringBatches.length} \u062f\u0641\u0639\u0629 \u0628\u0625\u062c\u0645\u0627\u0644\u064a ${totalExpiringQty} \u0648\u062d\u062f\u0629 \u062a\u0646\u062a\u0647\u064a \u0635\u0644\u0627\u062d\u064a\u062a\u0647\u0627 \u062e\u0644\u0627\u0644 30 \u064a\u0648\u0645. \u0645\u0637\u0644\u0648\u0628 \u0623\u0648\u0627\u0645\u0631 \u0627\u0633\u062a\u0628\u062f\u0627\u0644.`,
          relatedItemIds: [...new Set(expiringItemIds)],
          deadlineHours: 4,
        });

        // COMPLIANCE_ACTION — document disposal
        decisions.push({
          decisionType: 'COMPLIANCE_ACTION',
          title: `Document disposal: ${expiringBatches.length} batches reaching expiry`,
          titleAr: `\u062a\u0648\u062b\u064a\u0642 \u0627\u0644\u0625\u062a\u0644\u0627\u0641: ${expiringBatches.length} \u062f\u0641\u0639\u0629 \u062a\u0642\u062a\u0631\u0628 \u0645\u0646 \u0627\u0646\u062a\u0647\u0627\u0621 \u0627\u0644\u0635\u0644\u0627\u062d\u064a\u0629`,
          severity: 'HIGH',
          aiReasoning: `Regulatory compliance requires documented disposal procedures for ${expiringBatches.length} expiring batches.`,
          aiReasoningAr: `\u0627\u0644\u0627\u0645\u062a\u062b\u0627\u0644 \u0627\u0644\u062a\u0646\u0638\u064a\u0645\u064a \u064a\u062a\u0637\u0644\u0628 \u0625\u062c\u0631\u0627\u0621\u0627\u062a \u0625\u062a\u0644\u0627\u0641 \u0645\u0648\u062b\u0642\u0629 \u0644\u0640 ${expiringBatches.length} \u062f\u0641\u0639\u0629 \u0645\u0646\u062a\u0647\u064a\u0629 \u0627\u0644\u0635\u0644\u0627\u062d\u064a\u0629.`,
          deadlineHours: 4,
        });

        // RISK_MITIGATION — patient safety
        decisions.push({
          decisionType: 'RISK_MITIGATION',
          title: `Patient safety: prevent expired supply usage (${expiringBatches.length} batches)`,
          titleAr: `\u0633\u0644\u0627\u0645\u0629 \u0627\u0644\u0645\u0631\u0636\u0649: \u0645\u0646\u0639 \u0627\u0633\u062a\u062e\u062f\u0627\u0645 \u0627\u0644\u0645\u0633\u062a\u0644\u0632\u0645\u0627\u062a \u0627\u0644\u0645\u0646\u062a\u0647\u064a\u0629 (${expiringBatches.length} \u062f\u0641\u0639\u0629)`,
          severity: 'CRITICAL',
          aiReasoning: `Quality emergency: ${expiringBatches.length} batches expiring within 30 days. Patient safety measures must be enforced to prevent expired supply usage.`,
          aiReasoningAr: `\u0637\u0648\u0627\u0631\u0626 \u0627\u0644\u062c\u0648\u062f\u0629: ${expiringBatches.length} \u062f\u0641\u0639\u0629 \u062a\u0646\u062a\u0647\u064a \u0635\u0644\u0627\u062d\u064a\u062a\u0647\u0627 \u062e\u0644\u0627\u0644 30 \u064a\u0648\u0645. \u064a\u062c\u0628 \u062a\u0637\u0628\u064a\u0642 \u0625\u062c\u0631\u0627\u0621\u0627\u062a \u0633\u0644\u0627\u0645\u0629 \u0627\u0644\u0645\u0631\u0636\u0649 \u0644\u0645\u0646\u0639 \u0627\u0633\u062a\u062e\u062f\u0627\u0645 \u0627\u0644\u0645\u0633\u062a\u0644\u0632\u0645\u0627\u062a \u0627\u0644\u0645\u0646\u062a\u0647\u064a\u0629.`,
          relatedItemIds: [...new Set(expiringItemIds)],
          deadlineHours: 1,
        });

        // EMERGENCY_PROCUREMENT for critical medications
        const criticalBatches = expiringBatches.filter((b: any) => {
          const daysLeft = Math.ceil(
            (new Date(b.expiryDate).getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
          );
          return daysLeft <= 7;
        });
        if (criticalBatches.length > 0) {
          decisions.push({
            decisionType: 'EMERGENCY_PROCUREMENT',
            title: `Emergency procurement: ${criticalBatches.length} batches expiring within 7 days`,
            titleAr: `\u0634\u0631\u0627\u0621 \u0637\u0627\u0631\u0626: ${criticalBatches.length} \u062f\u0641\u0639\u0629 \u062a\u0646\u062a\u0647\u064a \u062e\u0644\u0627\u0644 7 \u0623\u064a\u0627\u0645`,
            severity: 'CRITICAL',
            aiReasoning: `${criticalBatches.length} batches expire within 7 days. Emergency procurement needed to ensure continuity.`,
            aiReasoningAr: `${criticalBatches.length} \u062f\u0641\u0639\u0629 \u062a\u0646\u062a\u0647\u064a \u062e\u0644\u0627\u0644 7 \u0623\u064a\u0627\u0645. \u0645\u0637\u0644\u0648\u0628 \u0634\u0631\u0627\u0621 \u0637\u0627\u0631\u0626 \u0644\u0636\u0645\u0627\u0646 \u0627\u0644\u0627\u0633\u062a\u0645\u0631\u0627\u0631\u064a\u0629.`,
            relatedItemIds: criticalBatches.map((b: any) => b.itemId || b.id).filter(Boolean),
            deadlineHours: 1,
          });
        }

        detectedClusters.push({ situation: 'QUALITY_EMERGENCY', decisions });
      }
    } catch { /* safe fallback */ }

    // -----------------------------------------------------------------------
    // 5. VENDOR_COLLAPSE — vendor scorecard drops below 40
    // -----------------------------------------------------------------------
    try {
      const weakScorecards: any[] = await (prisma as any).imdadVendorScorecard
        ?.findMany({
          where: {
            tenantId,
            ...orgFilter,
          },
          take: 200,
        })
        ?.catch?.(() => []) ?? [];

      const collapsedVendors = weakScorecards.filter((sc: any) => {
        const overall = sc.overallScore ?? sc.totalScore ?? sc.score ?? null;
        return overall !== null && overall < 40;
      });

      for (const scorecard of collapsedVendors) {
        const decisions: ClusterDecisionDef[] = [];
        const vendorName = scorecard.vendorName || scorecard.vendorId || 'Unknown';
        const vendorNameAr = scorecard.vendorNameAr || vendorName;
        const score = scorecard.overallScore ?? scorecard.totalScore ?? scorecard.score ?? 0;

        // VENDOR_SWITCH — primary
        decisions.push({
          decisionType: 'VENDOR_SWITCH',
          title: `Switch vendor: ${vendorName} (score: ${score}/100)`,
          titleAr: `\u062a\u063a\u064a\u064a\u0631 \u0627\u0644\u0645\u0648\u0631\u062f: ${vendorNameAr} (\u0627\u0644\u062a\u0642\u064a\u064a\u0645: ${score}/100)`,
          severity: score < 20 ? 'CRITICAL' : 'HIGH',
          aiReasoning: `Vendor ${vendorName} scorecard collapsed to ${score}/100. Immediate switch to alternative vendor recommended.`,
          aiReasoningAr: `\u062a\u0642\u064a\u064a\u0645 \u0627\u0644\u0645\u0648\u0631\u062f ${vendorNameAr} \u0627\u0646\u0647\u0627\u0631 \u0625\u0644\u0649 ${score}/100. \u064a\u064f\u0646\u0635\u062d \u0628\u0627\u0644\u062a\u063a\u064a\u064a\u0631 \u0627\u0644\u0641\u0648\u0631\u064a \u0625\u0644\u0649 \u0645\u0648\u0631\u062f \u0628\u062f\u064a\u0644.`,
          deadlineHours: 1,
        });

        // SUPPLY_REORDER — stock up buffer
        decisions.push({
          decisionType: 'SUPPLY_REORDER',
          title: `Buffer stock: prepare for vendor switch from ${vendorName}`,
          titleAr: `\u0645\u062e\u0632\u0648\u0646 \u0627\u062d\u062a\u064a\u0627\u0637\u064a: \u0627\u0644\u0627\u0633\u062a\u0639\u062f\u0627\u062f \u0644\u062a\u063a\u064a\u064a\u0631 \u0627\u0644\u0645\u0648\u0631\u062f ${vendorNameAr}`,
          severity: 'HIGH',
          aiReasoning: `Buffer stock needed before switching from vendor ${vendorName} (score: ${score}/100) to prevent supply gaps during transition.`,
          aiReasoningAr: `\u0645\u0637\u0644\u0648\u0628 \u0645\u062e\u0632\u0648\u0646 \u0627\u062d\u062a\u064a\u0627\u0637\u064a \u0642\u0628\u0644 \u0627\u0644\u062a\u063a\u064a\u064a\u0631 \u0645\u0646 \u0627\u0644\u0645\u0648\u0631\u062f ${vendorNameAr} (\u0627\u0644\u062a\u0642\u064a\u064a\u0645: ${score}/100) \u0644\u0645\u0646\u0639 \u0641\u062c\u0648\u0627\u062a \u0627\u0644\u0625\u0645\u062f\u0627\u062f \u0623\u062b\u0646\u0627\u0621 \u0627\u0644\u0627\u0646\u062a\u0642\u0627\u0644.`,
          deadlineHours: 4,
        });

        // RISK_MITIGATION — supply chain protection
        decisions.push({
          decisionType: 'RISK_MITIGATION',
          title: `Supply chain protection: vendor ${vendorName} collapse`,
          titleAr: `\u062d\u0645\u0627\u064a\u0629 \u0633\u0644\u0633\u0644\u0629 \u0627\u0644\u0625\u0645\u062f\u0627\u062f: \u0627\u0646\u0647\u064a\u0627\u0631 \u0627\u0644\u0645\u0648\u0631\u062f ${vendorNameAr}`,
          severity: 'HIGH',
          aiReasoning: `Vendor ${vendorName} collapse (score: ${score}/100) threatens supply chain continuity. Risk mitigation measures required.`,
          aiReasoningAr: `\u0627\u0646\u0647\u064a\u0627\u0631 \u0627\u0644\u0645\u0648\u0631\u062f ${vendorNameAr} (\u0627\u0644\u062a\u0642\u064a\u064a\u0645: ${score}/100) \u064a\u0647\u062f\u062f \u0627\u0633\u062a\u0645\u0631\u0627\u0631\u064a\u0629 \u0633\u0644\u0633\u0644\u0629 \u0627\u0644\u0625\u0645\u062f\u0627\u062f. \u0645\u0637\u0644\u0648\u0628 \u0625\u062c\u0631\u0627\u0621\u0627\u062a \u062a\u062e\u0641\u064a\u0641 \u0627\u0644\u0645\u062e\u0627\u0637\u0631.`,
          deadlineHours: 4,
        });

        // COST_OPTIMIZATION — renegotiate contracts
        decisions.push({
          decisionType: 'COST_OPTIMIZATION',
          title: `Renegotiate contracts: vendor ${vendorName} performance collapse`,
          titleAr: `\u0625\u0639\u0627\u062f\u0629 \u0627\u0644\u062a\u0641\u0627\u0648\u0636 \u0639\u0644\u0649 \u0627\u0644\u0639\u0642\u0648\u062f: \u0627\u0646\u0647\u064a\u0627\u0631 \u0623\u062f\u0627\u0621 \u0627\u0644\u0645\u0648\u0631\u062f ${vendorNameAr}`,
          severity: 'MEDIUM',
          aiReasoning: `Vendor ${vendorName} underperformance (score: ${score}/100) provides leverage for contract renegotiation or penalty enforcement.`,
          aiReasoningAr: `\u0636\u0639\u0641 \u0623\u062f\u0627\u0621 \u0627\u0644\u0645\u0648\u0631\u062f ${vendorNameAr} (\u0627\u0644\u062a\u0642\u064a\u064a\u0645: ${score}/100) \u064a\u0648\u0641\u0631 \u0646\u0641\u0648\u0630\u0627\u064b \u0644\u0625\u0639\u0627\u062f\u0629 \u0627\u0644\u062a\u0641\u0627\u0648\u0636 \u0639\u0644\u0649 \u0627\u0644\u0639\u0642\u0648\u062f \u0623\u0648 \u062a\u0637\u0628\u064a\u0642 \u0627\u0644\u063a\u0631\u0627\u0645\u0627\u062a.`,
          deadlineHours: 24,
        });

        detectedClusters.push({ situation: 'VENDOR_COLLAPSE', decisions });
      }
    } catch { /* safe fallback */ }

    // -----------------------------------------------------------------------
    // Persist all cluster decisions
    // -----------------------------------------------------------------------
    const decisionBaseCount = await prisma.imdadDecision.count({ where: { tenantId } }).catch(() => 0);
    let decisionSeq = decisionBaseCount;
    let clusterSeqNum = 0;

    const clusterResults: Array<{
      clusterId: string;
      situation: string;
      situationAr: string;
      decisions: number;
      decisionIds: string[];
      totalCostImpact: number;
      autoApproved: number;
      escalated: number;
    }> = [];

    let totalDecisions = 0;
    let totalAutoApproved = 0;

    for (const cluster of detectedClusters) {
      clusterSeqNum++;
      const clusterId = makeCode('CLU', year, clusterSeqNum);
      const clusterSize = cluster.decisions.length;

      const decisionIds: string[] = [];
      let clusterCostImpact = 0;
      let clusterAutoApproved = 0;
      let clusterEscalated = 0;

      for (let i = 0; i < cluster.decisions.length; i++) {
        const def = cluster.decisions[i];
        decisionSeq++;
        const decisionCode = makeCode('DCS', year, decisionSeq);

        const confidenceScore = SEVERITY_CONFIDENCE[def.severity] ?? 55;
        const autoApproved = confidenceScore >= AUTO_APPROVAL_THRESHOLD;
        const status = autoApproved ? 'AUTO_APPROVED' : 'GENERATED';
        const escalationLevel = SEVERITY_ESCALATION[def.severity] || 'NONE';

        if (autoApproved) {
          clusterAutoApproved++;
          totalAutoApproved++;
        }
        if (escalationLevel !== 'NONE') clusterEscalated++;

        const costImpact = def.costImpact ?? null;
        if (costImpact && costImpact > 0) clusterCostImpact += costImpact;

        const deadlineMs = def.deadlineHours * 60 * 60 * 1000;

        try {
          const decision = await prisma.imdadDecision.create({
            data: {
              tenantId,
              decisionCode,
              organizationId: organizationId || 'SYSTEM',
              decisionType: def.decisionType as any,
              title: def.title,
              titleAr: def.titleAr,
              confidenceScore,
              riskScore: def.severity === 'CRITICAL' ? 95 : def.severity === 'HIGH' ? 75 : 50,
              impactScore: def.severity === 'CRITICAL' ? 90 : def.severity === 'HIGH' ? 65 : 40,
              costImpact,
              savingsEstimate: def.savingsEstimate ?? null,
              currency: 'SAR',
              escalationLevel: escalationLevel as any,
              sourceSignals: [],
              aiReasoning: def.aiReasoning,
              aiReasoningAr: def.aiReasoningAr,
              relatedAssetIds: def.relatedAssetIds || [],
              relatedItemIds: def.relatedItemIds || [],
              autoApprovalThreshold: AUTO_APPROVAL_THRESHOLD,
              autoApproved,
              status,
              executionDeadline: new Date(now.getTime() + deadlineMs),
              metadata: {
                clusterId,
                clusterType: cluster.situation,
                clusterSize,
                clusterIndex: i,
              },
              createdBy: userId,
              createdAt: now,
              updatedAt: now,
            },
          });
          decisionIds.push(decision.id);
          totalDecisions++;
        } catch {
          // skip individual decision failures
        }
      }

      const label = SITUATION_LABELS[cluster.situation];
      clusterResults.push({
        clusterId,
        situation: label.en,
        situationAr: label.ar,
        decisions: decisionIds.length,
        decisionIds,
        totalCostImpact: clusterCostImpact,
        autoApproved: clusterAutoApproved,
        escalated: clusterEscalated,
      });
    }

    return NextResponse.json({
      clusters: clusterResults,
      summary: {
        totalClusters: clusterResults.length,
        totalDecisions,
        totalAutoApproved,
        situationTypes: detectedClusters.map((c) => c.situation),
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
