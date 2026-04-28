/**
 * HL7 v2.x Integration Module
 *
 * Unified exports for all HL7 functionality.
 */

// Types
export type {
  HL7Message,
  HL7Segment,
  MSHSegment,
  PIDSegment,
  OBRSegment,
  OBXSegment,
  HL7MessageType,
  AbnormalFlag,
  ResultStatus,
  OrderControl,
  AckCode,
  HL7LabResult,
  HL7ResultObservation,
  ORCSegment,
  ADTEvent,
  Instrument,
  InstrumentType,
  InstrumentProtocol,
  ConnectionType,
  InstrumentStatus,
  IntegrationMessage,
  MessageDirection,
  MessageProtocol,
  MessageStatus,
} from './types';

// Parser
export {
  parseHL7Message,
  parseHL7DateTime,
  formatHL7DateTime,
  getSegment,
  getSegments,
  extractLabResults,
  extractADTEvent,
  detectMessageType,
} from './parser';

// Segments
export {
  parsePID,
  parseOBR,
  parseOBX,
  parseORC,
  parsePV1,
} from './segments';

// Builder
export {
  buildACK,
  buildORM,
  buildADT,
  buildORMWithORC,
  buildORU,
} from './builder';

// Existing processor
export { processORU } from '@/lib/integrations/hl7/oruProcessor';
