/**
 * HL7 v2.x TypeScript Interfaces for Thea EHR
 *
 * Comprehensive type definitions for HL7 message handling.
 * Covers: ORM^O01, ORU^R01, ADT^A01-A08, ACK
 */

// ---------------------------------------------------------------------------
// Core HL7 Types (re-export + extend from existing)
// ---------------------------------------------------------------------------

export type {
  HL7Message,
  HL7Segment,
  MSHSegment,
  PIDSegment,
  OBRSegment,
  OBXSegment,
} from '@/lib/integrations/hl7/parser';

// ---------------------------------------------------------------------------
// Message Types
// ---------------------------------------------------------------------------

export type HL7MessageType =
  | 'ORM_O01'   // Order message (Thea → Instrument)
  | 'ORU_R01'   // Result message (Instrument → Thea)
  | 'ADT_A01'   // Admit
  | 'ADT_A02'   // Transfer
  | 'ADT_A03'   // Discharge
  | 'ADT_A04'   // Register outpatient
  | 'ADT_A08'   // Update patient info
  | 'ACK';      // Acknowledgment

export type AbnormalFlag = 'N' | 'H' | 'L' | 'HH' | 'LL' | 'A' | '';
export type ResultStatus = 'F' | 'P' | 'C' | 'R' | 'X'; // Final, Preliminary, Correction, Results not available, Cancelled
export type OrderControl = 'NW' | 'CA' | 'OC' | 'XO' | 'SC'; // New, Cancel, Discontinue, Change, Status Changed
export type AckCode = 'AA' | 'AE' | 'AR'; // Accept, Error, Reject

// ---------------------------------------------------------------------------
// Parsed Result Types
// ---------------------------------------------------------------------------

export interface HL7LabResult {
  messageId: string;
  patientId: string;
  patientName: string;
  orderId: string;
  accessionNumber: string;
  results: HL7ResultObservation[];
}

export interface HL7ResultObservation {
  testCode: string;
  testName: string;
  value: string;
  valueNumeric?: number;
  unit: string;
  referenceRange: string;
  abnormalFlag: AbnormalFlag;
  status: ResultStatus;
  observationDateTime: Date;
  comments?: string;
}

// ---------------------------------------------------------------------------
// ORC Segment (Order Common)
// ---------------------------------------------------------------------------

export interface ORCSegment {
  orderControl: OrderControl;
  placerOrderNumber: string;
  fillerOrderNumber: string;
  placerGroupNumber: string;
  orderStatus: string;
  responseFlag: string;
  quantityTiming: string;
  parent: string;
  dateTimeOfTransaction: string;
  enteredBy: string;
  verifiedBy: string;
  orderingProvider: string;
  entererLocation: string;
  callBackPhoneNumber: string;
  orderEffectiveDateTime: string;
  orderControlCodeReason: string;
  enteringOrganization: string;
  enteringDevice: string;
  actionBy: string;
}

// ---------------------------------------------------------------------------
// ADT Event Types
// ---------------------------------------------------------------------------

export interface ADTEvent {
  messageId: string;
  eventType: 'A01' | 'A02' | 'A03' | 'A04' | 'A08';
  patientId: string;
  patientName: string;
  dateOfBirth: string;
  sex: string;
  patientClass: string;
  assignedLocation: string;
  attendingDoctor: string;
  admitDateTime: string;
  dischargeDateTime?: string;
  visitNumber: string;
}

// ---------------------------------------------------------------------------
// Instrument Connection
// ---------------------------------------------------------------------------

export type InstrumentType = 'lab_analyzer' | 'imaging_modality' | 'vitals_monitor' | 'ecg';
export type InstrumentProtocol = 'HL7' | 'ASTM' | 'DICOM' | 'FHIR' | 'REST';
export type ConnectionType = 'tcp' | 'http' | 'serial' | 'dicom_cstore';
export type InstrumentStatus = 'ONLINE' | 'OFFLINE' | 'ERROR' | 'MAINTENANCE';

export interface Instrument {
  id: string;
  name: string;
  type: InstrumentType;
  manufacturer: string;
  model: string;
  serialNumber: string;
  department: string;
  protocol: InstrumentProtocol;
  connectionType: ConnectionType;
  host?: string;
  port?: number;
  aeTitle?: string;
  status: InstrumentStatus;
  lastHeartbeat?: Date;
  tenantId: string;
  config: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Integration Message (Audit Log)
// ---------------------------------------------------------------------------

export type MessageDirection = 'INBOUND' | 'OUTBOUND';
export type MessageProtocol = 'HL7' | 'ASTM' | 'DICOM' | 'FHIR';
export type MessageStatus = 'RECEIVED' | 'PROCESSED' | 'FAILED' | 'RETRY';

export interface IntegrationMessage {
  id: string;
  direction: MessageDirection;
  protocol: MessageProtocol;
  messageType: string;
  instrumentId: string;
  rawMessage: string;
  parsedData?: Record<string, unknown>;
  status: MessageStatus;
  errorMessage?: string;
  retryCount: number;
  receivedAt: Date;
  processedAt?: Date;
  tenantId: string;
}
