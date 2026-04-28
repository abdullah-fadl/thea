import { parseHL7Message, HL7Message } from '@/lib/integrations/hl7/parser';
import { processORU, LabResult, ORUProcessResult } from '@/lib/integrations/hl7/oruProcessor';
import { buildACK, buildORM } from '@/lib/integrations/hl7/builder';

export { parseHL7Message, processORU, buildACK, buildORM };
export type { HL7Message, LabResult, ORUProcessResult };

export function parseHl7Payload(payload: unknown): ORUProcessResult | { error: string } {
  if (typeof payload !== 'string') {
    return { error: 'Payload must be a string' };
  }

  try {
    return processORU(payload, {
      receivingApplication: 'Thea_EHR',
      receivingFacility: 'Thea',
    });
  } catch (error) {
    return { error: String(error) };
  }
}
