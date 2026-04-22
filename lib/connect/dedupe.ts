import { sha256 } from './hash';

export function computeConnectDedupeKey(input: {
  tenantId: string;
  eventType: string;
  occurredAt: string;
  patientHash: string;
  payloadHash: string;
  traceId: string;
}): string {
  const parts = [
    input.tenantId,
    input.eventType,
    input.occurredAt,
    input.patientHash,
    input.payloadHash,
    input.traceId,
  ];
  return sha256(parts.join('|'));
}

export function computePayloadHash(payload: Record<string, any>): string {
  return sha256(JSON.stringify(payload || {}));
}
