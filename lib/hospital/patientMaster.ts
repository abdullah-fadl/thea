import { v4 as uuidv4 } from 'uuid';

export type PatientMasterStatus = 'KNOWN' | 'UNKNOWN' | 'MERGED';
export type PatientMasterGender = 'MALE' | 'FEMALE' | 'OTHER' | 'UNKNOWN';

export interface PatientIdentifiers {
  nationalId?: string | null;
  iqama?: string | null;
  passport?: string | null;
}

export interface PatientLink {
  system: 'ER' | 'IPD' | 'OPD';
  patientId: string;
  mrn?: string | null;
  tempMrn?: string | null;
}

export interface PatientMasterInput {
  mrn?: string | null;
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  mobile?: string | null;
  email?: string | null;
  bloodType?: string | null;
  knownAllergies?: string[] | null;
  nationality?: string | null;
  city?: string | null;
  emergencyContact?: {
    name?: string | null;
    phone?: string | null;
    relation?: string | null;
  } | null;
  dob?: Date | null;
  gender?: PatientMasterGender | null;
  identifiers?: PatientIdentifiers | null;
  status?: PatientMasterStatus | null;
  links?: PatientLink[];
}

export interface PatientMasterRecord {
  id: string;
  mrn?: string | null;
  tenantId: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  fullName: string;
  nameNormalized: string;
  mobile?: string | null;
  mobileNormalized?: string | null;
  email?: string | null;
  bloodType?: string | null;
  knownAllergies?: string[] | null;
  nationality?: string | null;
  city?: string | null;
  emergencyContact?: {
    name?: string | null;
    phone?: string | null;
    relation?: string | null;
  } | null;
  dob: Date | null;
  gender: PatientMasterGender;
  identifiers: PatientIdentifiers;
  status: PatientMasterStatus;
  identityVerification?: {
    source: 'GOV_LOOKUP';
    matchLevel: 'VERIFIED' | 'PARTIAL' | 'NONE';
    dobProvided: boolean;
    verifiedAt?: Date | null;
    lastLookupAt?: Date | null;
  };
  links?: PatientLink[];
  mergedIntoPatientId?: string | null;
  mergedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId?: string;
  updatedByUserId?: string;
}

export interface DuplicateCandidate {
  patientId: string;
  score: number;
  reasons: string[];
}

