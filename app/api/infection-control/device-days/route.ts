import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/infection-control/device-days
 * Returns device-day records for a date range.
 * Query params: startDate, endDate, department (optional)
 */
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const url = new URL(req.url);
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');
    const department = url.searchParams.get('department');

    const where: Record<string, unknown> = { tenantId };
    if (startDate && endDate) {
      where.recordDate = {
        gte: new Date(startDate + 'T00:00:00Z'),
        lte: new Date(endDate + 'T23:59:59Z'),
      };
    } else {
      // Default: last 30 days
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
      where.recordDate = { gte: thirtyDaysAgo, lte: now };
    }
    if (department) where.department = department;

    const records = await prisma.deviceDayRecord?.findMany?.({
      where,
      orderBy: { recordDate: 'desc' },
      take: 500,
    }).catch(() => []) || [];

    // Aggregate totals
    let totalPatientDays = 0;
    let totalVentDays = 0;
    let totalCLDays = 0;
    let totalCathDays = 0;
    for (const r of records) {
      totalPatientDays += r.patientDays || 0;
      totalVentDays += r.ventilatorDays || 0;
      totalCLDays += r.centralLineDays || 0;
      totalCathDays += r.urinaryCatheterDays || 0;
    }

    return NextResponse.json({
      records,
      totals: {
        patientDays: totalPatientDays,
        ventilatorDays: totalVentDays,
        centralLineDays: totalCLDays,
        urinaryCatheterDays: totalCathDays,
      },
    });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'infection_control.view' }
);

/**
 * POST /api/infection-control/device-days
 * Records or updates a single day's device-day count for a department.
 * Uses upsert with unique constraint on [tenantId, department, recordDate].
 */
export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }) => {
    const body = await req.json();
    const { recordDate, department, patientDays, ventilatorDays, centralLineDays, urinaryCatheterDays } = body;

    if (!recordDate || !department) {
      return NextResponse.json({ error: 'recordDate and department are required' }, { status: 400 });
    }

    // Validate non-negative integers
    const pd = Math.max(0, parseInt(patientDays) || 0);
    const vd = Math.max(0, parseInt(ventilatorDays) || 0);
    const cl = Math.max(0, parseInt(centralLineDays) || 0);
    const uc = Math.max(0, parseInt(urinaryCatheterDays) || 0);

    const date = new Date(recordDate + 'T00:00:00Z');
    if (isNaN(date.getTime())) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
    }

    const record = await prisma.deviceDayRecord?.upsert?.({
      where: {
        tenantId_department_recordDate: {
          tenantId,
          department,
          recordDate: date,
        },
      },
      update: {
        patientDays: pd,
        ventilatorDays: vd,
        centralLineDays: cl,
        urinaryCatheterDays: uc,
        recordedBy: userId,
      },
      create: {
        tenantId,
        recordDate: date,
        department,
        patientDays: pd,
        ventilatorDays: vd,
        centralLineDays: cl,
        urinaryCatheterDays: uc,
        recordedBy: userId,
      },
    }).catch((e: unknown) => {
      throw new Error(`Failed to save device-day record: ${(e as any).message}`);
    });

    return NextResponse.json({ success: true, record });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'infection_control.manage' }
);
