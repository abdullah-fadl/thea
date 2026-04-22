import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import prisma from '@/lib/db/prisma';

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }: { tenantId: string; userId: string }) => {
    const { searchParams } = new URL(req.url);
    const period = searchParams.get('period') || '30';
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - Number(period));

    const [
      totalPatients,
      newPatientsThisPeriod,
      opdBookings,
      completedOpdBookings,
      activeIpdEpisodes,
      dischargedThisPeriod,
      labOrders,
      radiologyOrders,
      pendingOrders,
      criticalAlerts,
      incidentsThisPeriod,
    ] = await Promise.all([
      prisma.patientMaster.count({ where: { tenantId } }).catch(() => 0),
      prisma.patientMaster.count({ where: { tenantId, createdAt: { gte: daysAgo } } }).catch(() => 0),
      prisma.opdBooking.count({ where: { tenantId, createdAt: { gte: daysAgo } } }).catch(() => 0),
      prisma.opdBooking.count({ where: { tenantId, status: 'COMPLETED', createdAt: { gte: daysAgo } } }).catch(() => 0),
      prisma.ipdEpisode.count({ where: { tenantId, status: 'ACTIVE' } }).catch(() => 0),
      prisma.ipdEpisode.count({ where: { tenantId, status: 'DISCHARGED', updatedAt: { gte: daysAgo } } }).catch(() => 0),
      prisma.ordersHub.count({ where: { tenantId, kind: 'LAB', createdAt: { gte: daysAgo } } }).catch(() => 0),
      prisma.ordersHub.count({ where: { tenantId, kind: 'RADIOLOGY', createdAt: { gte: daysAgo } } }).catch(() => 0),
      prisma.ordersHub.count({ where: { tenantId, status: 'ORDERED' } }).catch(() => 0),
      prisma.labResult.count({ where: { tenantId, status: 'VERIFIED', createdAt: { gte: daysAgo } } }).catch(() => 0),
      prisma.qualityIncident.count({ where: { tenantId, createdAt: { gte: daysAgo } } }).catch(() => 0),
    ]);

    const opdCompletionRate =
      opdBookings > 0 ? Math.round((completedOpdBookings / opdBookings) * 100) : 0;

    return NextResponse.json({
      period: Number(period),
      patients: {
        total: totalPatients,
        newThisPeriod: newPatientsThisPeriod,
      },
      opd: {
        bookings: opdBookings,
        completed: completedOpdBookings,
        completionRate: opdCompletionRate,
      },
      ipd: {
        activeAdmissions: activeIpdEpisodes,
        dischargesThisPeriod: dischargedThisPeriod,
      },
      orders: {
        lab: labOrders,
        radiology: radiologyOrders,
        pending: pendingOrders,
      },
      alerts: {
        criticalLabs: criticalAlerts,
      },
      quality: {
        incidents: incidentsThisPeriod,
      },
    });
  }),
  { permissionKey: 'analytics.view' },
);
