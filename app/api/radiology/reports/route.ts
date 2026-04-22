import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/radiology/reports
 *
 * List radiology reports. Supports filtering by orderId, patientId, status.
 */
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const orderId = req.nextUrl.searchParams.get('orderId');
    const patientId = req.nextUrl.searchParams.get('patientId');
    const status = req.nextUrl.searchParams.get('status');
    const modality = req.nextUrl.searchParams.get('modality');
    const search = req.nextUrl.searchParams.get('search') || '';

    const where: Prisma.RadiologyReportWhereInput = { tenantId };
    if (orderId) where.orderId = orderId;
    if (patientId) where.patientId = patientId;
    if (status) where.status = status;
    if (modality) where.modality = modality.toUpperCase();
    if (search) {
      where.OR = [
        { examName: { contains: search, mode: 'insensitive' } },
        { findings: { contains: search, mode: 'insensitive' } },
        { impression: { contains: search, mode: 'insensitive' } },
        { patientId: search },
      ];
    }

    const reports = await prisma.radiologyReport.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({ reports });
  }),
  { tenantScoped: true, permissionKey: 'radiology.reports.view' }
);
