import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import {
  createTransportRequest,
  getTransportRequests,
  checkStatEscalation,
} from '@/lib/transport/transportEngine';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const createRequestSchema = z.object({
  patientId: z.string().min(1, 'patientId is required'),
  patientName: z.string().optional(),
  encounterId: z.string().optional(),
  requestType: z.enum(['intra_facility', 'inter_facility', 'ambulance', 'discharge']),
  urgency: z.enum(['stat', 'urgent', 'routine', 'scheduled']).default('routine'),
  origin: z.string().min(1, 'origin is required'),
  originDetails: z.string().optional(),
  destination: z.string().min(1, 'destination is required'),
  destinationDetails: z.string().optional(),
  scheduledAt: z.string().datetime().optional(),
  transportMode: z
    .enum(['wheelchair', 'stretcher', 'bed', 'ambulatory', 'ambulance', 'neonatal_isolette'])
    .default('wheelchair'),
  oxygenRequired: z.boolean().default(false),
  monitorRequired: z.boolean().default(false),
  ivPumpRequired: z.boolean().default(false),
  isolationRequired: z.boolean().default(false),
  isolationType: z.enum(['contact', 'droplet', 'airborne']).optional(),
  nurseEscort: z.boolean().default(false),
  specialInstructions: z.string().optional(),
  notes: z.string().optional(),
});

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ---------------------------------------------------------------------------
// GET /api/transport/requests
// Query: status, urgency, dateFrom, dateTo, limit, escalation
// ---------------------------------------------------------------------------

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || undefined;
    const urgency = searchParams.get('urgency') || undefined;
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const limit = searchParams.get('limit');
    const escalation = searchParams.get('escalation');

    // Check for stat escalation alerts
    if (escalation === 'true') {
      const escalated = await checkStatEscalation(tenantId);
      return NextResponse.json({ escalated });
    }

    const items = await getTransportRequests(tenantId, {
      status,
      urgency,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });

    return NextResponse.json({ items, total: items.length });
  }),
  {
    tenantScoped: true,
    platformKey: 'thea_health',
    permissionKey: 'transport.view',
  },
);

// ---------------------------------------------------------------------------
// POST /api/transport/requests — Create a new transport request
// ---------------------------------------------------------------------------

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }) => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = createRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const data = parsed.data;

    // Safety alert for isolation requirements
    const isolationAlert =
      data.isolationRequired
        ? {
            warning: true,
            message: 'Patient requires isolation precautions during transport',
            messageAr: 'المريض يحتاج احتياطات عزل أثناء النقل',
            isolationType: data.isolationType,
          }
        : null;

    const request = await createTransportRequest({
      tenantId,
      patientId: data.patientId,
      patientName: data.patientName,
      encounterId: data.encounterId,
      requestType: data.requestType,
      urgency: data.urgency,
      origin: data.origin,
      originDetails: data.originDetails,
      destination: data.destination,
      destinationDetails: data.destinationDetails,
      requestedBy: userId,
      requestedByName: (user as any).name || user.displayName || undefined,
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined,
      transportMode: data.transportMode,
      oxygenRequired: data.oxygenRequired,
      monitorRequired: data.monitorRequired,
      ivPumpRequired: data.ivPumpRequired,
      isolationRequired: data.isolationRequired,
      isolationType: data.isolationType,
      nurseEscort: data.nurseEscort,
      specialInstructions: data.specialInstructions,
      notes: data.notes,
    });

    return NextResponse.json(
      { request, isolationAlert },
      { status: 201 },
    );
  }),
  {
    tenantScoped: true,
    platformKey: 'thea_health',
    permissionKey: 'transport.create',
  },
);
