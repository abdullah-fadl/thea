export interface HL7Message {
  raw: string;
  segments: HL7Segment[];
  header: MSHSegment;
  type: string;
  version: string;
  controlId: string;
  timestamp: Date;
}

export interface HL7Segment {
  name: string;
  fields: string[];
  raw: string;
}

export interface MSHSegment {
  fieldSeparator: string;
  encodingCharacters: string;
  sendingApplication: string;
  sendingFacility: string;
  receivingApplication: string;
  receivingFacility: string;
  dateTime: string;
  security: string;
  messageType: string;
  controlId: string;
  processingId: string;
  versionId: string;
}

export interface PIDSegment {
  setId: string;
  patientIdExternal: string;
  patientIdInternal: string;
  alternatePatientId: string;
  patientName: {
    familyName: string;
    givenName: string;
    middleName: string;
    suffix: string;
    prefix: string;
  };
  motherMaidenName: string;
  dateOfBirth: string;
  sex: string;
  patientAlias: string;
  race: string;
  patientAddress: string;
  countyCode: string;
  phoneHome: string;
  phoneBusiness: string;
  primaryLanguage: string;
  maritalStatus: string;
  religion: string;
  patientAccountNumber: string;
  ssn: string;
  driversLicense: string;
  motherIdentifier: string;
  ethnicGroup: string;
  birthPlace: string;
  multipleBirthIndicator: string;
  birthOrder: string;
  citizenship: string;
  veteransMilitaryStatus: string;
  nationality: string;
  patientDeathDateTime: string;
  patientDeathIndicator: string;
}

export interface OBRSegment {
  setId: string;
  placerOrderNumber: string;
  fillerOrderNumber: string;
  universalServiceId: {
    identifier: string;
    text: string;
    codingSystem: string;
  };
  priority: string;
  requestedDateTime: string;
  observationDateTime: string;
  observationEndDateTime: string;
  collectionVolume: string;
  collectorIdentifier: string;
  specimenActionCode: string;
  dangerCode: string;
  relevantClinicalInfo: string;
  specimenReceivedDateTime: string;
  specimenSource: string;
  orderingProvider: string;
  orderCallbackPhone: string;
  placerField1: string;
  placerField2: string;
  fillerField1: string;
  fillerField2: string;
  resultsReportedDateTime: string;
  chargeToPractice: string;
  diagnosticServiceSectionId: string;
  resultStatus: string;
  parentResult: string;
  quantityTiming: string;
  resultCopiesTo: string;
  parent: string;
  transportationMode: string;
  reasonForStudy: string;
  principalResultInterpreter: string;
  assistantResultInterpreter: string;
  technician: string;
  transcriptionist: string;
  scheduledDateTime: string;
}

export interface OBXSegment {
  setId: string;
  valueType: string;
  observationIdentifier: {
    identifier: string;
    text: string;
    codingSystem: string;
  };
  observationSubId: string;
  observationValue: string;
  units: {
    identifier: string;
    text: string;
    codingSystem: string;
  };
  referenceRange: string;
  abnormalFlags: string;
  probability: string;
  natureOfAbnormalTest: string;
  observationResultStatus: string;
  dateLastObservationNormalValue: string;
  userDefinedAccessChecks: string;
  dateTimeOfObservation: string;
  producerId: string;
  responsibleObserver: string;
  observationMethod: string;
}

const DEFAULT_FIELD_SEPARATOR = '|';
const DEFAULT_ENCODING_CHARS = '^~\\&';

export function parseHL7Message(rawMessage: string): HL7Message {
  const normalized = rawMessage.replace(/\r\n/g, '\r').replace(/\n/g, '\r');
  const lines = normalized.split('\r').filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    throw new Error('Empty HL7 message');
  }

  const mshLine = lines[0];
  if (!mshLine.startsWith('MSH')) {
    throw new Error('HL7 message must start with MSH segment');
  }

  const fieldSeparator = mshLine[3] || DEFAULT_FIELD_SEPARATOR;
  const encodingChars = mshLine.substring(4, 8) || DEFAULT_ENCODING_CHARS;

  const componentSeparator = encodingChars[0] || '^';

  const segments: HL7Segment[] = lines.map((line) => {
    const fields = line.split(fieldSeparator);
    return {
      name: fields[0],
      fields: fields.slice(1),
      raw: line,
    };
  });

  const mshFields = segments[0].fields;
  const header: MSHSegment = {
    fieldSeparator,
    encodingCharacters: encodingChars,
    sendingApplication: mshFields[1] || '',
    sendingFacility: mshFields[2] || '',
    receivingApplication: mshFields[3] || '',
    receivingFacility: mshFields[4] || '',
    dateTime: mshFields[5] || '',
    security: mshFields[6] || '',
    messageType: mshFields[7] || '',
    controlId: mshFields[8] || '',
    processingId: mshFields[9] || '',
    versionId: mshFields[10] || '',
  };

  const messageTypeParts = header.messageType.split(componentSeparator);
  const type = `${messageTypeParts[0]}_${messageTypeParts[1] || ''}`;

  return {
    raw: rawMessage,
    segments,
    header,
    type,
    version: header.versionId,
    controlId: header.controlId,
    timestamp: parseHL7DateTime(header.dateTime),
  };
}

