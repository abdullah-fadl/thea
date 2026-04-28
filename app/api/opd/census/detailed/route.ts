import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { resolveTenantIdToUuid } from '@/lib/opd/data-aggregator';
import { prisma } from '@/lib/db/prisma';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const tenantUuid = await resolveTenantIdToUuid(tenantId);
    if (!tenantUuid) {
      return NextResponse.json({ error: 'Invalid tenant.' }, { status: 400 });
    }

    const dateParam = req.nextUrl.searchParams.get('date');
    const departmentId = req.nextUrl.searchParams.get('departmentId') || undefined;
    const doctorId = req.nextUrl.searchParams.get('doctorId') || undefined;
    const clinicId = req.nextUrl.searchParams.get('clinicId') || undefined;
    const period = req.nextUrl.searchParams.get('period') || 'day';

    // Build date range
    let gte: Date;
    let lte: Date;

    if (dateParam) {
      gte = new Date(dateParam);
      gte.setHours(0, 0, 0, 0);
      lte = new Date(dateParam);
      lte.setHours(23, 59, 59, 999);
    } else {
      lte = new Date();
      lte.setHours(23, 59, 59, 999);
      gte = new Date();

      switch (period) {
        case 'week':
          gte.setDate(gte.getDate() - 7);
          break;
        case 'month':
          gte.setMonth(gte.getMonth() - 1);
          break;
        case 'quarter':
          gte.setMonth(gte.getMonth() - 3);
          break;
        default:
          gte.setHours(0, 0, 0, 0);
      }
    }

    // Build filter (tenantId in DB is UUID)
    const where: any = {
      tenantId: tenantUuid,
      date: { gte, lte },
    };
    if (departmentId) where.departmentId = departmentId;
    if (doctorId) where.doctorId = doctorId;
    if (clinicId) where.clinicId = clinicId;

    // [P-01] Fetch census data with limit to prevent unbounded memory usage
    const censusRecords = await prisma.opdCensus.findMany({
      where,
      orderBy: [{ date: 'desc' }],
      take: 1000,
    });

    // [P-01] Fetch daily data as supplement with limit
    const dailyRecords = await prisma.opdDailyData.findMany({
      where,
      orderBy: [{ date: 'desc' }],
      take: 1000,
    });

    // Resolve department and doctor names (tenantId is UUID)
    const deptIds = Array.from(new Set([
      ...censusRecords.map((r) => r.departmentId).filter(Boolean),
      ...dailyRecords.map((r) => r.departmentId).filter(Boolean),
    ]));
    const docIds = Array.from(new Set([
      ...censusRecords.map((r) => r.doctorId).filter(Boolean),
      ...dailyRecords.map((r) => r.doctorId).filter(Boolean),
    ])) as string[];

    const [departments, providers] = await Promise.all([
      deptIds.length
        ? prisma.department.findMany({
            where: { tenantId: tenantUuid, id: { in: deptIds as string[] } },
            select: { id: true, name: true },
          })
        : [],
      docIds.length
        ? prisma.clinicalInfraProvider.findMany({
            where: { tenantId: tenantUuid, id: { in: docIds } },
            select: { id: true, displayName: true },
          })
        : [],
    ]);

    const deptNameMap = new Map<string, string | null>(departments.map((d): [string, string | null] => [d.id, d.name]));
    const docNameMap = new Map<string, string | null>(providers.map((p): [string, string | null] => [p.id, p.displayName]));

    // Enrich records
    const enriched = censusRecords.map((r) => ({
      ...r,
      departmentName: deptNameMap.get(r.departmentId || '') || r.departmentId,
      doctorName: docNameMap.get(r.doctorId || '') || r.doctorId,
    }));

    const enrichedDaily = dailyRecords.map((r) => ({
      ...r,
      departmentName: deptNameMap.get(r.departmentId || '') || r.departmentId,
      doctorName: docNameMap.get(r.doctorId || '') || r.doctorId,
    }));

    // Summary stats
    const totalPatients = censusRecords.reduce((sum, r) => sum + (r.patientCount || 0), 0);
    const totalNewPatients = censusRecords.reduce((sum, r) => sum + (r.newPatients || 0), 0);
    const totalFollowUp = censusRecords.reduce((sum, r) => sum + (r.followUpPatients || 0), 0);
    const totalBooked = censusRecords.reduce((sum, r) => sum + (r.booked || 0), 0);
    const totalProcedures = censusRecords.reduce((sum, r) => sum + (r.procedures || 0), 0);

    const utilRates = censusRecords
      .map((r) => r.utilizationRate || 0)
      .filter((rate) => rate > 0);
    const avgUtilization = utilRates.length > 0
      ? Math.round(utilRates.reduce((a, b) => a + b, 0) / utilRates.length)
      : 0;

    return NextResponse.json({
      success: true,
      period,
      dateRange: { from: gte.toISOString(), to: lte.toISOString() },
      summary: {
        totalPatients,
        totalNewPatients,
        totalFollowUp,
        totalBooked,
        totalProcedures,
        avgUtilization,
        recordCount: censusRecords.length,
      },
      census: enriched,
      dailyData: enrichedDaily,
    });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'opd.dashboard.view' }
);
