import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/blood-bank/requests
 * List blood bank requests with optional filters.
 */
export const GET = withAuthTenant(
  async (req: NextRequest, { tenantId }: { tenantId: string }) => {
    try {
      const url = req.nextUrl;
      const status = url.searchParams.get('status');
      const patientMasterId = url.searchParams.get('patientMasterId');
      const urgency = url.searchParams.get('urgency');
      const search = url.searchParams.get('search') || '';

      const where: any = { tenantId };
      if (status) where.status = status;
      if (patientMasterId) where.patientMasterId = patientMasterId;
      if (urgency) where.urgency = urgency;

      const items = await prisma.bloodBankRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 100,
      });

      return NextResponse.json({ items });
    } catch {
      return NextResponse.json({ error: 'Failed to fetch requests' }, { status: 500 });
    }
  },
  { permissionKey: 'blood_bank.view' }
);

/**
 * POST /api/blood-bank/requests
 * Create a new blood bank request.
 */
export const POST = withAuthTenant(
  async (req: NextRequest, { tenantId, userId }: { tenantId: string; userId: string }) => {
    try {
      const body = await req.json();
      const {
        patientMasterId,
        urgency,
        indication,
        bloodType,
        products,
        crossmatch,
        consentObtained,
        episodeId,
        encounterId,
      } = body;

      if (!patientMasterId || !urgency || !indication) {
        return NextResponse.json(
          { error: 'patientMasterId, urgency, and indication are required' },
          { status: 400 }
        );
      }

      const request = await prisma.bloodBankRequest.create({
        data: {
          tenantId,
          patientMasterId,
          urgency,
          indication,
          bloodType: bloodType || null,
          products: products || [],
          crossmatch: crossmatch ?? false,
          consentObtained: consentObtained ?? false,
          status: 'PENDING',
          requestedBy: userId,
          episodeId: episodeId || null,
          encounterId: encounterId || null,
        },
      });

      return NextResponse.json({ request }, { status: 201 });
    } catch {
      return NextResponse.json({ error: 'Failed to create request' }, { status: 500 });
    }
  },
  { permissionKey: 'blood_bank.request' }
);
