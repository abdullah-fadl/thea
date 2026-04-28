import {
  parseHL7Message,
  getSegments,
  getSegment,
  parsePID,
  parseOBR,
  parseOBX,
  parseHL7DateTime,
  HL7Message,
} from './parser';
import { buildACK } from './builder';

export interface LabResult {
  orderId: string;
  patientId: string;
  patientName: string;
  testCode: string;
  testName: string;
  value: string;
  valueNumeric?: number;
  unit: string;
  referenceRange: string;
  abnormalFlag: string;
  status: string;
  resultDateTime: Date;
  performingLab: string;
  comments?: string;
}

export interface ORUProcessResult {
  success: boolean;
  messageId: string;
  results: LabResult[];
  ackMessage: string;
  errors: string[];
}

export function processORU(
  rawMessage: string,
  config: {
    receivingApplication: string;
    receivingFacility: string;
  }
): ORUProcessResult {
  const errors: string[] = [];
  const results: LabResult[] = [];

  let message: HL7Message;

  try {
    message = parseHL7Message(rawMessage);
  } catch (error) {
    return {
      success: false,
      messageId: '',
      results: [],
      ackMessage: buildACK({
        originalControlId: 'UNKNOWN',
        sendingApplication: config.receivingApplication,
        sendingFacility: config.receivingFacility,
        receivingApplication: 'UNKNOWN',
        receivingFacility: 'UNKNOWN',
        ackCode: 'AR',
        errorMessage: `Parse error: ${error}`,
      }),
      errors: [`Failed to parse message: ${error}`],
    };
  }

  if (!message.type.startsWith('ORU')) {
    errors.push(`Expected ORU message, got ${message.type}`);
  }

  const pidSegment = getSegment(message, 'PID');
  if (!pidSegment) {
    errors.push('Missing PID segment');
    return {
      success: false,
      messageId: message.controlId,
      results: [],
      ackMessage: buildACK({
        originalControlId: message.controlId,
        sendingApplication: config.receivingApplication,
        sendingFacility: config.receivingFacility,
        receivingApplication: message.header.sendingApplication,
        receivingFacility: message.header.sendingFacility,
        ackCode: 'AE',
        errorMessage: 'Missing PID segment',
      }),
      errors,
    };
  }

  const pid = parsePID(pidSegment);

  getSegments(message, 'OBR');
  getSegments(message, 'OBX');

  let currentOBR: ReturnType<typeof parseOBR> | null = null;

  for (const segment of message.segments) {
    if (segment.name === 'OBR') {
      currentOBR = parseOBR(segment);
    } else if (segment.name === 'OBX' && currentOBR) {
      const obx = parseOBX(segment);

      let valueNumeric: number | undefined;
      const numericValue = parseFloat(obx.observationValue);
      if (!Number.isNaN(numericValue)) {
        valueNumeric = numericValue;
      }

      results.push({
        orderId: currentOBR.placerOrderNumber || currentOBR.fillerOrderNumber,
        patientId: pid.patientIdInternal || pid.patientIdExternal,
        patientName: `${pid.patientName.familyName}, ${pid.patientName.givenName}`,
        testCode: obx.observationIdentifier.identifier,
        testName: obx.observationIdentifier.text,
        value: obx.observationValue,
        valueNumeric,
        unit: obx.units.identifier || obx.units.text,
        referenceRange: obx.referenceRange,
        abnormalFlag: obx.abnormalFlags,
        status: obx.observationResultStatus,
        resultDateTime: obx.dateTimeOfObservation
          ? parseHL7DateTime(obx.dateTimeOfObservation)
          : parseHL7DateTime(currentOBR.resultsReportedDateTime),
        performingLab: message.header.sendingFacility,
      });
    }
  }

  const ackCode = errors.length > 0 ? 'AE' : 'AA';
  const ackMessage = buildACK({
    originalControlId: message.controlId,
    sendingApplication: config.receivingApplication,
    sendingFacility: config.receivingFacility,
    receivingApplication: message.header.sendingApplication,
    receivingFacility: message.header.sendingFacility,
    ackCode,
    errorMessage: errors.length > 0 ? errors.join('; ') : undefined,
  });

  return {
    success: errors.length === 0,
    messageId: message.controlId,
    results,
    ackMessage,
    errors,
  };
}
