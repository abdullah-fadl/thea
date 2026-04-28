import { normalizeIdentifier } from '@/lib/hospital/patientMaster';

export type PortalIdType = 'NATIONAL_ID' | 'IQAMA' | 'PASSPORT';

export function normalizeIdType(value: string | null | undefined): PortalIdType | null {
  const normalized = String(value || '').trim().toUpperCase();
  if (normalized === 'NATIONAL_ID' || normalized === 'NATIONALID') return 'NATIONAL_ID';
  if (normalized === 'IQAMA') return 'IQAMA';
  if (normalized === 'PASSPORT') return 'PASSPORT';
  return null;
}

export function normalizeIdNumber(value: string | null | undefined) {
  return normalizeIdentifier(value);
}

export function buildIdentifierQuery(idType: PortalIdType, idNumberNormalized: string) {
  if (idType === 'NATIONAL_ID') return { 'identifiers.nationalId': idNumberNormalized };
  if (idType === 'IQAMA') return { 'identifiers.iqama': idNumberNormalized };
  return { 'identifiers.passport': idNumberNormalized };
}

export function buildIdentifiers(idType: PortalIdType, idNumberNormalized: string) {
  if (idType === 'NATIONAL_ID') return { nationalId: idNumberNormalized };
  if (idType === 'IQAMA') return { iqama: idNumberNormalized };
  return { passport: idNumberNormalized };
}
