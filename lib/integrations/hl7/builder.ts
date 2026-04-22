import { formatHL7DateTime } from './parser';

export interface ACKOptions {
  originalControlId: string;
  sendingApplication: string;
  sendingFacility: string;
  receivingApplication: string;
  receivingFacility: string;
  ackCode: 'AA' | 'AE' | 'AR';
  errorMessage?: string;
}

export function buildACK(options: ACKOptions): string {
  const timestamp = formatHL7DateTime(new Date());
  const controlId = `ACK${Date.now()}`;

  const segments = [
    `MSH|^~\\&|${options.receivingApplication}|${options.receivingFacility}|${options.sendingApplication}|${options.sendingFacility}|${timestamp}||ACK^R01|${controlId}|P|2.5`,
    `MSA|${options.ackCode}|${options.originalControlId}${options.errorMessage ? `|${options.errorMessage}` : ''}`,
  ];

  return segments.join('\r');
}

export function buildORM(options: {
  sendingApplication: string;
  sendingFacility: string;
  receivingApplication: string;
  receivingFacility: string;
  patientId: string;
  patientName: string;
  dateOfBirth: string;
  sex: string;
  orderId: string;
  orderDateTime: Date;
  tests: Array<{
    code: string;
    name: string;
    priority?: 'R' | 'S' | 'A' | 'P';
  }>;
  orderingProvider: string;
  clinicalInfo?: string;
}): string {
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

    segments.push(`ORC|NW|${options.orderId}-${setId}||||||||||${options.orderingProvider}`);
    segments.push(
      `OBR|${setId}|${options.orderId}-${setId}||${test.code}^${test.name}^L|${priority}|${orderDateTime}|||||||${options.clinicalInfo || ''}`
    );
  });

  return segments.join('\r');
}
