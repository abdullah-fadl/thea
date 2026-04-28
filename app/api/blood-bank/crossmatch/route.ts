import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';

const db = prisma as unknown as Record<string, Record<string, (...args: any[]) => Promise<any>>>;

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const VALID_URGENCIES = ['ROUTINE', 'URGENT', 'EMERGENT', 'MASSIVE'] as const;
const VALID_CROSSMATCH_TYPES = ['ELECTRONIC', 'IMMEDIATE_SPIN', 'FULL'] as const;
const VALID_STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPATIBLE', 'INCOMPATIBLE', 'CANCELLED'] as const;
const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;

/**
 * GET /api/blood-bank/crossmatch
 * List crossmatch requests with optional filters: status, urgency, bloodType
 */
export const GET = withAuthTenant(
  async (req: NextRequest, { tenantId }: { tenantId: string }) => {
    try {
      const url = req.nextUrl;
      const status = url.searchParams.get('status');
      const urgency = url.searchParams.get('urgency');
      const bloodType = url.searchParams.get('bloodType');

      const where: any = { tenantId };
      if (status && (VALID_STATUSES as readonly string[]).includes(status)) where.status = status;
      if (urgency && (VALID_URGENCIES as readonly string[]).includes(urgency)) where.urgency = urgency;
      if (bloodType && (BLOOD_TYPES as readonly string[]).includes(bloodType)) where.bloodType = bloodType;

      const items = await db.bloodBankRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 200,
      });

      return NextResponse.json({ items });
    } catch (err) {
      logger.error('Failed to fetch crossmatch requests', { error: err, tenantId, category: 'api' });
      return NextResponse.json({ error: 'Failed to fetch crossmatch requests' }, { status: 500 });
    }
  },
  { permissionKey: 'blood_bank.view' }
);

/**
 * POST /api/blood-bank/crossmatch
 * Create a new crossmatch request.
 */
export const POST = withAuthTenant(
  async (req: NextRequest, { tenantId, userId }: { tenantId: string; userId: string }) => {
    try {
      const body = await req.json();
      const {
        patientMasterId,
        bloodType,
        component,
        unitsRequested,
        urgency,
        crossmatchType,
        indication,
        episodeId,
        encounterId,
        consentObtained,
      } = body;

      if (!patientMasterId || !bloodType || !component || !urgency || !crossmatchType) {
        return NextResponse.json(
          { error: 'patientMasterId, bloodType, component, urgency, and crossmatchType are required' },
          { status: 400 }
        );
      }

      if (!VALID_URGENCIES.includes(urgency)) {
        return NextResponse.json({ error: 'Invalid urgency value' }, { status: 400 });
      }
      if (!VALID_CROSSMATCH_TYPES.includes(crossmatchType)) {
        return NextResponse.json({ error: 'Invalid crossmatchType value' }, { status: 400 });
      }
      if (!BLOOD_TYPES.includes(bloodType)) {
        return NextResponse.json({ error: 'Invalid bloodType value' }, { status: 400 });
      }

      const request = await db.bloodBankRequest.create({
        data: {
          tenantId,
          patientMasterId,
          bloodType,
          products: [{ product: component, units: unitsRequested || 1 }],
          urgency,
          crossmatch: true,
          indication: indication || `Crossmatch request - ${crossmatchType}`,
          status: 'PENDING',
          requestedBy: userId,
          consentObtained: consentObtained ?? false,
          episodeId: episodeId || null,
          encounterId: encounterId || null,
        },
      });

      logger.info('Crossmatch request created', { tenantId, userId, requestId: request.id, category: 'clinical' });
      return NextResponse.json({ request }, { status: 201 });
    } catch (err) {
      logger.error('Failed to create crossmatch request', { error: err, tenantId, category: 'api' });
      return NextResponse.json({ error: 'Failed to create crossmatch request' }, { status: 500 });
    }
  },
  { permissionKey: 'blood_bank.request' }
);
