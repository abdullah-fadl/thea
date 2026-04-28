export type IdentityType = 'NATIONAL_ID' | 'IQAMA' | 'PASSPORT';
export type IdentityLookupContextArea = 'registration' | 'er' | 'opd';
export type IdentityLookupStatus =
  | 'VERIFIED'
  | 'PARTIAL'
  | 'NONE'
  | 'NOT_CONFIGURED'
  | 'RATE_LIMITED'
  | 'ERROR';
export type IdentityMatchLevel = 'VERIFIED' | 'PARTIAL' | 'NONE';

export type IdentityLookupRequest = {
  identityType: IdentityType;
  identityValue: string;
  dob?: string | null;
  contextArea: IdentityLookupContextArea;
  clientRequestId?: string | null;
};

export type IdentityLookupPayload = {
  fullNameEn?: string | null;
  fullNameAr?: string | null;
  gender?: 'MALE' | 'FEMALE' | 'OTHER' | 'UNKNOWN' | null;
  dob?: string | null;
  nationality?: string | null;
};

export type IdentityLookupResponse = {
  status: IdentityLookupStatus;
  matchLevel: IdentityMatchLevel;
  payload?: IdentityLookupPayload | null;
  lookupId: string;
  provider: string;
  providerTraceId?: string | null;
  dedupeKey: string;
  reasonCode?: string | null;
};
