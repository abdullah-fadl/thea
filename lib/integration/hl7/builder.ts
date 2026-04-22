/**
 * Enhanced HL7 v2.x Message Builder
 *
 * Extends the existing builder with ADT message construction
 * and ORC segment support.
 */

import { formatHL7DateTime } from '@/lib/integrations/hl7/parser';
import type { OrderControl, AckCode } from './types';

// Re-export existing builders
export { buildACK, buildORM } from '@/lib/integrations/hl7/builder';

// ---------------------------------------------------------------------------
// Build ADT message
// ---------------------------------------------------------------------------

export interface ADTBuildOptions {
  sendingApplication: string;
  sendingFacility: string;
  receivingApplication: string;
  receivingFacility: string;
  eventType: 'A01' | 'A02' | 'A03' | 'A04' | 'A08';
  patientId: string;
  patientName: string;
  dateOfBirth: string;
  sex: string;
  patientClass: 'I' | 'O' | 'E' | 'P'; // Inpatient, Outpatient, Emergency, Preadmit
  assignedLocation?: string;
  attendingDoctor?: string;
  admitDateTime?: Date;
  dischargeDateTime?: Date;
  visitNumber?: string;
}

export function buildADT(options: ADTBuildOptions): string {
  const timestamp = formatHL7DateTime(new Date());
  const controlId = `ADT${Date.now()}`;

  const segments = [
    `MSH|^~\\&|${options.sendingApplication}|${options.sendingFacility}|${options.receivingApplication}|${options.receivingFacility}|${timestamp}||ADT^${options.eventType}|${controlId}|P|2.5`,
    `EVN|${options.eventType}|${timestamp}`,
    `PID|1||${options.patientId}^^^MRN||${options.patientName}||${options.dateOfBirth}|${options.sex}`,
    `PV1|1|${options.patientClass}|${options.assignedLocation || ''}|||${options.attendingDoctor || ''}|||||||||||${options.visitNumber || ''}||||||||||||||||||||||${options.admitDateTime ? formatHL7DateTime(options.admitDateTime) : ''}|${options.dischargeDateTime ? formatHL7DateTime(options.dischargeDateTime) : ''}`,
  ];

  return segments.join('\r');
}

// ---------------------------------------------------------------------------
// Build ORM with ORC segments
// ---------------------------------------------------------------------------

export interface ORMBuildOptions {
  sendingApplication: string;
  sendingFacility: string;
  receivingApplication: string;
  receivingFacility: string;
  patientId: string;
  patientName: string;
  dateOfBirth: string;
  sex: string;
  orderId: string;
  orderControl: OrderControl;
  orderDateTime: Date;
  tests: Array<{
    code: string;
    name: string;
    priority?: 'R' | 'S' | 'A' | 'P'; // Routine, STAT, ASAP, Preoperative
  }>;
  orderingProvider: string;
  clinicalInfo?: string;
  accessionNumber?: string;
}

export function buildORMWithORC(options: ORMBuildOptions): string {
  const timestamp = formatHL7DateTime(new Date());
  const controlId = `ORM${Date.now()}`;
  const orderDateTime = formatHL7DateTime(options.orderDateTime);

  const segments = [
    `MSH|^~\\&|${options.sendingApplication}|${options.sendingFacility}|${options.receivingApplication}|${options.receivingFacility}|${timestamp}||ORM^O01|${controlId}|P|2.5`,
    `PID|1||${options.patientId}^^^MRN||${options.patientName}||${options.dateOfBirth}|${options.sex}`,
    `PV1|1|O`,
  ];

  options.tests.forEach((test, index) => {
    const setId = index + 1;
    const priority = test.priority || 'R';
    const fillerOrder = options.accessionNumber ? `${options.accessionNumber}-${setId}` : '';

    segments.push(
      `ORC|${options.orderControl}|${options.orderId}-${setId}|${fillerOrder}||||||||${orderDateTime}|${options.orderingProvider}`,
    );
    segments.push(
      `OBR|${setId}|${options.orderId}-${setId}|${fillerOrder}|${test.code}^${test.name}^L|${priority}|${orderDateTime}|||||||${options.clinicalInfo || ''}`,
    );
  });

  return segments.join('\r');
}

// ---------------------------------------------------------------------------
// Build ORU (Result Message — for sending results out)
// ---------------------------------------------------------------------------

export interface ORUBuildOptions {
  sendingApplication: string;
  sendingFacility: string;
  receivingApplication: string;
  receivingFacility: string;
  patientId: string;
  patientName: string;
  orderId: string;
  accessionNumber: string;
  results: Array<{
    testCode: string;
    testName: string;
    value: string;
    unit: string;
    referenceRange: string;
    abnormalFlag: string;
    status: string;
    observationDateTime: Date;
  }>;
}

export function buildORU(options: ORUBuildOptions): string {
  const timestamp = formatHL7DateTime(new Date());
  const controlId = `ORU${Date.now()}`;

  const segments = [
    `MSH|^~\\&|${options.sendingApplication}|${options.sendingFacility}|${options.receivingApplication}|${options.receivingFacility}|${timestamp}||ORU^R01|${controlId}|P|2.5`,
    `PID|1||${options.patientId}^^^MRN||${options.patientName}`,
    `OBR|1|${options.orderId}|${options.accessionNumber}|${options.results[0]?.testCode || ''}^${options.results[0]?.testName || ''}^L`,
  ];

  options.results.forEach((result, index) => {
    const obsDateTime = formatHL7DateTime(result.observationDateTime);
    segments.push(
      `OBX|${index + 1}|NM|${result.testCode}^${result.testName}^L||${result.value}|${result.unit}|${result.referenceRange}|${result.abnormalFlag}|||${result.status}|||${obsDateTime}`,
    );
  });

  return segments.join('\r');
}
