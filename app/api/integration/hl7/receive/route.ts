import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { validateBody } from '@/lib/validation/helpers';
import { validateHL7ApiKey } from '@/lib/integrations/hl7Auth';
import { parseHL7Message, extractLabResults, extractADTEvent, detectMessageType } from '@/lib/integration/hl7/parser';
import { processORU } from '@/lib/integrations/hl7/oruProcessor';
import { logMessage, updateMessageStatus, updateInstrumentHeartbeat } from '@/lib/integration/messageQueue';
import { evaluateAutoValidation, type ValidationInput } from '@/lib/lab/autoValidation';
import { checkCriticalValue } from '@/lib/lab/criticalValues';
import { v4 as uuidv4 } from 'uuid';
import { processADTEvent } from '@/lib/integration/hl7/adtProcessor';

const hl7JsonSchema = z.object({
  message: z.string().min(1, 'message is required'),
  instrumentId: z.string().optional(),
}).passthrough();

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * POST /api/integration/hl7/receive
 *
 * Enhanced HL7 message receiver:
 * 1. Parse message (ORU, ORM, ADT, ACK)
 * 2. Log to integration_messages
 * 3. For ORU^R01: auto-import results, run auto-validation, detect critical values
 * 4. Update instrument heartbeat
 * 5. Return ACK
 */
export const POST = withErrorHandler(async (req: NextRequest) => {
  // Validate integration API key (global env key or per-tenant DB key)
  const authResult = await validateHL7ApiKey(req);
  if (authResult instanceof NextResponse) return authResult;

  const contentType = req.headers.get('content-type');
  let rawMessage: string;
  let instrumentId = '';

  if (contentType?.includes('application/json')) {
    const body = await req.json();
    const v = validateBody(body, hl7JsonSchema);
    if ('error' in v) return v.error;
    rawMessage = v.data.message;
    instrumentId = v.data.instrumentId || '';
  } else {
    rawMessage = await req.text();
  }

  if (!rawMessage) {
    return NextResponse.json({ error: 'No HL7 message provided' }, { status: 400 });
  }

  const messageType = detectMessageType(rawMessage);

  const { tenantId } = authResult;

  // Log incoming message
  const logEntry = await logMessage(tenantId, {
    direction: 'INBOUND',
    protocol: 'HL7',
    messageType,
    instrumentId,
    rawMessage,
    status: 'RECEIVED',
  });

  // Update instrument heartbeat if provided
  if (instrumentId) {
    await updateInstrumentHeartbeat(tenantId, instrumentId).catch(() => {});
  }

  try {
    // Process based on message type
    if (messageType.startsWith('ORU')) {
      return await handleORU(tenantId, rawMessage, logEntry.id);
    }

    if (messageType.startsWith('ADT')) {
      return await handleADT(tenantId, rawMessage, logEntry.id);
    }

    // For other types, just log and ACK
    const result = processORU(rawMessage, { receivingApplication: 'Thea_EHR', receivingFacility: 'Thea' });
    await updateMessageStatus(tenantId, logEntry.id, 'PROCESSED');

    return new NextResponse(result.ackMessage, {
      status: 200,
      headers: { 'Content-Type': 'application/hl7-v2' },
    });
  } catch (error) {
    await updateMessageStatus(tenantId, logEntry.id, 'FAILED', {
      errorMessage: String(error),
    });
    return NextResponse.json({ error: 'Processing failed', detail: String(error) }, { status: 500 });
  }
});

// ---------------------------------------------------------------------------
// ORU^R01 Handler — Auto-import lab results
// ---------------------------------------------------------------------------

