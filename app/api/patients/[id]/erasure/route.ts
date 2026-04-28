import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { createAuditLog } from '@/lib/utils/audit';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/patients/[id]/erasure
 * Submit a PDPL Right to Erasure request for a patient.
 */
export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }, params) => {
    const routeParams = (params && typeof params === 'object')
      ? params as Record<string, string | string[]>
      : {};
    const patientId = String(routeParams.id || '').trim();

    if (!patientId) {
      return NextResponse.json({ error: 'Patient ID is required' }, { status: 400 });
    }

    // Validate patient exists in this tenant
    const patient = await prisma.ehrPatient.findFirst({
      where: { tenantId, id: patientId },
      select: { id: true, mrn: true },
    });

    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
    }

    // Parse body
    const body = (await req.json()) as Record<string, unknown>;
    const reason = typeof body.reason === 'string' ? body.reason.trim() : null;

    if (!reason) {
      return NextResponse.json(
        { error: 'A reason is required for data erasure requests' },
        { status: 400 },
      );
    }

    // Check for existing pending/approved request
    const existingRequest = await prisma.dataErasureRequest.findFirst({
      where: {
        tenantId,
        patientId,
        status: { in: ['pending', 'approved'] },
      },
    });

    if (existingRequest) {
      return NextResponse.json(
        {
          error: 'An active erasure request already exists for this patient',
          existingRequestId: existingRequest.id,
          existingStatus: existingRequest.status,
        },
        { status: 409 },
      );
    }

    // Create the erasure request
    const erasureRequest = await prisma.dataErasureRequest.create({
      data: {
        tenantId,
        patientId,
        requestedBy: userId,
        reason,
        status: 'pending',
      },
    });

    // Audit log
    logger.info('PDPL erasure request created', {
      category: 'privacy',
      tenantId,
      patientId,
      requestId: erasureRequest.id,
      requestedBy: userId,
    });

    await createAuditLog(
      'data_erasure_request',
      erasureRequest.id,
      'CREATE',
      userId,
      user?.email ?? undefined,
      {
        patientId,
        reason,
        status: 'pending',
        action: 'pdpl_erasure_request_submitted',
      },
      tenantId,
      req,
    );

    return NextResponse.json({
      success: true,
      message: 'Erasure request submitted successfully. Awaiting review.',
      request: erasureRequest,
    }, { status: 201 });
  }),
  {
    tenantScoped: true,
    platformKey: 'thea_health',
    permissionKey: 'admin.data.manage',
  },
);

/**
 * GET /api/patients/[id]/erasure
 * Retrieve all erasure requests for a patient.
 */
export const GET = withAuthTenant(
  withErrorHandler(async (_req: NextRequest, { tenantId }, params) => {
    const routeParams = (params && typeof params === 'object')
      ? params as Record<string, string | string[]>
      : {};
    const patientId = String(routeParams.id || '').trim();

    if (!patientId) {
      return NextResponse.json({ error: 'Patient ID is required' }, { status: 400 });
    }

    const requests = await prisma.dataErasureRequest.findMany({
      where: { tenantId, patientId },
      orderBy: { requestedAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({ requests });
  }),
  {
    tenantScoped: true,
    platformKey: 'thea_health',
    permissionKey: 'admin.data.manage',
  },
);
