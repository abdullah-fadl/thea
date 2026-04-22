import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ---------------------------------------------------------------------------
// Signal type → Decision type mapping
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

// Severity → base confidence
const SEVERITY_CONFIDENCE: Record<string, number> = {
  CRITICAL: 92,
  HIGH: 78,
  MEDIUM: 55,
  LOW: 30,
  INFO: 15,
};

// Severity → escalation level
const SEVERITY_ESCALATION: Record<string, string> = {
  CRITICAL: 'CORPORATE',
  HIGH: 'HOSPITAL',
  MEDIUM: 'DEPARTMENT',
  LOW: 'NONE',
  INFO: 'NONE',
};

const AUTO_APPROVAL_THRESHOLD = 85;
const DUPLICATE_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

// ---------------------------------------------------------------------------
// Helper: generate padded code
// ---------------------------------------------------------------------------
function makeCode(prefix: string, year: number, seq: number): string {
  return `${prefix}-${year}-${String(seq).padStart(6, '0')}`;
}

// ---------------------------------------------------------------------------
// Helper: create signal + decision pair
// ---------------------------------------------------------------------------
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
  savingsEstimate?: number | null;
}

// ---------------------------------------------------------------------------
// POST /api/imdad/decisions/autonomous/scan — Brain Scanner
// Scans all modules and auto-generates signals + decisions
// ---------------------------------------------------------------------------
export const POST = withAuthTenant(
  async (req: NextRequest, { tenantId, userId }) => {
    const sp = req.nextUrl.searchParams;
    const organizationId = sp.get('organizationId')?.trim() || undefined;

    const now = new Date();
    const year = now.getFullYear();
    const duplicateCutoff = new Date(now.getTime() - DUPLICATE_WINDOW_MS);
    const ninetyDaysFromNow = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    const findings: Finding[] = [];

    // -----------------------------------------------------------------------
    // 1. ASSET LIFECYCLE BREACHES
    // -----------------------------------------------------------------------
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

      // Check if expectedLifeYears exceeded
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

      // Check maintenance cost spikes (if totalMaintenanceCost > 60% of purchasePrice)
      if (asset.totalMaintenanceCost && asset.purchasePrice && asset.purchasePrice > 0) {
        const costRatio = asset.totalMaintenanceCost / asset.purchasePrice;
        if (costRatio > 0.6) {
          findings.push({
            signalType: 'MAINTENANCE_COST_SPIKE',
            severity: costRatio > 1.0 ? 'CRITICAL' : 'HIGH',
            title: `Maintenance cost spike: ${asset.name || asset.assetCode}`,
            titleAr: `ارتفاع تكاليف الصيانة: ${asset.nameAr || asset.assetCode}`,
            description: `Maintenance costs (${asset.totalMaintenanceCost}) are ${(costRatio * 100).toFixed(0)}% of purchase price (${asset.purchasePrice})`,
            descriptionAr: `تكاليف الصيانة (${asset.totalMaintenanceCost}) تشكل ${(costRatio * 100).toFixed(0)}% من سعر الشراء (${asset.purchasePrice})`,
            sourceEntity: 'imdadAsset',
            sourceEntityId: asset.id,
            departmentId: asset.departmentId || null,
            metricValue: costRatio * 100,
            threshold: 60,
            deviationPct: ((costRatio - 0.6) / 0.6) * 100,
            relatedAssetIds: [asset.id],
            costImpact: asset.totalMaintenanceCost,
          });
        }
      }
    }

    // -----------------------------------------------------------------------
    // 2. INVENTORY STOCKOUT RISKS
    // -----------------------------------------------------------------------
    const lowStockItems: any[] = await (prisma as any).imdadItemLocation
      ?.findMany({
        where: {
          tenantId,
          ...(organizationId ? { organizationId } : {}),
          OR: [
            { currentStock: { lte: (prisma.imdadItemLocation?.fields as any)?.reorderPoint ?? 0 } },
          ],
        },
        take: 500,
      })
      .catch(() => []) ?? [];

    // Fallback: raw query approach for stock comparison
    const stockoutItems: any[] = lowStockItems.length > 0
      ? lowStockItems.filter((item: any) => {
          const stock = item.currentStock ?? 0;
          const reorder = item.reorderPoint ?? item.minStock ?? 0;
          return stock <= reorder && reorder > 0;
        })
      : await (prisma as any).$queryRawUnsafe?.(
          `SELECT * FROM "ImdadItemLocation" WHERE "tenantId" = $1 AND "currentStock" <= "reorderPoint" LIMIT 500`,
          tenantId,
        ).catch(() => []) ?? [];

    for (const item of stockoutItems) {
      const stock = item.currentStock ?? 0;
      const reorder = item.reorderPoint ?? item.minStock ?? 0;
      const severity = stock === 0 ? 'CRITICAL' : stock <= (reorder * 0.5) ? 'HIGH' : 'MEDIUM';

      findings.push({
        signalType: 'STOCKOUT_RISK',
        severity,
        title: `Stockout risk: ${item.itemName || item.itemId}`,
        titleAr: `خطر نفاد المخزون: ${item.itemNameAr || item.itemName || item.itemId}`,
        description: `Current stock (${stock}) is at or below reorder point (${reorder}) at location ${item.locationName || item.locationId || 'unknown'}`,
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

    // -----------------------------------------------------------------------
    // 3. BATCH / LOT EXPIRY WARNINGS
    // -----------------------------------------------------------------------
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

    // -----------------------------------------------------------------------
    // 4. BUDGET OVERRUNS
    // -----------------------------------------------------------------------
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

      if (utilizationPct >= 80) {
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
    }

    // -----------------------------------------------------------------------
    // 5. VENDOR RISK SIGNALS
    // -----------------------------------------------------------------------
    const vendors: any[] = await (prisma as any).imdadVendor
      ?.findMany({
        where: {
          tenantId,
          ...(organizationId ? { organizationId } : {}),
          OR: [
            { riskRating: { in: ['HIGH', 'CRITICAL'] } },
            { complianceStatus: { in: ['NON_COMPLIANT', 'EXPIRED'] } },
            { performanceScore: { lt: 50 } },
          ],
        },
        take: 200,
      })
      .catch(() => []) ?? [];

    for (const vendor of vendors) {
      const isHighRisk = vendor.riskRating === 'CRITICAL' || vendor.riskRating === 'HIGH';
      const isNonCompliant = vendor.complianceStatus === 'NON_COMPLIANT' || vendor.complianceStatus === 'EXPIRED';
      const lowPerformance = vendor.performanceScore != null && vendor.performanceScore < 50;
      const severity = vendor.riskRating === 'CRITICAL' ? 'CRITICAL' : isNonCompliant ? 'HIGH' : 'MEDIUM';

      const reasons: string[] = [];
      const reasonsAr: string[] = [];
      if (isHighRisk) { reasons.push(`risk rating: ${vendor.riskRating}`); reasonsAr.push(`تصنيف المخاطر: ${vendor.riskRating}`); }
      if (isNonCompliant) { reasons.push(`compliance: ${vendor.complianceStatus}`); reasonsAr.push(`الامتثال: ${vendor.complianceStatus}`); }
      if (lowPerformance) { reasons.push(`performance: ${vendor.performanceScore}/100`); reasonsAr.push(`الأداء: ${vendor.performanceScore}/100`); }

      findings.push({
        signalType: 'VENDOR_RISK',
        severity,
        title: `Vendor risk: ${vendor.name || vendor.vendorCode}`,
        titleAr: `خطر المورد: ${vendor.nameAr || vendor.name || vendor.vendorCode}`,
        description: `Vendor ${vendor.vendorCode || vendor.id} flagged: ${reasons.join(', ')}`,
        descriptionAr: `المورد ${vendor.vendorCode || vendor.id} تم تنبيهه: ${reasonsAr.join('، ')}`,
        sourceEntity: 'imdadVendor',
        sourceEntityId: vendor.id,
        metricValue: vendor.performanceScore ?? null,
        threshold: 50,
      });
    }

    // -----------------------------------------------------------------------
    // 6. QUALITY & COMPLIANCE SIGNALS
    // -----------------------------------------------------------------------
    // 6a. Overdue inspections
    const overdueInspections: any[] = await (prisma as any).imdadQualityInspection
      ?.findMany({
        where: {
          tenantId,
          ...(organizationId ? { organizationId } : {}),
          status: { in: ['SCHEDULED', 'IN_PROGRESS'] },
          scheduledDate: { lt: now },
        },
        take: 200,
      })
      .catch(() => []) ?? [];

    for (const insp of overdueInspections) {
      const scheduledDate = new Date(insp.scheduledDate);
      const daysOverdue = Math.ceil((now.getTime() - scheduledDate.getTime()) / (24 * 60 * 60 * 1000));
      const severity = daysOverdue > 30 ? 'CRITICAL' : daysOverdue > 7 ? 'HIGH' : 'MEDIUM';

      findings.push({
        signalType: 'COMPLIANCE_GAP',
        severity,
        title: `Overdue inspection: ${insp.inspectionCode || insp.id} (${daysOverdue} days)`,
        titleAr: `فحص متأخر: ${insp.inspectionCode || insp.id} (${daysOverdue} يوم)`,
        description: `Inspection ${insp.inspectionCode || insp.id} scheduled for ${scheduledDate.toISOString().split('T')[0]} is ${daysOverdue} days overdue`,
        descriptionAr: `الفحص ${insp.inspectionCode || insp.id} المجدول في ${scheduledDate.toISOString().split('T')[0]} متأخر ${daysOverdue} يوم`,
        sourceEntity: 'imdadQualityInspection',
        sourceEntityId: insp.id,
        departmentId: insp.departmentId || null,
        metricValue: daysOverdue,
        threshold: 0,
        deviationPct: 100,
      });
    }

    // 6b. Active recalls
    const activeRecalls: any[] = await (prisma as any).imdadRecallNotice
      ?.findMany({
        where: {
          tenantId,
          ...(organizationId ? { organizationId } : {}),
          status: { in: ['ACTIVE', 'PENDING'] },
        },
        take: 100,
      })
      .catch(() => []) ?? [];

    for (const recall of activeRecalls) {
      findings.push({
        signalType: 'RECALL_TRIGGER',
        severity: recall.severity === 'CLASS_I' ? 'CRITICAL' : recall.severity === 'CLASS_II' ? 'HIGH' : 'MEDIUM',
        title: `Active recall: ${recall.recallCode || recall.title || recall.id}`,
        titleAr: `استدعاء نشط: ${recall.recallCode || recall.titleAr || recall.id}`,
        description: `Recall ${recall.recallCode || recall.id} affecting ${recall.affectedItems?.length ?? 0} items — ${recall.reason || 'Safety concern'}`,
        descriptionAr: `استدعاء ${recall.recallCode || recall.id} يؤثر على ${recall.affectedItems?.length ?? 0} صنف — ${recall.reasonAr || recall.reason || 'مخاوف سلامة'}`,
        sourceEntity: 'imdadRecallNotice',
        sourceEntityId: recall.id,
        metricValue: recall.affectedItems?.length ?? 1,
        threshold: 0,
      });
    }

    // 6c. Expiring vendor certificates
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const expiringCerts: any[] = await (prisma as any).imdadVendorCertificate
      ?.findMany({
        where: {
          tenantId,
          expiryDate: { lte: thirtyDaysFromNow, gte: now },
          status: { not: 'EXPIRED' },
        },
        take: 200,
      })
      .catch(() => []) ?? [];

    for (const cert of expiringCerts) {
      const expiryDate = new Date(cert.expiryDate);
      const daysLeft = Math.ceil((expiryDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
      const severity = daysLeft <= 7 ? 'HIGH' : 'MEDIUM';

      findings.push({
        signalType: 'COMPLIANCE_GAP',
        severity,
        title: `Certificate expiring: ${cert.certificateType || cert.name || cert.id} (${daysLeft} days)`,
        titleAr: `شهادة تنتهي: ${cert.certificateType || cert.name || cert.id} (${daysLeft} يوم)`,
        description: `Vendor certificate ${cert.id} expires on ${expiryDate.toISOString().split('T')[0]} (${daysLeft} days remaining)`,
        descriptionAr: `شهادة المورد ${cert.id} تنتهي في ${expiryDate.toISOString().split('T')[0]} (${daysLeft} يوم متبقي)`,
        sourceEntity: 'imdadVendorCertificate',
        sourceEntityId: cert.id,
        metricValue: daysLeft,
        threshold: 30,
        deviationPct: ((30 - daysLeft) / 30) * 100,
      });
    }

    // -----------------------------------------------------------------------
    // 7. CLINICAL DEMAND SIGNALS
    // -----------------------------------------------------------------------
    // 7a. Ward par level breaches — items below minimum par
    const parBreaches: any[] = await (prisma as any).imdadWardParLevel
      ?.findMany({
        where: {
          tenantId,
          ...(organizationId ? { organizationId } : {}),
        },
        take: 500,
      })
      .catch(() => []) ?? [];

    for (const par of parBreaches) {
      const currentQty = par.currentQuantity ?? par.currentStock ?? 0;
      const minPar = par.minParLevel ?? par.minLevel ?? 0;
      if (minPar <= 0 || currentQty >= minPar) continue;

      const deficit = minPar - currentQty;
      const severity = currentQty === 0 ? 'CRITICAL' : currentQty <= (minPar * 0.3) ? 'HIGH' : 'MEDIUM';

      findings.push({
        signalType: 'DEMAND_SURGE',
        severity,
        title: `Ward par level breach: ${par.itemName || par.itemId} at ${par.wardName || par.departmentId || 'unknown'}`,
        titleAr: `تجاوز مستوى الحد الأدنى: ${par.itemNameAr || par.itemName || par.itemId} في ${par.wardNameAr || par.wardName || par.departmentId || 'غير محدد'}`,
        description: `Current quantity (${currentQty}) below par level (${minPar}), deficit: ${deficit} units`,
        descriptionAr: `الكمية الحالية (${currentQty}) أقل من الحد الأدنى (${minPar})، العجز: ${deficit} وحدة`,
        sourceEntity: 'imdadWardParLevel',
        sourceEntityId: par.id,
        departmentId: par.departmentId || null,
        metricValue: currentQty,
        threshold: minPar,
        deviationPct: minPar > 0 ? ((minPar - currentQty) / minPar) * 100 : 100,
        relatedItemIds: par.itemId ? [par.itemId] : [],
      });
    }

    // -----------------------------------------------------------------------
    // 8. PROCUREMENT SIGNALS
    // -----------------------------------------------------------------------
    // 8a. Overdue POs — not received past expected delivery
    const overduePOs: any[] = await (prisma as any).imdadPurchaseOrder
      ?.findMany({
        where: {
          tenantId,
          ...(organizationId ? { organizationId } : {}),
          status: { in: ['APPROVED', 'SENT', 'PARTIALLY_RECEIVED'] },
          expectedDeliveryDate: { lt: now },
        },
        take: 200,
      })
      .catch(() => []) ?? [];

    for (const po of overduePOs) {
      const expectedDate = new Date(po.expectedDeliveryDate);
      const daysOverdue = Math.ceil((now.getTime() - expectedDate.getTime()) / (24 * 60 * 60 * 1000));
      const severity = daysOverdue > 14 ? 'HIGH' : 'MEDIUM';

      findings.push({
        signalType: 'VENDOR_RISK',
        severity,
        title: `Overdue PO: ${po.poNumber || po.poCode || po.id} (${daysOverdue} days late)`,
        titleAr: `أمر شراء متأخر: ${po.poNumber || po.poCode || po.id} (${daysOverdue} يوم تأخير)`,
        description: `PO ${po.poNumber || po.poCode || po.id} expected ${expectedDate.toISOString().split('T')[0]} is ${daysOverdue} days overdue. Vendor: ${po.vendorName || po.vendorId || 'unknown'}`,
        descriptionAr: `أمر الشراء ${po.poNumber || po.poCode || po.id} المتوقع في ${expectedDate.toISOString().split('T')[0]} متأخر ${daysOverdue} يوم. المورد: ${po.vendorName || po.vendorId || 'غير محدد'}`,
        sourceEntity: 'imdadPurchaseOrder',
        sourceEntityId: po.id,
        departmentId: po.departmentId || null,
        metricValue: daysOverdue,
        threshold: 0,
        costImpact: po.totalAmount ?? null,
      });
    }

    // 8b. Contracts nearing expiry
    const sixtyDaysFromNow = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
    const expiringContracts: any[] = await (prisma as any).imdadContract
      ?.findMany({
        where: {
          tenantId,
          ...(organizationId ? { organizationId } : {}),
          status: { in: ['ACTIVE', 'APPROVED'] },
          endDate: { lte: sixtyDaysFromNow, gte: now },
        },
        take: 200,
      })
      .catch(() => []) ?? [];

    for (const contract of expiringContracts) {
      const endDate = new Date(contract.endDate);
      const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
      const severity = daysLeft <= 14 ? 'HIGH' : 'MEDIUM';

      findings.push({
        signalType: 'VENDOR_RISK',
        severity,
        title: `Contract expiring: ${contract.contractCode || contract.title || contract.id} (${daysLeft} days)`,
        titleAr: `عقد ينتهي: ${contract.contractCode || contract.titleAr || contract.title || contract.id} (${daysLeft} يوم)`,
        description: `Contract ${contract.contractCode || contract.id} with vendor ${contract.vendorName || contract.vendorId || 'unknown'} expires ${endDate.toISOString().split('T')[0]}`,
        descriptionAr: `العقد ${contract.contractCode || contract.id} مع المورد ${contract.vendorName || contract.vendorId || 'غير محدد'} ينتهي في ${endDate.toISOString().split('T')[0]}`,
        sourceEntity: 'imdadContract',
        sourceEntityId: contract.id,
        metricValue: daysLeft,
        threshold: 60,
        deviationPct: ((60 - daysLeft) / 60) * 100,
        costImpact: contract.totalValue ?? null,
      });
    }

    // -----------------------------------------------------------------------
    // 9. Deduplicate & persist signals + decisions
    // -----------------------------------------------------------------------
    const signalBaseCount = await prisma.imdadOperationalSignal.count({ where: { tenantId } });
    const decisionBaseCount = await prisma.imdadDecision.count({ where: { tenantId } });

    let signalSeq = signalBaseCount;
    let decisionSeq = decisionBaseCount;

    const createdSignals: any[] = [];
    const createdDecisions: any[] = [];
    let autoApprovedCount = 0;

    for (const finding of findings) {
      // Check for duplicate signal within 24h window
      const existingSignal = await prisma.imdadOperationalSignal.findFirst({
        where: {
          tenantId,
          signalType: finding.signalType as any,
          sourceEntity: finding.sourceEntity,
          sourceEntityId: finding.sourceEntityId,
          createdAt: { gte: duplicateCutoff },
        },
      });

      if (existingSignal) continue;

      signalSeq++;
      const signalCode = makeCode('SIG', year, signalSeq);

      const signal = await prisma.imdadOperationalSignal.create({
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

      createdSignals.push(signal);

      // Generate paired decision
      decisionSeq++;
      const decisionCode = makeCode('DEC', year, decisionSeq);
      const decisionType = SIGNAL_DECISION_MAP[finding.signalType] || 'RISK_MITIGATION';
      const confidenceScore = SEVERITY_CONFIDENCE[finding.severity] ?? 55;
      const autoApproved = confidenceScore >= AUTO_APPROVAL_THRESHOLD;
      const status = autoApproved ? 'AUTO_APPROVED' : 'GENERATED';

      if (autoApproved) autoApprovedCount++;

      const decision = await prisma.imdadDecision.create({
        data: {
          tenantId,
          decisionCode,
          organizationId: organizationId || 'SYSTEM',
          decisionType: decisionType as any,
          title: `Auto: ${finding.title}`,
          titleAr: `تلقائي: ${finding.titleAr}`,
          description: `Brain Scanner auto-decision from signal ${signalCode}: ${finding.description}`,
          descriptionAr: `قرار تلقائي من الماسح الذكي - إشارة ${signalCode}: ${finding.descriptionAr}`,
          confidenceScore,
          riskScore: finding.severity === 'CRITICAL' ? 95 : finding.severity === 'HIGH' ? 75 : 50,
          impactScore: finding.severity === 'CRITICAL' ? 90 : finding.severity === 'HIGH' ? 65 : 40,
          costImpact: finding.costImpact ?? null,
          savingsEstimate: finding.savingsEstimate ?? null,
          escalationLevel: SEVERITY_ESCALATION[finding.severity] || 'NONE' as any,
          sourceSignals: [signal.id],
          recommendedActions: [],
          alternativeOptions: [],
          aiReasoning: `Autonomous scan detected ${finding.signalType} (${finding.severity}) on ${finding.sourceEntity}:${finding.sourceEntityId}. Decision type: ${decisionType}. Confidence: ${confidenceScore}%.`,
          aiReasoningAr: `المسح التلقائي اكتشف ${finding.signalType} (${finding.severity}) على ${finding.sourceEntity}:${finding.sourceEntityId}. نوع القرار: ${decisionType}. الثقة: ${confidenceScore}%.`,
          departmentId: finding.departmentId || null,
          relatedAssetIds: finding.relatedAssetIds || [],
          relatedItemIds: finding.relatedItemIds || [],
          autoApprovalThreshold: AUTO_APPROVAL_THRESHOLD,
          autoApproved,
          status,
          executionDeadline: finding.severity === 'CRITICAL'
            ? new Date(now.getTime() + 24 * 60 * 60 * 1000)
            : finding.severity === 'HIGH'
              ? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
              : null,
          createdBy: userId,
          createdAt: now,
          updatedAt: now,
        },
      });

      createdDecisions.push(decision);
    }

    // -----------------------------------------------------------------------
    // 7. Record system pulse snapshot
    // -----------------------------------------------------------------------
    if (organizationId) {
      // Count live metrics for the pulse
      const [activeDecisionCount, pendingActionCount, criticalSignalCount, highSignalCount] = await Promise.all([
        prisma.imdadDecision.count({ where: { tenantId, organizationId, status: { in: ['GENERATED', 'PENDING_REVIEW', 'AUTO_APPROVED', 'APPROVED', 'EXECUTING'] }, isDeleted: false } }),
        prisma.imdadDecisionAction.count({ where: { tenantId, organizationId, status: { in: ['PENDING', 'IN_PROGRESS'] }, isDeleted: false } }),
        prisma.imdadOperationalSignal.count({ where: { tenantId, organizationId, severity: 'CRITICAL', resolvedAt: null, isDeleted: false } }),
        prisma.imdadOperationalSignal.count({ where: { tenantId, organizationId, severity: 'HIGH', resolvedAt: null, isDeleted: false } }),
      ]);

      const totalSignalCount = criticalSignalCount + highSignalCount;
      const pressureRaw = Math.min(100, (criticalSignalCount * 15) + (highSignalCount * 8) + (activeDecisionCount * 3));
      const healthRaw = Math.max(0, 100 - pressureRaw);

      await prisma.imdadSystemPulse.create({
        data: {
          tenantId,
          organizationId,
          pulseTimestamp: now,
          activeDecisions: activeDecisionCount,
          pendingActions: pendingActionCount,
          criticalSignals: criticalSignalCount,
          highSignals: highSignalCount,
          overallHealthScore: healthRaw,
          operationalPressure: pressureRaw,
          trendDirection: createdSignals.length > 3 ? 'DECLINING' : createdSignals.length === 0 ? 'IMPROVING' : 'STABLE',
          aiInsights: {
            scanType: 'AUTONOMOUS_SCAN',
            totalFindings: findings.length,
            signalsGenerated: createdSignals.length,
            duplicatesSkipped: findings.length - createdSignals.length,
            decisionsGenerated: createdDecisions.length,
            autoApproved: autoApprovedCount,
            modulesScanned: ['assets', 'inventory', 'batches', 'budgets', 'vendors', 'quality', 'clinical', 'procurement'],
          },
        } as any,
      }).catch(() => null);
    }

    return NextResponse.json({
      summary: {
        totalFindings: findings.length,
        duplicatesSkipped: findings.length - createdSignals.length,
        signalsGenerated: createdSignals.length,
        decisionsGenerated: createdDecisions.length,
        autoApproved: autoApprovedCount,
        scannedAt: now.toISOString(),
      },
      signals: createdSignals,
      decisions: createdDecisions,
    });
  },
  {
    tenantScoped: true,
    platformKey: 'imdad' as any,
    permissionKey: 'imdad.decisions.create',
  },
);