async function handleORU(tenantId: string, rawMessage: string, logId: string) {
  const result = processORU(rawMessage, { receivingApplication: 'Thea_EHR', receivingFacility: 'Thea' });

  if (!result.success || result.results.length === 0) {
    await updateMessageStatus(tenantId, logId, result.success ? 'PROCESSED' : 'FAILED', {
      errorMessage: result.errors.join('; '),
      parsedData: { messageId: result.messageId, resultCount: result.results.length },
    });

    return new NextResponse(result.ackMessage, {
      status: result.success ? 200 : 400,
      headers: { 'Content-Type': 'application/hl7-v2' },
    });
  }

  // Try to match to existing order
  const firstResult = result.results[0];
  const matchedOrder = await prisma.ordersHub.findFirst({
    where: {
      tenantId,
      kind: 'LAB',
      OR: [
        { id: firstResult.orderId },
        { orderCode: firstResult.testCode },
      ],
    },
  });

  if (matchedOrder) {
    // Save results via lab_results
    const now = new Date();
    const parameters = result.results.map((r) => ({
      parameterId: r.testCode,
      code: r.testCode,
      name: r.testName,
      value: r.value,
      unit: r.unit,
      flag: r.abnormalFlag,
      referenceRange: r.referenceRange,
    }));

    await prisma.labResult.create({
      data: {
        tenantId,
        testId: matchedOrder.id,
        orderId: matchedOrder.id,
        patientId: matchedOrder.patientMasterId,
        encounterId: matchedOrder.encounterCoreId,
        testCode: matchedOrder.orderCode,
        testName: matchedOrder.orderName,
        parameters,
        status: 'RESULTED',
        comments: `HL7 auto-import: ${result.messageId}`,
      },
    });

    // Update order status
    await prisma.ordersHub.update({
      where: { id: matchedOrder.id },
      data: { status: 'COMPLETED', completedAt: now },
    });

    // Check critical values
    const alerts: Record<string, unknown>[] = [];
    for (const r of result.results) {
      if (r.valueNumeric !== undefined) {
        const critCheck = checkCriticalValue(r.testCode, r.valueNumeric);
        if (critCheck.isCritical) {
          alerts.push({
            testCode: r.testCode,
            testName: r.testName,
            value: r.valueNumeric,
            unit: r.unit,
            criticalType: critCheck.type,
            threshold: critCheck.threshold,
          });
        }
      }
    }

    await updateMessageStatus(tenantId, logId, 'PROCESSED', {
      parsedData: {
        messageId: result.messageId,
        matchedOrderId: matchedOrder.id,
        resultCount: result.results.length,
        criticalAlerts: alerts.length,
      },
    });
  } else {
    // No match — log as processed with unmatched flag
    await updateMessageStatus(tenantId, logId, 'PROCESSED', {
      parsedData: {
        messageId: result.messageId,
        resultCount: result.results.length,
        matched: false,
      },
    });
  }

  return new NextResponse(result.ackMessage, {
    status: 200,
    headers: { 'Content-Type': 'application/hl7-v2' },
  });
}

// ---------------------------------------------------------------------------
// ADT Handler
// ---------------------------------------------------------------------------

async function handleADT(tenantId: string, rawMessage: string, logId: string) {
  const { parseHL7Message } = await import('@/lib/integrations/hl7/parser');
  const message = parseHL7Message(rawMessage);
  const { extractADTEvent: extract } = await import('@/lib/integration/hl7/parser');
  const adtEvent = extract(message);

  if (adtEvent) {
    await prisma.integrationAdtEvent.create({
      data: {
        tenantId,
        messageId: adtEvent.messageId,
        eventType: adtEvent.eventType,
        patientId: adtEvent.patientId,
        patientName: adtEvent.patientName,
        dateOfBirth: adtEvent.dateOfBirth,
        sex: adtEvent.sex,
        patientClass: adtEvent.patientClass,
        assignedLocation: adtEvent.assignedLocation,
        attendingDoctor: adtEvent.attendingDoctor,
        admitDateTime: adtEvent.admitDateTime ? new Date(adtEvent.admitDateTime) : null,
        dischargeDateTime: adtEvent.dischargeDateTime ? new Date(adtEvent.dischargeDateTime) : null,
        visitNumber: adtEvent.visitNumber,
      },
    });

    // Process the ADT event — create/update encounters, episodes, patient demographics
    const processResult = await processADTEvent(tenantId, adtEvent);

    await updateMessageStatus(tenantId, logId, processResult.success ? 'PROCESSED' : 'FAILED', {
      parsedData: {
        ...adtEvent as unknown as Record<string, unknown>,
        processResult: {
          success: processResult.success,
          actions: processResult.actions,
          errors: processResult.errors,
        },
      },
    });

    // If processing failed critically, return error ACK
    if (processResult.ackCode === 'AE' && !processResult.success) {
      const { buildACK } = await import('@/lib/integrations/hl7/builder');
      const errorAck = buildACK({
        originalControlId: message.controlId,
        sendingApplication: 'Thea_EHR',
        sendingFacility: 'Thea',
        receivingApplication: message.header.sendingApplication,
        receivingFacility: message.header.sendingFacility,
        ackCode: 'AE',
        errorMessage: processResult.errors.join('; '),
      });
      return new NextResponse(errorAck, {
        status: 200,
        headers: { 'Content-Type': 'application/hl7-v2' },
      });
    }
  } else {
    await updateMessageStatus(tenantId, logId, 'PROCESSED', {
      parsedData: { note: 'ADT event could not be parsed' },
    });
  }

  // Build ACK
  const { buildACK } = await import('@/lib/integrations/hl7/builder');
  const ack = buildACK({
    originalControlId: message.controlId,
    sendingApplication: 'Thea_EHR',
    sendingFacility: 'Thea',
    receivingApplication: message.header.sendingApplication,
    receivingFacility: message.header.sendingFacility,
    ackCode: 'AA',
  });

  return new NextResponse(ack, {
    status: 200,
    headers: { 'Content-Type': 'application/hl7-v2' },
  });
}
