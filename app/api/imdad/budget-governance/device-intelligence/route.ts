/**
 * Imdad Budget Governance — Device Replacement Intelligence
 * ذكاء استبدال الأجهزة
 *
 * GET  /api/imdad/budget-governance/device-intelligence — Scan assets & return replacement recommendations
 * POST /api/imdad/budget-governance/device-intelligence — Create/update device replacement plans
 *
 * The GET endpoint performs intelligent analysis:
 * 1. Scans all assets for lifecycle exceedance
 * 2. Checks maintenance cost ratios
 * 3. Detects performance degradation signals
 * 4. Identifies technology obsolescence
 * 5. Generates phased replacement recommendations
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';

interface DeviceAnalysis {
  assetId: string;
  assetTag: string;
  assetName: string;
  assetNameAr: string | null;
  departmentId: string | null;
  departmentName: string;
  manufacturer: string | null;
  modelNumber: string | null;
  currentAge: number;
  expectedLifeYears: number | null;
  lifecycleExceeded: boolean;
  purchaseCost: number;
  maintenanceCostTotal: number;
  maintenanceCostRatio: number;
  failureCount: number;
  downtimeHours: number;
  replacementUrgency: string;
  estimatedReplacementCost: number;
  aiRiskScore: number;
  compatibilityIssues: string | null;
  technologyObsolescence: boolean;
  patientSafetyRisk: boolean;
}

export const GET = withAuthTenant(
  async (req: NextRequest, { tenantId }) => {
    const url = new URL(req.url);
    const organizationId = url.searchParams.get('organizationId');
    const departmentId = url.searchParams.get('departmentId');
    const urgencyFilter = url.searchParams.get('urgency');

    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });
    }

    try {
      // 1. Fetch all active assets
      const assets = await prisma.imdadAsset.findMany({
        where: {
          tenantId,
          organizationId,
          isDeleted: false,
          status: { in: ['IN_SERVICE', 'UNDER_MAINTENANCE', 'CALIBRATION_DUE'] },
          ...(departmentId ? { departmentId } : {}),
        },
        select: {
          id: true, assetTag: true, assetName: true, assetNameAr: true,
          assetCategory: true, manufacturer: true, modelNumber: true,
          departmentId: true, serialNumber: true, purchaseCost: true,
          purchaseDate: true, commissionDate: true, expectedLifeYears: true,
          warrantyEndDate: true, lastMaintenanceDate: true,
          maintenanceFrequencyDays: true, criticalityLevel: true,
          currentBookValue: true, status: true, metadata: true,
        },
        take: 200,
      });

      // 2. Fetch maintenance cost data per asset
      const assetIds = assets.map(a => a.id);
      const maintenanceOrders = assetIds.length > 0
        ? await prisma.imdadMaintenanceOrder.findMany({
            where: { tenantId, assetId: { in: assetIds }, isDeleted: false },
            select: { assetId: true, totalCost: true, status: true, downtimeHours: true },
          })
        : [];

      // 3. Aggregate maintenance costs per asset
      const maintenanceMap = new Map<string, { totalCost: number; failureCount: number; downtimeHours: number }>();
      for (const mo of maintenanceOrders) {
        const existing = maintenanceMap.get(mo.assetId) || { totalCost: 0, failureCount: 0, downtimeHours: 0 };
        existing.totalCost += Number(mo.totalCost ?? 0);
        if (mo.status === 'COMPLETED') existing.failureCount++;
        existing.downtimeHours += Number(mo.downtimeHours ?? 0);
        maintenanceMap.set(mo.assetId, existing);
      }

      // 4. Fetch department names
      const deptIds = [...new Set(assets.map(a => a.departmentId).filter(Boolean))] as string[];
      const departments = deptIds.length > 0
        ? await prisma.imdadDepartment.findMany({
            where: { tenantId, id: { in: deptIds } },
            select: { id: true, name: true, nameAr: true },
          })
        : [];
      const deptMap = new Map(departments.map(d => [d.id, d.name]));

      // 5. Analyze each asset
      const now = new Date();
      const analyses: DeviceAnalysis[] = [];

      for (const asset of assets) {
        const purchaseDate = asset.commissionDate || asset.purchaseDate;
        const ageYears = purchaseDate
          ? Math.floor((now.getTime() - new Date(purchaseDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
          : 0;
        const expectedLife = asset.expectedLifeYears ?? 10;
        const lifecycleExceeded = ageYears > expectedLife;
        const purchaseCost = Number(asset.purchaseCost ?? 0);
        const mData = maintenanceMap.get(asset.id) || { totalCost: 0, failureCount: 0, downtimeHours: 0 };
        const maintenanceCostRatio = purchaseCost > 0
          ? Math.round((mData.totalCost / purchaseCost) * 100) / 100
          : 0;

        // AI Risk Score calculation (0-100)
        let riskScore = 0;
        if (lifecycleExceeded) riskScore += 30;
        if (ageYears > expectedLife * 0.8) riskScore += 15;
        if (maintenanceCostRatio > 0.5) riskScore += 20;
        if (maintenanceCostRatio > 0.8) riskScore += 10;
        if (mData.failureCount > 5) riskScore += 10;
        if (mData.downtimeHours > 100) riskScore += 10;
        if (asset.criticalityLevel === 'HIGH' || asset.criticalityLevel === 'CRITICAL') riskScore += 5;
        riskScore = Math.min(100, riskScore);

        // Determine urgency
        let urgency = 'MONITOR_ONLY';
        if (riskScore >= 80) urgency = 'IMMEDIATE';
        else if (riskScore >= 60) urgency = 'WITHIN_6_MONTHS';
        else if (riskScore >= 40) urgency = 'WITHIN_1_YEAR';
        else if (riskScore >= 25) urgency = 'WITHIN_2_YEARS';
        else if (lifecycleExceeded) urgency = 'WITHIN_3_YEARS';

        // Technology obsolescence check
        const technologyObsolescence = ageYears > expectedLife * 1.5;

        // Patient safety risk
        const patientSafetyRisk = (
          asset.criticalityLevel === 'CRITICAL' && (lifecycleExceeded || riskScore >= 60)
        );

        // Estimated replacement cost (1.3x purchase cost for inflation)
        const estimatedReplacementCost = Math.round(purchaseCost * 1.3);

        // Apply urgency filter
        if (urgencyFilter && urgency !== urgencyFilter) continue;

        // Only include assets needing attention (risk > 20 or lifecycle exceeded)
        if (riskScore < 20 && !lifecycleExceeded) continue;

        analyses.push({
          assetId: asset.id,
          assetTag: asset.assetTag,
          assetName: asset.assetName,
          assetNameAr: asset.assetNameAr,
          departmentId: asset.departmentId,
          departmentName: deptMap.get(asset.departmentId || '') || 'Unknown',
          manufacturer: asset.manufacturer,
          modelNumber: asset.modelNumber,
          currentAge: ageYears,
          expectedLifeYears: expectedLife,
          lifecycleExceeded,
          purchaseCost,
          maintenanceCostTotal: mData.totalCost,
          maintenanceCostRatio,
          failureCount: mData.failureCount,
          downtimeHours: mData.downtimeHours,
          replacementUrgency: urgency,
          estimatedReplacementCost,
          aiRiskScore: riskScore,
          compatibilityIssues: null,
          technologyObsolescence,
          patientSafetyRisk,
        });
      }

      // Sort by risk score descending
      analyses.sort((a, b) => b.aiRiskScore - a.aiRiskScore);

      // Generate summary statistics
      const summary = {
        totalAssetsAnalyzed: assets.length,
        assetsNeedingAttention: analyses.length,
        immediateReplacements: analyses.filter(a => a.replacementUrgency === 'IMMEDIATE').length,
        within6Months: analyses.filter(a => a.replacementUrgency === 'WITHIN_6_MONTHS').length,
        within1Year: analyses.filter(a => a.replacementUrgency === 'WITHIN_1_YEAR').length,
        within2Years: analyses.filter(a => a.replacementUrgency === 'WITHIN_2_YEARS').length,
        lifecycleExceeded: analyses.filter(a => a.lifecycleExceeded).length,
        patientSafetyRisks: analyses.filter(a => a.patientSafetyRisk).length,
        totalEstimatedCost: analyses.reduce((sum, a) => sum + a.estimatedReplacementCost, 0),
        averageRiskScore: analyses.length > 0
          ? Math.round(analyses.reduce((sum, a) => sum + a.aiRiskScore, 0) / analyses.length)
          : 0,
        // Phased recommendation
        phasedRecommendation: {
          phase1: {
            label: 'Immediate & Critical',
            labelAr: 'فوري وحرج',
            items: analyses.filter(a => a.replacementUrgency === 'IMMEDIATE' || a.replacementUrgency === 'WITHIN_6_MONTHS').length,
            cost: analyses.filter(a => a.replacementUrgency === 'IMMEDIATE' || a.replacementUrgency === 'WITHIN_6_MONTHS')
              .reduce((sum, a) => sum + a.estimatedReplacementCost, 0),
          },
          phase2: {
            label: 'Within 1 Year',
            labelAr: 'خلال سنة',
            items: analyses.filter(a => a.replacementUrgency === 'WITHIN_1_YEAR').length,
            cost: analyses.filter(a => a.replacementUrgency === 'WITHIN_1_YEAR')
              .reduce((sum, a) => sum + a.estimatedReplacementCost, 0),
          },
          phase3: {
            label: 'Within 2-3 Years',
            labelAr: 'خلال 2-3 سنوات',
            items: analyses.filter(a => a.replacementUrgency === 'WITHIN_2_YEARS' || a.replacementUrgency === 'WITHIN_3_YEARS').length,
            cost: analyses.filter(a => a.replacementUrgency === 'WITHIN_2_YEARS' || a.replacementUrgency === 'WITHIN_3_YEARS')
              .reduce((sum, a) => sum + a.estimatedReplacementCost, 0),
          },
        },
      };

      return NextResponse.json({ data: analyses, summary });
    } catch (err: any) {
      console.error('[Device Intelligence] Analysis error:', err);
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { tenantScoped: true, platformKey: 'imdad', permissionKey: 'imdad.budget.view' },
);

const createPlanSchema = z.object({
  organizationId: z.string().uuid(),
  annualPlanId: z.string().uuid().optional(),
  departmentId: z.string().uuid(),
  departmentName: z.string(),
  departmentNameAr: z.string().optional(),
  assetId: z.string().uuid(),
  assetTag: z.string(),
  assetName: z.string(),
  assetNameAr: z.string().optional(),
  manufacturer: z.string().optional(),
  modelNumber: z.string().optional(),
  currentAge: z.number().int().min(0),
  expectedLifeYears: z.number().int().min(1),
  lifecycleExceeded: z.boolean().default(false),
  performanceDegradation: z.number().min(0).max(100).optional(),
  maintenanceCostRatio: z.number().min(0).optional(),
  downtimeHoursYTD: z.number().min(0).optional(),
  failureCount: z.number().int().min(0).default(0),
  compatibilityIssues: z.string().optional(),
  compatibilityIssuesAr: z.string().optional(),
  technologyObsolescence: z.boolean().default(false),
  replacementUrgency: z.enum([
    'IMMEDIATE', 'WITHIN_6_MONTHS', 'WITHIN_1_YEAR',
    'WITHIN_2_YEARS', 'WITHIN_3_YEARS', 'MONITOR_ONLY',
  ]).default('WITHIN_1_YEAR'),
  estimatedReplacementCost: z.number().min(0).optional(),
  recommendedModel: z.string().optional(),
  recommendedVendor: z.string().optional(),
  suggestedPhase: z.enum(['PHASE_1', 'PHASE_2', 'PHASE_3', 'SINGLE_PHASE']).optional(),
  aiRiskScore: z.number().min(0).max(100).optional(),
  aiImpactAnalysis: z.string().optional(),
  aiImpactAnalysisAr: z.string().optional(),
  clinicalImpact: z.string().optional(),
  clinicalImpactAr: z.string().optional(),
  patientSafetyRisk: z.boolean().default(false),
  regulatoryRisk: z.boolean().default(false),
});

export const POST = withAuthTenant(
  async (req: NextRequest, { tenantId, userId }) => {
    const body = await req.json();
    const parsed = createPlanSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }
    const d = parsed.data;

    try {
      const plan = await prisma.imdadDeviceReplacementPlan.create({
        data: {
          tenantId,
          organizationId: d.organizationId,
          annualPlanId: d.annualPlanId,
          departmentId: d.departmentId,
          departmentName: d.departmentName,
          departmentNameAr: d.departmentNameAr,
          assetId: d.assetId,
          assetTag: d.assetTag,
          assetName: d.assetName,
          assetNameAr: d.assetNameAr,
          manufacturer: d.manufacturer,
          modelNumber: d.modelNumber,
          currentAge: d.currentAge,
          expectedLifeYears: d.expectedLifeYears,
          lifecycleExceeded: d.lifecycleExceeded,
          performanceDegradation: d.performanceDegradation,
          maintenanceCostRatio: d.maintenanceCostRatio,
          downtimeHoursYTD: d.downtimeHoursYTD,
          failureCount: d.failureCount,
          compatibilityIssues: d.compatibilityIssues,
          compatibilityIssuesAr: d.compatibilityIssuesAr,
          technologyObsolescence: d.technologyObsolescence,
          replacementUrgency: d.replacementUrgency,
          estimatedReplacementCost: d.estimatedReplacementCost,
          recommendedModel: d.recommendedModel,
          recommendedVendor: d.recommendedVendor,
          suggestedPhase: d.suggestedPhase,
          aiRiskScore: d.aiRiskScore,
          aiImpactAnalysis: d.aiImpactAnalysis,
          aiImpactAnalysisAr: d.aiImpactAnalysisAr,
          clinicalImpact: d.clinicalImpact,
          clinicalImpactAr: d.clinicalImpactAr,
          patientSafetyRisk: d.patientSafetyRisk,
          regulatoryRisk: d.regulatoryRisk,
          createdBy: userId,
          updatedBy: userId,
        } as any,
      });

      return NextResponse.json({ data: plan }, { status: 201 });
    } catch (err: any) {
      console.error('[Device Intelligence] Create plan error:', err);
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { tenantScoped: true, platformKey: 'imdad', permissionKey: 'imdad.budget.create' },
);
