import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const MOMENTS = ['BEFORE_PATIENT', 'BEFORE_ASEPTIC', 'AFTER_BODY_FLUID', 'AFTER_PATIENT', 'AFTER_SURROUNDINGS'];
const STAFF_CATEGORIES = ['PHYSICIAN', 'NURSE', 'ALLIED_HEALTH', 'SUPPORT', 'STUDENT'];

/**
 * GET /api/infection-control/hand-hygiene
 * Returns aggregated compliance data.
 */
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const url = new URL(req.url);
    const department = url.searchParams.get('department');
    const staffCategory = url.searchParams.get('staffCategory');

    // Date range (default: last 30 days)
    const now = new Date();
    const startDateStr = url.searchParams.get('startDate');
    const endDateStr = url.searchParams.get('endDate');
    const startDate = startDateStr ? new Date(startDateStr + 'T00:00:00Z') : new Date(now.getTime() - 30 * 86400000);
    const endDate = endDateStr ? new Date(endDateStr + 'T23:59:59Z') : now;

    const where: Record<string, unknown> = {
      tenantId,
      auditDate: { gte: startDate, lte: endDate },
    };
    if (department) where.department = department;
    if (staffCategory) where.staffCategory = staffCategory;

    const audits = await prisma.handHygieneAudit?.findMany?.({
      where,
      orderBy: { createdAt: 'desc' },
      take: 5000,
    }).catch(() => []) || [];

    // Overall compliance
    const totalOpp = audits.length;
    const totalCompliant = audits.filter((a: Record<string, unknown>) => a.compliant).length;
    const overallRate = totalOpp > 0 ? Math.round((totalCompliant / totalOpp) * 100) : 0;

    // By department
    const deptMap: Record<string, { opp: number; comp: number }> = {};
    for (const a of audits) {
      const dept = a.department || 'Unknown';
      if (!deptMap[dept]) deptMap[dept] = { opp: 0, comp: 0 };
      deptMap[dept].opp++;
      if (a.compliant) deptMap[dept].comp++;
    }
    const byDepartment = Object.entries(deptMap)
      .map(([dept, v]) => ({ department: dept, opportunities: v.opp, compliant: v.comp, rate: Math.round((v.comp / v.opp) * 100) }))
      .sort((a, b) => b.rate - a.rate);

    // By staff category
    const catMap: Record<string, { opp: number; comp: number }> = {};
    for (const a of audits) {
      const cat = a.staffCategory || 'Unknown';
      if (!catMap[cat]) catMap[cat] = { opp: 0, comp: 0 };
      catMap[cat].opp++;
      if (a.compliant) catMap[cat].comp++;
    }
    const byStaffCategory = Object.entries(catMap)
      .map(([cat, v]) => ({ category: cat, opportunities: v.opp, compliant: v.comp, rate: Math.round((v.comp / v.opp) * 100) }))
      .sort((a, b) => b.rate - a.rate);

    // By WHO 5 Moments
    const momMap: Record<string, { opp: number; comp: number }> = {};
    for (const a of audits) {
      const mom = a.moment || 'Unknown';
      if (!momMap[mom]) momMap[mom] = { opp: 0, comp: 0 };
      momMap[mom].opp++;
      if (a.compliant) momMap[mom].comp++;
    }
    const byMoment = MOMENTS.map((m) => ({
      moment: m,
      opportunities: momMap[m]?.opp || 0,
      compliant: momMap[m]?.comp || 0,
      rate: momMap[m] && momMap[m].opp > 0 ? Math.round((momMap[m].comp / momMap[m].opp) * 100) : 0,
    }));

    // Monthly trend (last 12 months)
    const monthlyMap: Record<string, { opp: number; comp: number }> = {};
    for (const a of audits) {
      const d = new Date(a.auditDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyMap[key]) monthlyMap[key] = { opp: 0, comp: 0 };
      monthlyMap[key].opp++;
      if (a.compliant) monthlyMap[key].comp++;
    }
    const monthlyTrend = Object.entries(monthlyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({ month, opportunities: v.opp, compliant: v.comp, rate: Math.round((v.comp / v.opp) * 100) }));

    // Recent audits (last 20)
    const recentAudits = audits.slice(0, 20);

    return NextResponse.json({
      overall: { opportunities: totalOpp, compliant: totalCompliant, rate: overallRate },
      byDepartment,
      byStaffCategory,
      byMoment,
      monthlyTrend,
      recentAudits,
    });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'infection_control.view' }
);

/**
 * POST /api/infection-control/hand-hygiene
 * Records audit observations (single or batch).
 */
export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }) => {
    const body = await req.json();
    const observations: Record<string, unknown>[] = Array.isArray(body.observations) ? body.observations : [body];

    if (observations.length === 0) {
      return NextResponse.json({ error: 'At least one observation is required' }, { status: 400 });
    }
    if (observations.length > 100) {
      return NextResponse.json({ error: 'Maximum 100 observations per request' }, { status: 400 });
    }

    const results = [];
    for (const obs of observations) {
      if (!obs.department || !obs.staffCategory || !obs.moment) {
        return NextResponse.json({
          error: 'Each observation requires department, staffCategory, and moment',
        }, { status: 400 });
      }
      if (!STAFF_CATEGORIES.includes(obs.staffCategory as string)) {
        return NextResponse.json({
          error: `Invalid staffCategory: ${obs.staffCategory}. Must be one of: ${STAFF_CATEGORIES.join(', ')}`,
        }, { status: 400 });
      }
      if (!MOMENTS.includes(obs.moment as string)) {
        return NextResponse.json({
          error: `Invalid moment: ${obs.moment}. Must be one of: ${MOMENTS.join(', ')}`,
        }, { status: 400 });
      }

      const record = await prisma.handHygieneAudit?.create?.({
        data: {
          tenantId,
          auditDate: obs.auditDate ? new Date(obs.auditDate + 'T00:00:00Z') : new Date(),
          department: obs.department as string,
          observerUserId: userId,
          staffCategory: obs.staffCategory as string,
          moment: obs.moment as string,
          compliant: Boolean(obs.compliant),
          method: (obs.method as string) || null,
          notes: (obs.notes as string) || null,
        },
      });
      results.push(record);
    }

    return NextResponse.json({ success: true, count: results.length, records: results });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'infection_control.manage' }
);
