/**
 * Enhanced HL7 v2.x Message Parser
 *
 * Wraps and extends the existing parser with:
 * - ADT message support
 * - Typed message extraction (HL7LabResult, ADTEvent)
 * - Better error handling
 */

import {
  parseHL7Message as baseParseHL7Message,
  getSegment,
  getSegments,
  parsePID,
  parseOBR,
  parseOBX,
  parseHL7DateTime,
  formatHL7DateTime,
  type HL7Message,
} from '@/lib/integrations/hl7/parser';

import { parseORC, parsePV1 } from './segments';
import type {
  HL7LabResult,
  HL7ResultObservation,
  ADTEvent,
  AbnormalFlag,
  ResultStatus,
} from './types';

// Re-export base utilities
export { baseParseHL7Message as parseHL7Message, parseHL7DateTime, formatHL7DateTime, getSegment, getSegments };

// ---------------------------------------------------------------------------
// Extract typed HL7 Lab Result from ORU^R01
// ---------------------------------------------------------------------------

export function extractLabResults(message: HL7Message): HL7LabResult | null {
  if (!message.type.startsWith('ORU')) return null;

  const pidSegment = getSegment(message, 'PID');
  if (!pidSegment) return null;

  const pid = parsePID(pidSegment);

  const results: HL7ResultObservation[] = [];
  let currentOBR: ReturnType<typeof parseOBR> | null = null;
  let accession = '';

  for (const segment of message.segments) {
    if (segment.name === 'OBR') {
      currentOBR = parseOBR(segment);
      accession = currentOBR.fillerOrderNumber || currentOBR.placerOrderNumber || accession;
    } else if (segment.name === 'OBX' && currentOBR) {
      const obx = parseOBX(segment);

      let valueNumeric: number | undefined;
      const numVal = parseFloat(obx.observationValue);
      if (!Number.isNaN(numVal)) valueNumeric = numVal;

      results.push({
        testCode: obx.observationIdentifier.identifier,
        testName: obx.observationIdentifier.text,
        value: obx.observationValue,
        valueNumeric,
        unit: obx.units.identifier || obx.units.text,
        referenceRange: obx.referenceRange,
        abnormalFlag: (obx.abnormalFlags || 'N') as AbnormalFlag,
        status: (obx.observationResultStatus || 'F') as ResultStatus,
        observationDateTime: obx.dateTimeOfObservation
          ? parseHL7DateTime(obx.dateTimeOfObservation)
          : parseHL7DateTime(currentOBR.resultsReportedDateTime),
      });
    }
  }

  if (results.length === 0) return null;

  return {
    messageId: message.controlId,
    patientId: pid.patientIdInternal || pid.patientIdExternal,
    patientName: `${pid.patientName.familyName}, ${pid.patientName.givenName}`.trim(),
    orderId: currentOBR?.placerOrderNumber || '',
    accessionNumber: accession,
    results,
  };
}

// ---------------------------------------------------------------------------
// Extract ADT Event from ADT^A01-A08
// ---------------------------------------------------------------------------

export function extractADTEvent(message: HL7Message): ADTEvent | null {
  if (!message.type.startsWith('ADT')) return null;

  const pidSegment = getSegment(message, 'PID');
  if (!pidSegment) return null;

  const pid = parsePID(pidSegment);

  const pv1Segment = getSegment(message, 'PV1');
  const pv1 = pv1Segment ? parsePV1(pv1Segment) : null;

  // Extract event type from message type (e.g., "ADT_A01" → "A01")
  const eventType = message.type.replace('ADT_', '') as ADTEvent['eventType'];

  return {
    messageId: message.controlId,
    eventType,
    patientId: pid.patientIdInternal || pid.patientIdExternal,
    patientName: `${pid.patientName.familyName}, ${pid.patientName.givenName}`.trim(),
    dateOfBirth: pid.dateOfBirth,
    sex: pid.sex,
    patientClass: pv1?.patientClass || '',
    assignedLocation: pv1?.assignedPatientLocation || '',
    attendingDoctor: pv1?.attendingDoctor || '',
    admitDateTime: pv1?.admitDateTime || '',
    dischargeDateTime: pv1?.dischargeDateTime || undefined,
    visitNumber: pv1?.visitNumber || '',
  };
}

// ---------------------------------------------------------------------------
// Detect message type
// ---------------------------------------------------------------------------

export function detectMessageType(rawMessage: string): string {
  try {
    const message = baseParseHL7Message(rawMessage);
    return message.type;
  } catch {
    return 'UNKNOWN';
  }
}