export function parseHL7DateTime(hl7Date: string): Date {
  if (!hl7Date || hl7Date.length < 8) {
    return new Date();
  }

  const year = parseInt(hl7Date.substring(0, 4), 10);
  const month = parseInt(hl7Date.substring(4, 6), 10) - 1;
  const day = parseInt(hl7Date.substring(6, 8), 10);
  const hour = hl7Date.length >= 10 ? parseInt(hl7Date.substring(8, 10), 10) : 0;
  const minute = hl7Date.length >= 12 ? parseInt(hl7Date.substring(10, 12), 10) : 0;
  const second = hl7Date.length >= 14 ? parseInt(hl7Date.substring(12, 14), 10) : 0;

  return new Date(year, month, day, hour, minute, second);
}

export function formatHL7DateTime(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(
    date.getMinutes()
  )}${pad(date.getSeconds())}`;
}

export function getSegments(message: HL7Message, segmentName: string): HL7Segment[] {
  return message.segments.filter((s) => s.name === segmentName);
}

export function getSegment(message: HL7Message, segmentName: string): HL7Segment | null {
  return message.segments.find((s) => s.name === segmentName) || null;
}

export function parsePID(segment: HL7Segment): PIDSegment {
  const f = segment.fields;
  const nameParts = (f[4] || '').split('^');

  return {
    setId: f[0] || '',
    patientIdExternal: f[1] || '',
    patientIdInternal: f[2] || '',
    alternatePatientId: f[3] || '',
    patientName: {
      familyName: nameParts[0] || '',
      givenName: nameParts[1] || '',
      middleName: nameParts[2] || '',
      suffix: nameParts[3] || '',
      prefix: nameParts[4] || '',
    },
    motherMaidenName: f[5] || '',
    dateOfBirth: f[6] || '',
    sex: f[7] || '',
    patientAlias: f[8] || '',
    race: f[9] || '',
    patientAddress: f[10] || '',
    countyCode: f[11] || '',
    phoneHome: f[12] || '',
    phoneBusiness: f[13] || '',
    primaryLanguage: f[14] || '',
    maritalStatus: f[15] || '',
    religion: f[16] || '',
    patientAccountNumber: f[17] || '',
    ssn: f[18] || '',
    driversLicense: f[19] || '',
    motherIdentifier: f[20] || '',
    ethnicGroup: f[21] || '',
    birthPlace: f[22] || '',
    multipleBirthIndicator: f[23] || '',
    birthOrder: f[24] || '',
    citizenship: f[25] || '',
    veteransMilitaryStatus: f[26] || '',
    nationality: f[27] || '',
    patientDeathDateTime: f[28] || '',
    patientDeathIndicator: f[29] || '',
  };
}

export function parseOBR(segment: HL7Segment): OBRSegment {
  const f = segment.fields;
  const serviceIdParts = (f[3] || '').split('^');

  return {
    setId: f[0] || '',
    placerOrderNumber: f[1] || '',
    fillerOrderNumber: f[2] || '',
    universalServiceId: {
      identifier: serviceIdParts[0] || '',
      text: serviceIdParts[1] || '',
      codingSystem: serviceIdParts[2] || '',
    },
    priority: f[4] || '',
    requestedDateTime: f[5] || '',
    observationDateTime: f[6] || '',
    observationEndDateTime: f[7] || '',
    collectionVolume: f[8] || '',
    collectorIdentifier: f[9] || '',
    specimenActionCode: f[10] || '',
    dangerCode: f[11] || '',
    relevantClinicalInfo: f[12] || '',
    specimenReceivedDateTime: f[13] || '',
    specimenSource: f[14] || '',
    orderingProvider: f[15] || '',
    orderCallbackPhone: f[16] || '',
    placerField1: f[17] || '',
    placerField2: f[18] || '',
    fillerField1: f[19] || '',
    fillerField2: f[20] || '',
    resultsReportedDateTime: f[21] || '',
    chargeToPractice: f[22] || '',
    diagnosticServiceSectionId: f[23] || '',
    resultStatus: f[24] || '',
    parentResult: f[25] || '',
    quantityTiming: f[26] || '',
    resultCopiesTo: f[27] || '',
    parent: f[28] || '',
    transportationMode: f[29] || '',
    reasonForStudy: f[30] || '',
    principalResultInterpreter: f[31] || '',
    assistantResultInterpreter: f[32] || '',
    technician: f[33] || '',
    transcriptionist: f[34] || '',
    scheduledDateTime: f[35] || '',
  };
}

export function parseOBX(segment: HL7Segment): OBXSegment {
  const f = segment.fields;
  const obsIdParts = (f[2] || '').split('^');
  const unitParts = (f[5] || '').split('^');

  return {
    setId: f[0] || '',
    valueType: f[1] || '',
    observationIdentifier: {
      identifier: obsIdParts[0] || '',
      text: obsIdParts[1] || '',
      codingSystem: obsIdParts[2] || '',
    },
    observationSubId: f[3] || '',
    observationValue: f[4] || '',
    units: {
      identifier: unitParts[0] || '',
      text: unitParts[1] || '',
      codingSystem: unitParts[2] || '',
    },
    referenceRange: f[6] || '',
    abnormalFlags: f[7] || '',
    probability: f[8] || '',
    natureOfAbnormalTest: f[9] || '',
    observationResultStatus: f[10] || '',
    dateLastObservationNormalValue: f[11] || '',
    userDefinedAccessChecks: f[12] || '',
    dateTimeOfObservation: f[13] || '',
    producerId: f[14] || '',
    responsibleObserver: f[15] || '',
    observationMethod: f[16] || '',
  };
}

// =============================================================================
// Convenience aliases and extraction helpers (Phase 4.6a)
// =============================================================================

/**
 * Alias for parseHL7Message — shorter name for common usage.
 */
export const parseHL7 = parseHL7Message;

/**
 * Get a specific field from a segment by 1-based HL7 field index.
 * HL7 field numbering starts at 1 (MSH-1 is the field separator).
 * In our internal representation, fields are 0-indexed after the segment name.
 */
export function getField(segment: HL7Segment, index: number): string {
  // HL7 fields are 1-based; our array is 0-based (fields[0] = MSH-2 for MSH, or SEG-1 for others)
  // For MSH, field index 1 = separator, 2 = encoding chars (fields[0]), 3 = sending app (fields[1])
  // For other segments, field index 1 = fields[0]
  if (index < 1) return '';
  if (segment.name === 'MSH') {
    // MSH-1 is separator (|), MSH-2 is encoding chars (^~\&), both handled specially
    if (index === 1) return '|';
    return segment.fields[index - 2] || '';
  }
  return segment.fields[index - 1] || '';
}

/**
 * Extract the patient ID from PID-3 (patient ID internal) or PID-2 (external).
 */
export function extractPatientId(msg: HL7Message): string | null {
  const pidSegment = getSegment(msg, 'PID');
  if (!pidSegment) return null;
  const pid = parsePID(pidSegment);
  return pid.patientIdInternal || pid.patientIdExternal || null;
}

/**
 * Extract the accession number from OBR-3 (filler order number) or OBR-2 (placer order number).
 * The accession number is the lab's identifier for the order.
 */
export function extractAccessionNumber(msg: HL7Message): string | null {
  const obrSegments = getSegments(msg, 'OBR');
  if (obrSegments.length === 0) return null;
  const obr = parseOBR(obrSegments[0]);
  return obr.fillerOrderNumber || obr.placerOrderNumber || null;
}

/**
 * Extract all OBX results from the message, grouped by their parent OBR.
 */
export function extractResults(
  msg: HL7Message
): Array<{
  testCode: string;
  value: string;
  unit: string;
  referenceRange: string;
  abnormalFlag: string;
}> {
  const results: Array<{
    testCode: string;
    value: string;
    unit: string;
    referenceRange: string;
    abnormalFlag: string;
  }> = [];

  for (const segment of msg.segments) {
    if (segment.name === 'OBX') {
      const obx = parseOBX(segment);
      results.push({
        testCode: obx.observationIdentifier.identifier,
        value: obx.observationValue,
        unit: obx.units.identifier || obx.units.text,
        referenceRange: obx.referenceRange,
        abnormalFlag: obx.abnormalFlags,
      });
    }
  }

  return results;
}

/**
 * Build a standard HL7 ACK response message.
 * This is a convenience wrapper that delegates to the builder module's buildACK
 * but can also be used standalone.
 */
export function buildACKMessage(
  originalMsg: HL7Message,
  ackCode: 'AA' | 'AE' | 'AR',
  errorMessage?: string
): string {
  const timestamp = formatHL7DateTime(new Date());
  const controlId = `ACK${Date.now()}`;

  const segments = [
    `MSH|^~\\&|Thea_EHR|Thea|${originalMsg.header.sendingApplication}|${originalMsg.header.sendingFacility}|${timestamp}||ACK^${originalMsg.type.replace('_', '^')}|${controlId}|P|2.5`,
    `MSA|${ackCode}|${originalMsg.controlId}${errorMessage ? `|${errorMessage}` : ''}`,
  ];

  return segments.join('\r');
}
