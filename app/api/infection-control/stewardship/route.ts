import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/infection-control/stewardship
 * Returns antibiotic stewardship dashboard data:
 * - Usage metrics (DDD, duration, rates)
 * - Pending alerts
 * - Category & department breakdowns
 * - Monthly trends
 */
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const url = new URL(req.url);
    const days = Math.min(365, Math.max(7, parseInt(url.searchParams.get('days') || '30')));

    const now = new Date();
    const startDate = new Date(now.getTime() - days * 86400000);

    // ── Antibiotic Usage Data ─────────────────────────────────────────────
    const usageRecords = await prisma.antibioticUsage?.findMany?.({
      where: {
        tenantId,
        startDate: { gte: startDate },
      },
      orderBy: { startDate: 'desc' },
      take: 2000,
    }).catch(() => []) || [];

    // Compute metrics
    const totalPrescriptions = usageRecords.length;
    let totalDDD = 0;
    let totalDuration = 0;
    let cultureGuided = 0;
    let deEscalated = 0;
    let ivCount = 0;
    let oralCount = 0;
    let restrictedCount = 0;

    for (const r of usageRecords) {
      totalDDD += Number(r.ddd) || 0;
      totalDuration += r.durationDays || 0;
      if (r.cultureGuided) cultureGuided++;
      if (r.deEscalated) deEscalated++;
      if (r.route === 'IV') ivCount++;
      if (r.route === 'PO') oralCount++;
      if (r.restrictedDrug) restrictedCount++;
    }

    const avgDuration = totalPrescriptions > 0 ? parseFloat((totalDuration / totalPrescriptions).toFixed(1)) : 0;
    const cultureGuidedRate = totalPrescriptions > 0 ? Math.round((cultureGuided / totalPrescriptions) * 100) : 0;
    const deEscalationRate = totalPrescriptions > 0 ? Math.round((deEscalated / totalPrescriptions) * 100) : 0;
    const ivToOralRate = (ivCount + oralCount) > 0 ? Math.round((oralCount / (ivCount + oralCount)) * 100) : 0;

    // Get device-day patient-days for DDD/1000 calculation
    const deviceDayData = await prisma.deviceDayRecord?.aggregate?.({
      where: { tenantId, recordDate: { gte: startDate, lte: now } },
      _sum: { patientDays: true },
    }).catch(() => null);
    const totalPatientDays = deviceDayData?._sum?.patientDays || 0;
    const dddPer1000 = totalPatientDays > 0 ? parseFloat((totalDDD / totalPatientDays * 1000).toFixed(2)) : 0;

    // ── By Category ───────────────────────────────────────────────────────
    const catMap: Record<string, { count: number; ddd: number }> = {};
    for (const r of usageRecords) {
      const cat = r.category || 'other';
      if (!catMap[cat]) catMap[cat] = { count: 0, ddd: 0 };
      catMap[cat].count++;
      catMap[cat].ddd += Number(r.ddd) || 0;
    }
    const byCategory = Object.entries(catMap)
      .map(([category, v]) => ({ category, count: v.count, ddd: parseFloat(v.ddd.toFixed(2)) }))
      .sort((a, b) => b.ddd - a.ddd);

    // ── By Department ─────────────────────────────────────────────────────
    const deptMap: Record<string, { count: number; ddd: number }> = {};
    for (const r of usageRecords) {
      const dept = r.department || 'Unknown';
      if (!deptMap[dept]) deptMap[dept] = { count: 0, ddd: 0 };
      deptMap[dept].count++;
      deptMap[dept].ddd += Number(r.ddd) || 0;
    }
    const byDepartment = Object.entries(deptMap)
      .map(([department, v]) => ({ department, count: v.count, ddd: parseFloat(v.ddd.toFixed(2)) }))
      .sort((a, b) => b.ddd - a.ddd);

    // ── Top Drugs ─────────────────────────────────────────────────────────
    const drugMap: Record<string, { count: number; ddd: number; name: string; nameAr: string }> = {};
    for (const r of usageRecords) {
      const code = r.drugCode || r.drugName || 'unknown';
      if (!drugMap[code]) drugMap[code] = { count: 0, ddd: 0, name: r.drugName || code, nameAr: r.drugNameAr || '' };
      drugMap[code].count++;
      drugMap[code].ddd += Number(r.ddd) || 0;
    }
    const topDrugs = Object.values(drugMap)
      .sort((a, b) => b.ddd - a.ddd)
      .slice(0, 10);

    // ── Monthly Trend ─────────────────────────────────────────────────────
    const monthMap: Record<string, { prescriptions: number; ddd: number }> = {};
    for (const r of usageRecords) {
      const d = new Date(r.startDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!monthMap[key]) monthMap[key] = { prescriptions: 0, ddd: 0 };
      monthMap[key].prescriptions++;
      monthMap[key].ddd += Number(r.ddd) || 0;
    }
    const monthlyTrend = Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({ month, prescriptions: v.prescriptions, ddd: parseFloat(v.ddd.toFixed(2)) }));

    // ── Stewardship Alerts ────────────────────────────────────────────────
    const alerts = await prisma.stewardshipAlert?.findMany?.({
      where: {
        tenantId,
        createdAt: { gte: startDate },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }).catch(() => []) || [];

    // Group alerts by type
    const alertsByType: Record<string, number> = {};
    for (const a of alerts) {
      const t = a.type || 'other';
      alertsByType[t] = (alertsByType[t] || 0) + 1;
    }

    return NextResponse.json({
      metrics: {
        totalPrescriptions,
        totalDDD: parseFloat(totalDDD.toFixed(2)),
        dddPer1000PatientDays: dddPer1000,
        avgDurationDays: avgDuration,
        cultureGuidedRate,
        deEscalationRate,
        ivToOralConversionRate: ivToOralRate,
        restrictedDrugCount: restrictedCount,
        totalPatientDays,
      },
      byCategory,
      byDepartment,
      topDrugs,
      monthlyTrend,
      alerts,
      alertsByType,
      periodDays: days,
    });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'infection_control.view' }
);
