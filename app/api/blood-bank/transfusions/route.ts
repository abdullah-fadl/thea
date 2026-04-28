import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/blood-bank/transfusions
 * List transfusions. Supports filtering by patientMasterId, requestId, status.
 */
export const GET = withAuthTenant(
  async (req: NextRequest, { tenantId }: { tenantId: string }) => {
    try {
      const url = req.nextUrl;
      const patientMasterId = url.searchParams.get('patientMasterId');
      const requestId = url.searchParams.get('requestId');
      const status = url.searchParams.get('status');

      const where: any = { tenantId };
      if (patientMasterId) where.patientMasterId = patientMasterId;
      if (requestId) where.requestId = requestId;
      if (status) where.status = status;

      const transfusions = await prisma.transfusion.findMany({
        where,
        orderBy: { startTime: 'desc' },
        take: 100,
      });

      return NextResponse.json({ transfusions });
    } catch {
      return NextResponse.json({ error: 'Failed to fetch transfusions' }, { status: 500 });
    }
  },
  { permissionKey: 'blood_bank.view' }
);

/**
 * POST /api/blood-bank/transfusions
 * Start a transfusion.
 * Body: { requestId, unitNumber, patientMasterId, rate, preVitals }
 */
export const POST = withAuthTenant(
  async (req: NextRequest, { tenantId, userId }: { tenantId: string; userId: string }) => {
    try {
      const body = await req.json();
      const { requestId, unitNumber, patientMasterId, rate, preVitals } = body;

      if (!requestId || !unitNumber || !patientMasterId) {
        return NextResponse.json(
          { error: 'requestId, unitNumber, and patientMasterId are required' },
          { status: 400 }
        );
      }

      // Validate that the blood unit exists and is AVAILABLE
      const unit = await prisma.bloodUnit.findFirst({
        where: { unitNumber, tenantId, status: 'AVAILABLE' },
      });
      if (!unit) {
        return NextResponse.json(
          { error: 'Blood unit not found or not available' },
          { status: 404 }
        );
      }

      // Validate that the request exists
      const request = await prisma.bloodBankRequest.findFirst({
        where: { id: requestId, tenantId },
      });
      if (!request) {
        return NextResponse.json({ error: 'Blood bank request not found' }, { status: 404 });
      }

      // Start transfusion in a transaction-style: mark unit RESERVED and create transfusion
      const transfusion = await prisma.transfusion.create({
        data: {
          tenantId,
          requestId,
          unitNumber,
          patientMasterId,
          administeredBy: userId,
          startTime: new Date(),
          rate: rate ?? null,
          preVitals: preVitals ?? null,
          monitoringLog: [],
          status: 'IN_PROGRESS',
        },
      });

      // Mark unit as TRANSFUSING
      await prisma.bloodUnit.update({
        where: { id: unit.id },
        data: { status: 'TRANSFUSING', reservedFor: patientMasterId },
      });

      // Update request status to TRANSFUSING
      await prisma.bloodBankRequest.update({
        where: { id: requestId },
        data: { status: 'TRANSFUSING' },
      });

      return NextResponse.json({ transfusion }, { status: 201 });
    } catch {
      return NextResponse.json({ error: 'Failed to start transfusion' }, { status: 500 });
    }
  },
  { permissionKey: 'blood_bank.transfuse' }
);
