/**
 * SCM — SFDA Drug Track & Trace Submission
 *
 * POST /api/imdad/integrations/sfda/track-trace
 *
 * Submits drug track & trace serialization data to SFDA for supply chain
 * compliance. Phase 5 stub — actual SFDA endpoints TBD.
 */

import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { sfdaClient } from '@/lib/imdad/integrations/sfda';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const trackTraceSchema = z.object({
  organizationId: z.string().uuid('organizationId must be a valid UUID'),
  gtin: z.string().min(1, 'gtin is required').max(14, 'gtin must be 14 characters or fewer'),
  serialNumber: z.string().min(1, 'serialNumber is required').max(50),
  batchNumber: z.string().min(1, 'batchNumber is required').max(50),
  expiryDate: z.string().min(1, 'expiryDate is required'),
  eventType: z.enum(['RECEIVED', 'DISPENSED', 'RETURNED', 'DESTROYED', 'TRANSFERRED']),
  sourceLocationId: z.string().optional(),
  destinationLocationId: z.string().optional(),
  eventTimestamp: z.string().min(1, 'eventTimestamp is required'),
  quantity: z.number().int().positive('quantity must be a positive integer'),
  unitOfMeasure: z.string().min(1, 'unitOfMeasure is required').max(20),
});

export const POST = withAuthTenant(
  async (req, { tenantId }) => {
    try {
      const body = await req.json();
      const parsed = trackTraceSchema.parse(body);

      const { organizationId, ...traceData } = parsed;

      const result = await sfdaClient.submitDrugTrackAndTrace(
        traceData,
        tenantId,
        organizationId,
      );

      if (!result.success) {
        return NextResponse.json(
          { error: result.error, errorCode: result.errorCode },
          { status: 502 },
        );
      }

      return NextResponse.json({ data: result.data }, { status: 201 });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) },
          { status: 400 },
        );
      }
      return NextResponse.json(
        { error: 'Internal Server Error' },
        { status: 500 },
      );
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.integrations.sfda.track_trace' },
);
