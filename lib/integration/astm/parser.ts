/**
 * ASTM E1394/E1381 Protocol Parser
 *
 * Parses messages from clinical laboratory analyzers that use the
 * ASTM/CLSI LIS2-A2 protocol (formerly ASTM 1394).
 *
 * Frame structure:
 *  <STX> Frame# Data <ETX> Checksum <CR><LF>
 *
 * Record types:
 *  H — Header (instrument identification)
 *  P — Patient demographics
 *  O — Order (test request)
 *  R — Result
 *  C — Comment
 *  L — Terminator
 *
 * Handshake: ENQ → ACK → <data frames> → EOT
 */

// ---------------------------------------------------------------------------
// Control characters
// ---------------------------------------------------------------------------

export const ASTM = {
  ENQ: '\x05',
  ACK: '\x06',
  NAK: '\x15',
  STX: '\x02',
  ETX: '\x03',
  EOT: '\x04',
  CR: '\r',
  LF: '\n',
  FIELD_DELIMITER: '|',
  REPEAT_DELIMITER: '\\',
  COMPONENT_DELIMITER: '^',
  ESCAPE_DELIMITER: '&',
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ASTMRecordType = 'H' | 'P' | 'O' | 'R' | 'C' | 'L' | 'Q' | 'M';

export interface ASTMRecord {
  type: ASTMRecordType;
  sequenceNumber: number;
  fields: string[];
  raw: string;
}

export interface ASTMMessage {
  header: ASTMHeaderRecord;
  patients: ASTMPatientBlock[];
  terminator: ASTMRecord | null;
  raw: string;
}

export interface ASTMHeaderRecord {
  recordType: 'H';
  delimiters: string;
  messageId: string;
  password: string;
  senderName: string;
  senderAddress: string;
  reserved: string;
  senderPhone: string;
  characteristicsOfSender: string;
  receiverId: string;
  comments: string;
  processingId: string;
  versionNumber: string;
  dateTime: string;
}

export interface ASTMPatientRecord {
  recordType: 'P';
  sequenceNumber: number;
  practiceAssignedPatientId: string;
  labAssignedPatientId: string;
  patientIdThird: string;
  patientName: string;
  motherMaidenName: string;
  birthDate: string;
  sex: string;
  race: string;
  address: string;
  reserved: string;
  phone: string;
  attendingPhysician: string;
  specialField1: string;
  specialField2: string;
  height: string;
  weight: string;
  diagnosis: string;
  activeMedications: string;
  diet: string;
  practiceField1: string;
  practiceField2: string;
  admissionDate: string;
  admissionStatus: string;
  location: string;
}

export interface ASTMResultRecord {
  recordType: 'R';
  sequenceNumber: number;
  universalTestId: string;
  testCode: string;
  testName: string;
  value: string;
  valueNumeric?: number;
  units: string;
  referenceRanges: string;
  abnormalFlag: string;
  natureOfAbnormality: string;
  resultStatus: string;
  dateOfChange: string;
  operatorId: string;
  dateTimeStarted: string;
  dateTimeCompleted: string;
  instrumentId: string;
}

export interface ASTMOrderRecord {
  recordType: 'O';
  sequenceNumber: number;
  specimenId: string;
  instrumentSpecimenId: string;
  universalTestId: string;
  priority: string;
  requestedDateTime: string;
  collectionDateTime: string;
  collectionEndDateTime: string;
  collectionVolume: string;
  collectorId: string;
  actionCode: string;
  dangerCode: string;
  relevantClinicalInfo: string;
  dateTimeSpecimenReceived: string;
  specimenDescriptor: string;
  orderingPhysician: string;
  physicianPhone: string;
  userField1: string;
  userField2: string;
  labField1: string;
  labField2: string;
  dateTimeResultReported: string;
  instrumentCharge: string;
  instrumentSectionId: string;
  reportType: string;
}

export interface ASTMPatientBlock {
  patient: ASTMPatientRecord;
  orders: ASTMOrderBlock[];
  comments: string[];
}

export interface ASTMOrderBlock {
  order: ASTMOrderRecord;
  results: ASTMResultRecord[];
  comments: string[];
}

// ---------------------------------------------------------------------------
// Frame-level parsing
// ---------------------------------------------------------------------------

/**
 * Remove ASTM framing from raw data.
 * Strips STX, ETX, checksum, CR/LF.
 */
export function extractFrameData(frame: string): string {
  let data = frame;

  // Remove STX prefix
  if (data.startsWith(ASTM.STX)) {
    data = data.substring(1);
  }

  // Remove frame number (single digit after STX)
  if (/^\d/.test(data)) {
    data = data.substring(1);
  }

  // Remove ETX + checksum + CR + LF suffix
  const etxIdx = data.indexOf(ASTM.ETX);
  if (etxIdx >= 0) {
    data = data.substring(0, etxIdx);
  }

  return data.trim();
}

/**
 * Calculate ASTM checksum (sum of bytes from frame# to ETX inclusive, mod 256, as 2-char hex).
 */
export function calculateChecksum(frameData: string): string {
  let sum = 0;
  for (let i = 0; i < frameData.length; i++) {
    sum += frameData.charCodeAt(i);
  }
  // Add ETX
  sum += ASTM.ETX.charCodeAt(0);
  return (sum % 256).toString(16).toUpperCase().padStart(2, '0');
}

// ---------------------------------------------------------------------------
// Record-level parsing
// ---------------------------------------------------------------------------

function parseRecord(line: string): ASTMRecord {
  const fields = line.split(ASTM.FIELD_DELIMITER);
  const type = fields[0]?.[0] as ASTMRecordType || 'L';
  const seqNum = parseInt(fields[0]?.substring(1) || '1', 10);

  return {
    type,
    sequenceNumber: seqNum,
    fields,
    raw: line,
  };
}

function parseHeaderRecord(record: ASTMRecord): ASTMHeaderRecord {
  const f = record.fields;
  return {
    recordType: 'H',
    delimiters: f[1] || '\\^&',
    messageId: f[2] || '',
    password: f[3] || '',
    senderName: f[4] || '',
    senderAddress: f[5] || '',
    reserved: f[6] || '',
    senderPhone: f[7] || '',
    characteristicsOfSender: f[8] || '',
    receiverId: f[9] || '',
    comments: f[10] || '',
    processingId: f[11] || '',
    versionNumber: f[12] || '',
    dateTime: f[13] || '',
  };
}

function parsePatientRecord(record: ASTMRecord): ASTMPatientRecord {
  const f = record.fields;
  return {
    recordType: 'P',
    sequenceNumber: record.sequenceNumber,
    practiceAssignedPatientId: f[1] || '',
    labAssignedPatientId: f[2] || '',
    patientIdThird: f[3] || '',
    patientName: f[4] || '',
    motherMaidenName: f[5] || '',
    birthDate: f[6] || '',
    sex: f[7] || '',
    race: f[8] || '',
    address: f[9] || '',
    reserved: f[10] || '',
    phone: f[11] || '',
    attendingPhysician: f[12] || '',
    specialField1: f[13] || '',
    specialField2: f[14] || '',
    height: f[15] || '',
    weight: f[16] || '',
    diagnosis: f[17] || '',
    activeMedications: f[18] || '',
    diet: f[19] || '',
    practiceField1: f[20] || '',
    practiceField2: f[21] || '',
    admissionDate: f[22] || '',
    admissionStatus: f[23] || '',
    location: f[24] || '',
  };
}

function parseOrderRecord(record: ASTMRecord): ASTMOrderRecord {
  const f = record.fields;
  return {
    recordType: 'O',
    sequenceNumber: record.sequenceNumber,
    specimenId: f[1] || '',
    instrumentSpecimenId: f[2] || '',
    universalTestId: f[3] || '',
    priority: f[4] || '',
    requestedDateTime: f[5] || '',
    collectionDateTime: f[6] || '',
    collectionEndDateTime: f[7] || '',
    collectionVolume: f[8] || '',
    collectorId: f[9] || '',
    actionCode: f[10] || '',
    dangerCode: f[11] || '',
    relevantClinicalInfo: f[12] || '',
    dateTimeSpecimenReceived: f[13] || '',
    specimenDescriptor: f[14] || '',
    orderingPhysician: f[15] || '',
    physicianPhone: f[16] || '',
    userField1: f[17] || '',
    userField2: f[18] || '',
    labField1: f[19] || '',
    labField2: f[20] || '',
    dateTimeResultReported: f[21] || '',
    instrumentCharge: f[22] || '',
    instrumentSectionId: f[23] || '',
    reportType: f[24] || '',
  };
}

function parseResultRecord(record: ASTMRecord): ASTMResultRecord {
  const f = record.fields;
  const testIdParts = (f[2] || '').split(ASTM.COMPONENT_DELIMITER);
  const value = f[3] || '';
  let valueNumeric: number | undefined;
  const num = parseFloat(value);
  if (!Number.isNaN(num)) valueNumeric = num;

  return {
    recordType: 'R',
    sequenceNumber: record.sequenceNumber,
    universalTestId: f[2] || '',
    testCode: testIdParts[3] || testIdParts[0] || '',
    testName: testIdParts[4] || testIdParts[1] || '',
    value,
    valueNumeric,
    units: f[4] || '',
    referenceRanges: f[5] || '',
    abnormalFlag: f[6] || '',
    natureOfAbnormality: f[7] || '',
    resultStatus: f[8] || 'F',
    dateOfChange: f[9] || '',
    operatorId: f[10] || '',
    dateTimeStarted: f[11] || '',
    dateTimeCompleted: f[12] || '',
    instrumentId: f[13] || '',
  };
}

// ---------------------------------------------------------------------------
// Full message parsing
// ---------------------------------------------------------------------------

/**
 * Parse a complete ASTM message (after frame extraction and reassembly).
 *
 * @param rawData - concatenated frame data (records separated by CR)
 */
export function parseASTMMessage(rawData: string): ASTMMessage {
  const lines = rawData
    .split(/[\r\n]+/)
    .map((line) => extractFrameData(line))
    .filter((line) => line.length > 0);

  const records = lines.map(parseRecord);

  // Find header
  const headerRecord = records.find((r) => r.type === 'H');
  if (!headerRecord) {
    throw new Error('ASTM message missing Header (H) record');
  }
  const header = parseHeaderRecord(headerRecord);

  // Build patient blocks
  const patients: ASTMPatientBlock[] = [];
  let currentPatient: ASTMPatientBlock | null = null;
  let currentOrder: ASTMOrderBlock | null = null;

  for (const record of records) {
    switch (record.type) {
      case 'P':
        if (currentPatient) patients.push(currentPatient);
        currentPatient = {
          patient: parsePatientRecord(record),
          orders: [],
          comments: [],
        };
        currentOrder = null;
        break;

      case 'O':
        if (!currentPatient) {
          currentPatient = {
            patient: parsePatientRecord({ type: 'P', sequenceNumber: 1, fields: [], raw: '' }),
            orders: [],
            comments: [],
          };
        }
        currentOrder = {
          order: parseOrderRecord(record),
          results: [],
          comments: [],
        };
        currentPatient.orders.push(currentOrder);
        break;

      case 'R':
        if (currentOrder) {
          currentOrder.results.push(parseResultRecord(record));
        }
        break;

      case 'C':
        const comment = record.fields[3] || record.fields[2] || '';
        if (currentOrder) {
          currentOrder.comments.push(comment);
        } else if (currentPatient) {
          currentPatient.comments.push(comment);
        }
        break;

      case 'L':
        break;

      default:
        break;
    }
  }

  if (currentPatient) patients.push(currentPatient);

  const terminator = records.find((r) => r.type === 'L') || null;

  return {
    header,
    patients,
    terminator,
    raw: rawData,
  };
}

// ---------------------------------------------------------------------------
// Convert ASTM to unified lab result format
// ---------------------------------------------------------------------------

export interface UnifiedLabResult {
  patientId: string;
  patientName: string;
  specimenId: string;
  instrumentId: string;
  results: {
    testCode: string;
    testName: string;
    value: string;
    valueNumeric?: number;
    unit: string;
    referenceRange: string;
    abnormalFlag: string;
    status: string;
    dateTime: string;
  }[];
}

export function convertASTMToUnified(message: ASTMMessage): UnifiedLabResult[] {
  const unified: UnifiedLabResult[] = [];

  for (const patientBlock of message.patients) {
    const p = patientBlock.patient;

    for (const orderBlock of patientBlock.orders) {
      const o = orderBlock.order;

      unified.push({
        patientId: p.labAssignedPatientId || p.practiceAssignedPatientId,
        patientName: p.patientName,
        specimenId: o.specimenId || o.instrumentSpecimenId,
        instrumentId: message.header.senderName,
        results: orderBlock.results.map((r) => ({
          testCode: r.testCode,
          testName: r.testName,
          value: r.value,
          valueNumeric: r.valueNumeric,
          unit: r.units,
          referenceRange: r.referenceRanges,
          abnormalFlag: r.abnormalFlag,
          status: r.resultStatus,
          dateTime: r.dateTimeCompleted || r.dateTimeStarted,
        })),
      });
    }
  }

  return unified;
}