function normalizeTokens(value: string): string[] {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

export function normalizeName(value: string): string {
  return normalizeTokens(value).join(' ');
}

export function normalizeIdentifier(value: string | null | undefined): string | null {
  const normalized = String(value || '')
    .replace(/[\s-]/g, '')
    .trim();
  return normalized ? normalized : null;
}

export function buildFullName(firstName: string, middleName: string, lastName: string): string {
  const fullName = `${firstName || ''} ${middleName || ''} ${lastName || ''}`.replace(/\s+/g, ' ').trim();
  return fullName || 'Unknown';
}

export function hasOfficialIdentifier(identifiers: PatientIdentifiers): boolean {
  return Boolean(identifiers.nationalId || identifiers.iqama || identifiers.passport);
}

export function sanitizeIdentifiers(input?: PatientIdentifiers | null): PatientIdentifiers {
  return {
    nationalId: normalizeIdentifier(input?.nationalId),
    iqama: normalizeIdentifier(input?.iqama),
    passport: normalizeIdentifier(input?.passport),
  };
}

export function buildPatientMasterRecord(
  tenantId: string,
  userId: string | undefined,
  input: PatientMasterInput
): PatientMasterRecord {
  const identifiers = sanitizeIdentifiers(input.identifiers);
  const firstName = String(input.firstName || '').trim();
  const middleName = String(input.middleName || '').trim();
  const lastName = String(input.lastName || '').trim();
  const fullName = buildFullName(firstName, middleName, lastName);
  const nameNormalized = normalizeName(fullName);
  const gender = (String(input.gender || 'UNKNOWN').toUpperCase() || 'UNKNOWN') as PatientMasterGender;
  const status = (String(input.status || 'UNKNOWN').toUpperCase() || 'UNKNOWN') as PatientMasterStatus;
  const now = new Date();

  return {
    id: uuidv4(),
    mrn: input.mrn || null,
    tenantId,
    firstName: firstName || 'Unknown',
    middleName: middleName || null,
    lastName: lastName || '',
    fullName,
    nameNormalized,
    dob: input.dob ?? null,
    gender,
    identifiers,
    status,
    mobile: input.mobile?.trim() || null,
    email: input.email?.trim() || null,
    bloodType: input.bloodType?.trim() || null,
    knownAllergies: Array.isArray(input.knownAllergies) ? input.knownAllergies : null,
    nationality: input.nationality?.trim() || null,
    city: input.city?.trim() || null,
    emergencyContact: input.emergencyContact || null,
    links: input.links && input.links.length ? input.links : undefined,
    mergedIntoPatientId: null,
    mergedAt: null,
    createdAt: now,
    updatedAt: now,
    createdByUserId: userId,
    updatedByUserId: userId,
  };
}

function tokenSimilarity(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let intersect = 0;
  setA.forEach((token) => {
    if (setB.has(token)) intersect += 1;
  });
  const union = new Set([...a, ...b]).size;
  return union ? intersect / union : 0;
}

export function detectDuplicateCandidates(
  input: PatientMasterInput,
  candidates: Array<PatientMasterRecord | Record<string, any>>
): DuplicateCandidate[] {
  const identifiers = sanitizeIdentifiers(input.identifiers);
  const fullName = buildFullName(
    String(input.firstName || '').trim(),
    String(input.middleName || '').trim(),
    String(input.lastName || '').trim()
  );
  const nameTokens = normalizeTokens(fullName);
  const dob = input.dob ? new Date(input.dob) : null;

  const results: DuplicateCandidate[] = [];
  for (const candidate of candidates) {
    const reasons: string[] = [];
    let score = 0;

    const candidateIdentifiers = sanitizeIdentifiers(candidate.identifiers);
    if (identifiers.nationalId && identifiers.nationalId === candidateIdentifiers.nationalId) {
      score += 60;
      reasons.push('NATIONAL_ID_MATCH');
    }
    if (identifiers.iqama && identifiers.iqama === candidateIdentifiers.iqama) {
      score += 60;
      reasons.push('IQAMA_MATCH');
    }
    if (identifiers.passport && identifiers.passport === candidateIdentifiers.passport) {
      score += 50;
      reasons.push('PASSPORT_MATCH');
    }

    if (dob && candidate.dob) {
      const sameDob = new Date(candidate.dob).toDateString() === dob.toDateString();
      if (sameDob) {
        score += 20;
        reasons.push('DOB_MATCH');
      }
    }

    if (nameTokens.length) {
      const candidateTokens = normalizeTokens(candidate.fullName || candidate.nameNormalized || '');
      const similarity = tokenSimilarity(nameTokens, candidateTokens);
      if (similarity >= 0.7) {
        score += 30;
        reasons.push('NAME_SIMILAR');
      }
    }

    if (score > 0) {
      results.push({
        patientId: String(candidate.id || ''),
        score,
        reasons,
      });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}

export function mapErPatientLink(erPatient: any): PatientLink {
  return {
    system: 'ER',
    patientId: String(erPatient?.id || ''),
    mrn: erPatient?.mrn ?? null,
    tempMrn: erPatient?.tempMrn ?? null,
  };
}

export function mapPatientInputFromEr(erPatient: any): PatientMasterInput {
  const fullName = String(erPatient?.fullName || '').trim();
  const [firstName, ...rest] = fullName.split(' ');
  const lastName = rest.join(' ').trim();
  return {
    firstName: firstName || 'Unknown',
    lastName,
    dob: erPatient?.dob ? new Date(erPatient.dob) : null,
    gender: (String(erPatient?.gender || 'UNKNOWN').toUpperCase() || 'UNKNOWN') as PatientMasterGender,
    identifiers: {
      nationalId: erPatient?.nationalId ?? null,
      iqama: erPatient?.iqama ?? null,
      passport: erPatient?.passport ?? null,
    },
    status: hasOfficialIdentifier({
      nationalId: erPatient?.nationalId ?? null,
      iqama: erPatient?.iqama ?? null,
      passport: erPatient?.passport ?? null,
    })
      ? 'KNOWN'
      : 'UNKNOWN',
    links: [mapErPatientLink(erPatient)],
  };
}
