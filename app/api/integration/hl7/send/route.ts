import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { validateBody } from '@/lib/validation/helpers';
import { buildORMWithORC } from '@/lib/integration/hl7/builder';
import { logMessage } from '@/lib/integration/messageQueue';

const sendOrderSchema = z.object({
  instrumentId: z.string().min(1),
  orderId: z.string().min(1),
  patientId: z.string().min(1),
  patientName: z.string().min(1),
  dateOfBirth: z.string().optional(),
  sex: z.string().optional(),
  tests: z.array(z.object({
    code: z.string().min(1),
    name: z.string().min(1),
    priority: z.enum(['R', 'S', 'A', 'P']).optional(),
  })),
  orderingProvider: z.string().optional(),
  clinicalInfo: z.string().optional(),
});

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * POST /api/integration/hl7/send
 *
 * Build and send an ORM^O01 order message to an instrument.
 * The message is built and returned; actual transmission to the
 * instrument is handled by middleware (Mirth Connect) or direct TCP.
 */
export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const body = await req.json().catch(() => ({}));
    const v = validateBody(body, sendOrderSchema);
    if ('error' in v) return v.error;
    const data = v.data;

    // Look up instrument config
    const instrument = await prisma.instrument.findFirst({
      where: { tenantId, id: data.instrumentId },
    });

    if (!instrument) {
      return NextResponse.json({ error: 'Instrument not found' }, { status: 404 });
    }

    // Build HL7 ORM message
    const hl7Message = buildORMWithORC({
      sendingApplication: 'Thea_EHR',
      sendingFacility: 'Thea',
      receivingApplication: String(instrument.name || 'INSTRUMENT'),
      receivingFacility: String(instrument.department || 'LAB'),
      patientId: data.patientId,
      patientName: data.patientName,
      dateOfBirth: data.dateOfBirth || '',
      sex: data.sex || '',
      orderId: data.orderId,
      orderControl: 'NW',
      orderDateTime: new Date(),
      tests: data.tests,
      orderingProvider: data.orderingProvider || '',
      clinicalInfo: data.clinicalInfo,
    });

    // Log outbound message
    await logMessage(tenantId, {
      direction: 'OUTBOUND',
      protocol: 'HL7',
      messageType: 'ORM_O01',
      instrumentId: data.instrumentId,
      rawMessage: hl7Message,
      status: 'PROCESSED',
      parsedData: {
        orderId: data.orderId,
        patientId: data.patientId,
        tests: data.tests.map((t) => t.code),
      },
    });

    // If instrument has HTTP endpoint, attempt to send
    if (instrument.connectionType === 'http' && instrument.host) {
      try {
        const url = `${instrument.host}:${instrument.port || 80}`;
        await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/hl7-v2' },
          body: hl7Message,
          signal: AbortSignal.timeout(10000),
        });
      } catch {
        // Non-fatal — message is logged and can be retried
      }
    }

    return NextResponse.json({
      success: true,
      message: hl7Message,
      instrumentId: data.instrumentId,
      orderId: data.orderId,
    });
  }),
  { tenantScoped: true, permissionKey: 'lab.results.create' },
);
