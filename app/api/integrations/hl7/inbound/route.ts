import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import { validateHL7ApiKey } from '@/lib/integrations/hl7Auth';
import {
  parseHL7Message,
  getSegment,
  getSegments,
  parsePID,
  parseOBR,
  parseOBX,
  parseHL7DateTime,
  buildACKMessage,
  extractAccessionNumber,
  type HL7Message,
} from '@/lib/integrations/hl7/parser';
import { buildACK } from '@/lib/integrations/hl7/builder';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * POST /api/integrations/hl7/inbound
 *
 * HL7 v2.x inbound message receiver for lab analyzers and LIS systems.
 *
 * Accepts:
 *   - Content-Type: text/plain (raw HL7 pipe-delimited)
 *   - Content-Type: application/json with { message: string }
 *   - Content-Type: application/hl7-v2
 *
 * Supports:
 *   - ORU^R01: Lab results — parsed, stored, and matched to existing orders
 *   - ORM^O01: Orders — logged for acknowledgement
 *
 * Authentication: API key via x-api-key header (machine-to-machine)
 * No user auth required.
 *
 * Returns: HL7 ACK message (Content-Type: application/hl7-v2)
 */
export const POST = withErrorHandler(async (req: NextRequest) => {
  // -------------------------------------------------------------------------
  // 1. Validate API key (global env key or per-tenant DB key)
  // -------------------------------------------------------------------------
  const authResult = await validateHL7ApiKey(req);
  if (authResult instanceof NextResponse) return authResult;

  // -------------------------------------------------------------------------
  // 2. Extract raw HL7 message from request body
  // -------------------------------------------------------------------------
  const contentType = req.headers.get('content-type') || '';
  let rawMessage: string;

  if (contentType.includes('application/json')) {
    const body = await req.json().catch(() => ({}));
    rawMessage = body.message || '';
  } else {
    // text/plain or application/hl7-v2
    rawMessage = await req.text();
  }

  if (!rawMessage || !rawMessage.trim()) {
    return new NextResponse(
      buildACK({
        originalControlId: 'UNKNOWN',
        sendingApplication: 'Thea_EHR',
        sendingFacility: 'Thea',
        receivingApplication: 'UNKNOWN',
        receivingFacility: 'UNKNOWN',
        ackCode: 'AR',
        errorMessage: 'Empty HL7 message',
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/hl7-v2' },
      }
    );
  }

  // -------------------------------------------------------------------------
  // 3. Parse the HL7 message
  // -------------------------------------------------------------------------
  let message: HL7Message;
  try {
    message = parseHL7Message(rawMessage);
  } catch (parseError) {
    logger.error('HL7 inbound parse error', {
      category: 'integration',
      error: parseError instanceof Error ? parseError : undefined,
    });

    return new NextResponse(
      buildACK({
        originalControlId: 'UNKNOWN',
        sendingApplication: 'Thea_EHR',
        sendingFacility: 'Thea',
        receivingApplication: 'UNKNOWN',
        receivingFacility: 'UNKNOWN',
        ackCode: 'AR',
        errorMessage: `Parse error: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/hl7-v2' },
      }
    );
  }

  const { tenantId } = authResult;
  const messageType = message.type; // e.g. 'ORU_R01', 'ORM_O01'

  logger.info(`HL7 inbound: ${messageType} from ${message.header.sendingApplication}`, {
    category: 'integration',
    controlId: message.controlId,
  });

  // -------------------------------------------------------------------------
  // 4. Handle ORU^R01 — Lab Results
  // -------------------------------------------------------------------------
  if (messageType.startsWith('ORU')) {
    return await handleORU(message, tenantId, rawMessage);
  }

  // -------------------------------------------------------------------------
  // 5. Handle ORM^O01 — Orders (log receipt only)
  // -------------------------------------------------------------------------
  if (messageType.startsWith('ORM')) {
    return await handleORM(message, tenantId, rawMessage);
  }

  // -------------------------------------------------------------------------
  // 6. Unsupported message type — accept but log
  // -------------------------------------------------------------------------
  logger.warn(`HL7 inbound: unsupported message type ${messageType}`, {
    category: 'integration',
    controlId: message.controlId,
  });

  return new NextResponse(
    buildACKMessage(message, 'AA', `Message type ${messageType} acknowledged but not processed`),
    {
      status: 200,
      headers: { 'Content-Type': 'application/hl7-v2' },
    }
  );
});

// =============================================================================
// ORU^R01 handler — Lab results
// =============================================================================

async function handleORU(
  message: HL7Message,
  tenantId: string,
  rawMessage: string
): Promise<NextResponse> {
  const errors: string[] = [];

  // Extract PID
  const pidSegment = getSegment(message, 'PID');
  if (!pidSegment) {
    errors.push('Missing PID segment');
    return new NextResponse(
      buildACKMessage(message, 'AE', 'Missing PID segment'),
      { status: 400, headers: { 'Content-Type': 'application/hl7-v2' } }
    );
  }

  const pid = parsePID(pidSegment);
  const patientId = pid.patientIdInternal || pid.patientIdExternal;
  const accessionNumber = extractAccessionNumber(message);

  // Try to match to an existing order by accession number
  let matchedOrderId: string | null = null;
  if (accessionNumber) {
    try {
      // Search in ordersHub and labOrder for matching accession number
      const order = await prisma.ordersHub.findFirst({
        where: {
          tenantId,
          OR: [
            { id: accessionNumber },
            { externalOrderId: accessionNumber },
          ],
          kind: 'LAB',
        } as any,
        select: { id: true },
      });
      if (order) {
        matchedOrderId = order.id;
      } else {
        // Try labOrder table as fallback
        const labOrder = await prisma.labOrder.findFirst({
          where: {
            tenantId,
            OR: [
              { id: accessionNumber },
              { specimenId: accessionNumber },
            ],
          },
          select: { id: true },
        });
        if (labOrder) {
          matchedOrderId = labOrder.id;
        }
      }
    } catch (err) {
      logger.warn('HL7 inbound: failed to match order', {
        category: 'integration',
        accessionNumber,
        error: err instanceof Error ? err : undefined,
      });
    }
  }

  // Process each OBR/OBX group
  let currentOBR: ReturnType<typeof parseOBR> | null = null;
  const storedResults: { id: string; testCode: string; matched: boolean }[] = [];

  for (const segment of message.segments) {
    if (segment.name === 'OBR') {
      currentOBR = parseOBR(segment);
    } else if (segment.name === 'OBX' && currentOBR) {
      const obx = parseOBX(segment);

      try {
        const incoming = await prisma.labResultIncoming.create({
          data: {
            tenantId,
            testCode: obx.observationIdentifier.identifier,
            testName: obx.observationIdentifier.text,
            value: obx.observationValue,
            unit: obx.units.identifier || obx.units.text,
            abnormalFlag: obx.abnormalFlags || null,
            referenceRange: obx.referenceRange || null,
            orderId: matchedOrderId || null,
            hl7MessageId: message.controlId,
            receivedAt: new Date(),
            processed: false,
          },
        });

        storedResults.push({
          id: incoming.id,
          testCode: obx.observationIdentifier.identifier,
          matched: !!matchedOrderId,
        });
      } catch (err) {
        logger.error('HL7 inbound: failed to store incoming result', {
          category: 'integration',
          error: err instanceof Error ? err : undefined,
        });
        errors.push(`Failed to store OBX set ${obx.setId}`);
      }
    }
  }

  // If order was matched, auto-populate lab result values
  if (matchedOrderId && storedResults.length > 0) {
    try {
      const obxResults = getSegments(message, 'OBX').map((seg) => {
        const obx = parseOBX(seg);
        return {
          code: obx.observationIdentifier.identifier,
          name: obx.observationIdentifier.text,
          value: obx.observationValue,
          unit: obx.units.identifier || obx.units.text,
          referenceRange: obx.referenceRange,
          abnormalFlag: obx.abnormalFlags,
          resultDateTime: obx.dateTimeOfObservation
            ? parseHL7DateTime(obx.dateTimeOfObservation).toISOString()
            : new Date().toISOString(),
        };
      });

      // Update any existing lab result for this order, or create one
      const existingResult = await prisma.labResult.findFirst({
        where: { tenantId, orderId: matchedOrderId },
      });

      if (existingResult) {
        await prisma.labResult.updateMany({
          where: { tenantId, id: existingResult.id },
          data: {
            parameters: obxResults as Prisma.InputJsonValue,
            status: 'RESULTED',
            resultedAt: new Date(),
            updatedAt: new Date(),
          },
        });
      }

      // Mark incoming records as processed
      for (const sr of storedResults) {
        await prisma.labResultIncoming.updateMany({
          where: { id: sr.id },
          data: { processed: true },
        });
      }
    } catch (err) {
      logger.warn('HL7 inbound: failed to auto-populate results', {
        category: 'integration',
        orderId: matchedOrderId,
        error: err instanceof Error ? err : undefined,
      });
    }
  }

  const ackCode = errors.length > 0 ? 'AE' : 'AA';
  return new NextResponse(
    buildACKMessage(message, ackCode, errors.length > 0 ? errors.join('; ') : undefined),
    {
      status: 200, // HL7 convention: always 200 for ACK, error details are in the MSA segment
      headers: { 'Content-Type': 'application/hl7-v2' },
    }
  );
}

// =============================================================================
// ORM^O01 handler — Orders (log receipt)
// =============================================================================

async function handleORM(
  message: HL7Message,
  tenantId: string,
  rawMessage: string
): Promise<NextResponse> {
  logger.info('HL7 inbound: ORM order message received', {
    category: 'integration',
    controlId: message.controlId,
    sendingApp: message.header.sendingApplication,
    sendingFacility: message.header.sendingFacility,
  });

  // Log the order message for auditing (store in incoming table as well)
  try {
    await prisma.labResultIncoming.create({
      data: {
        tenantId,
        testCode: 'ORM_ORDER',
        testName: `Order from ${message.header.sendingApplication}`,
        value: null,
        unit: null,
        abnormalFlag: null,
        referenceRange: null,
        orderId: null,
        hl7MessageId: message.controlId,
        receivedAt: new Date(),
        processed: false,
      },
    });
  } catch (err) {
    logger.warn('HL7 inbound: failed to log ORM message', {
      category: 'integration',
      error: err instanceof Error ? err : undefined,
    });
  }

  return new NextResponse(
    buildACKMessage(message, 'AA'),
    {
      status: 200,
      headers: { 'Content-Type': 'application/hl7-v2' },
    }
  );
}
