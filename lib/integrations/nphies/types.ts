// =============================================================================
// NPHIES Integration Types — FHIR R4
// =============================================================================

// ---------------------------------------------------------------------------
// Status Enums
// ---------------------------------------------------------------------------

export enum ClaimStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  PARTIAL = 'PARTIAL',
  PENDING = 'PENDING',
  ERROR = 'ERROR',
  CANCELLED = 'CANCELLED',
}

export enum EligibilityStatus {
  ELIGIBLE = 'ELIGIBLE',
  INELIGIBLE = 'INELIGIBLE',
  PENDING = 'PENDING',
  ERROR = 'ERROR',
  UNKNOWN = 'UNKNOWN',
}

export enum PriorAuthStatus {
  APPROVED = 'APPROVED',
  DENIED = 'DENIED',
  PENDING = 'PENDING',
  PARTIAL = 'PARTIAL',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
  ERROR = 'ERROR',
}

// ---------------------------------------------------------------------------
// NPHIES Code System Constants
// ---------------------------------------------------------------------------

/** NPHIES Claim Types */
export const NPHIES_CLAIM_TYPES = {
  PROFESSIONAL: 'professional',
  INSTITUTIONAL: 'institutional',
  ORAL: 'oral',
  PHARMACY: 'pharmacy',
  VISION: 'vision',
} as const;

/** NPHIES Service Categories */
export const NPHIES_SERVICE_CATEGORIES = {
  CONSULTATION: '1',
  DIAGNOSTIC: '2',
  EMERGENCY: '3',
  HOSPITAL: '4',
  LAB: '5',
  RADIOLOGY: '6',
  MEDICATION: '7',
  SURGERY: '8',
  DENTAL: '9',
  VISION: '10',
  PHYSICAL_THERAPY: '11',
  MENTAL_HEALTH: '12',
  MATERNITY: '13',
  NICU: '14',
  PREVENTIVE: '15',
  HOME_HEALTH: '16',
} as const;

/** NPHIES Message Events */
export const NPHIES_MESSAGE_EVENTS = {
  ELIGIBILITY_REQUEST: 'eligibility-request',
  ELIGIBILITY_RESPONSE: 'eligibility-response',
  CLAIM_REQUEST: 'claim-request',
  CLAIM_RESPONSE: 'claim-response',
  PRIORAUTH_REQUEST: 'priorauth-request',
  PRIORAUTH_RESPONSE: 'priorauth-response',
  STATUS_CHECK: 'status-check',
  CANCEL_REQUEST: 'cancel-request',
  CANCEL_RESPONSE: 'cancel-response',
} as const;

/** NPHIES Encounter Types */
export const NPHIES_ENCOUNTER_TYPES = {
  OUTPATIENT: 'AMB',
  INPATIENT: 'IMP',
  EMERGENCY: 'EMER',
  VIRTUAL: 'VR',
} as const;

/** NPHIES Coverage Types */
export const NPHIES_COVERAGE_TYPES = {
  EXTENDED_HEALTHCARE: 'EHCPOL',
  PUBLIC_HEALTHCARE: 'publicpol',
  MANAGED_CARE: 'MCPOL',
} as const;

/** NPHIES Adjudication Categories */
export const NPHIES_ADJUDICATION_CATEGORIES = {
  SUBMITTED: 'submitted',
  COPAY: 'copay',
  ELIGIBLE: 'eligible',
  DEDUCTIBLE: 'deductible',
  BENEFIT: 'benefit',
  TAX: 'tax',
} as const;

/** NPHIES Denial Reason Codes with Arabic translations */
export const NPHIES_DENIAL_REASONS: Record<string, { en: string; ar: string }> = {
  AUTH_REQUIRED: { en: 'Prior authorization required', ar: 'مطلوب موافقة مسبقة' },
  NOT_COVERED: { en: 'Service not covered by plan', ar: 'الخدمة غير مغطاة بالخطة' },
  DUPLICATE: { en: 'Duplicate claim submission', ar: 'مطالبة مكررة' },
  EXPIRED: { en: 'Coverage expired', ar: 'انتهت صلاحية التغطية' },
  INVALID_MEMBER: { en: 'Invalid member ID', ar: 'رقم عضوية غير صالح' },
  INVALID_DIAGNOSIS: { en: 'Invalid diagnosis code', ar: 'رمز تشخيص غير صالح' },
  INVALID_SERVICE: { en: 'Invalid service code', ar: 'رمز خدمة غير صالح' },
  MAX_BENEFIT_EXCEEDED: { en: 'Maximum benefit exceeded', ar: 'تم تجاوز الحد الأقصى للمنفعة' },
  WAITING_PERIOD: { en: 'Waiting period not met', ar: 'لم يتم استيفاء فترة الانتظار' },
  PREEXISTING: { en: 'Pre-existing condition', ar: 'حالة مرضية سابقة' },
  MISSING_INFO: { en: 'Missing required information', ar: 'معلومات مطلوبة مفقودة' },
  PROVIDER_NOT_IN_NETWORK: { en: 'Provider not in network', ar: 'مقدم الخدمة خارج الشبكة' },
  FREQUENCY_LIMIT: { en: 'Service frequency limit reached', ar: 'تم الوصول لحد تكرار الخدمة' },
  AGE_LIMIT: { en: 'Age limit for service', ar: 'حد العمر للخدمة' },
  GENDER_LIMIT: { en: 'Gender restriction for service', ar: 'قيود الجنس للخدمة' },
};

/** FHIR R4 Profile URLs used by NPHIES */
export const NPHIES_PROFILES = {
  BUNDLE: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/bundle|1.0.0',
  MESSAGE_HEADER: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/message-header|1.0.0',
  PATIENT: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/patient|1.0.0',
  COVERAGE: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/coverage|1.0.0',
  ELIGIBILITY_REQUEST: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/eligibility-request|1.0.0',
  ELIGIBILITY_RESPONSE: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/eligibility-response|1.0.0',
  CLAIM: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/claim|1.0.0',
  CLAIM_RESPONSE: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/claim-response|1.0.0',
  PRIOR_AUTH_REQUEST: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/prior-auth-request|1.0.0',
  ENCOUNTER: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/encounter|1.0.0',
  ORGANIZATION: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/organization|1.0.0',
} as const;

/** NPHIES Identifier Systems */
export const NPHIES_SYSTEMS = {
  NATIONAL_ID: 'http://nphies.sa/identifier/nationalid',
  IQAMA: 'http://nphies.sa/identifier/iqama',
  PAYER_LICENSE: 'http://nphies.sa/license/payer-license',
  PROVIDER_LICENSE: 'http://nphies.sa/license/provider-license',
  MEMBER_ID: 'http://payer.sa/memberid',
  MESSAGE_EVENTS: 'http://nphies.sa/terminology/CodeSystem/ksa-message-events',
  SCIENTIFIC_CODES: 'http://nphies.sa/terminology/CodeSystem/scientific-codes',
  COVERAGE_TYPE: 'http://nphies.sa/terminology/CodeSystem/coverage-type',
  CLAIM_INFO_CATEGORY: 'http://nphies.sa/terminology/CodeSystem/claim-information-category',
  CLAIM_INFO_CODE: 'http://nphies.sa/terminology/CodeSystem/claim-information-code',
  ICD10: 'http://hl7.org/fhir/sid/icd-10',
  CLAIM_TYPE: 'http://terminology.hl7.org/CodeSystem/claim-type',
  ACT_CODE: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
  DIAGNOSIS_TYPE: 'http://terminology.hl7.org/CodeSystem/ex-diagnosistype',
  SUBSCRIBER_RELATIONSHIP: 'http://terminology.hl7.org/CodeSystem/subscriber-relationship',
  IDENTIFIER_TYPE: 'http://terminology.hl7.org/CodeSystem/v2-0203',
  PROCESS_PRIORITY: 'http://terminology.hl7.org/CodeSystem/processpriority',
} as const;

// ---------------------------------------------------------------------------
// Error Types
// ---------------------------------------------------------------------------

export class NphiesError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;
  public readonly messageAr: string;

  constructor(
    message: string,
    messageAr: string,
    code: string = 'NPHIES_ERROR',
    statusCode: number = 500,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'NphiesError';
    this.code = code;
    this.statusCode = statusCode;
    this.messageAr = messageAr;
    this.details = details;
  }
}

export class NphiesValidationError extends NphiesError {
  public readonly fieldErrors: Record<string, string>;

  constructor(
    message: string,
    messageAr: string,
    fieldErrors: Record<string, string>,
  ) {
    super(message, messageAr, 'NPHIES_VALIDATION_ERROR', 400, { fieldErrors });
    this.name = 'NphiesValidationError';
    this.fieldErrors = fieldErrors;
  }
}

export class NphiesConnectionError extends NphiesError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(
      message,
      'فشل الاتصال بخادم NPHIES',
      'NPHIES_CONNECTION_ERROR',
      503,
      details,
    );
    this.name = 'NphiesConnectionError';
  }
}

export class NphiesTimeoutError extends NphiesError {
  constructor() {
    super(
      'NPHIES request timed out',
      'انتهت مهلة طلب NPHIES',
      'NPHIES_TIMEOUT',
      504,
    );
    this.name = 'NphiesTimeoutError';
  }
}

// ---------------------------------------------------------------------------
// FHIR Resource Type Interfaces (simplified for NPHIES)
// ---------------------------------------------------------------------------

export interface FhirMeta {
  profile?: string[];
  lastUpdated?: string;
  versionId?: string;
}

export interface FhirCoding {
  system?: string;
  code?: string;
  display?: string;
  version?: string;
}

export interface FhirCodeableConcept {
  coding?: FhirCoding[];
  text?: string;
}

export interface FhirIdentifier {
  system?: string;
  value?: string;
  type?: FhirCodeableConcept;
  use?: 'usual' | 'official' | 'temp' | 'secondary' | 'old';
}

export interface FhirReference {
  reference?: string;
  type?: string;
  identifier?: FhirIdentifier;
  display?: string;
}

export interface FhirMoney {
  value?: number;
  currency?: string;
}

export interface FhirPeriod {
  start?: string;
  end?: string;
}

export interface FhirQuantity {
  value?: number;
  unit?: string;
  system?: string;
  code?: string;
}

export interface FhirExtension {
  url: string;
  valueString?: string;
  valueCode?: string;
  valueBoolean?: boolean;
  valueInteger?: number;
  valueMoney?: FhirMoney;
  valueReference?: FhirReference;
  valuePeriod?: FhirPeriod;
}

export interface FhirBundleEntry {
  fullUrl?: string;
  resource?: FhirResource;
}

export interface FhirResource {
  resourceType: string;
  id?: string;
  meta?: FhirMeta;
  [key: string]: unknown;
}

export interface FhirBundle extends FhirResource {
  resourceType: 'Bundle';
  type: 'message' | 'transaction' | 'batch' | 'searchset' | 'collection';
  timestamp?: string;
  entry?: FhirBundleEntry[];
}

export interface FhirMessageHeader extends FhirResource {
  resourceType: 'MessageHeader';
  eventCoding?: FhirCoding;
  destination?: Array<{
    endpoint?: string;
    receiver?: FhirReference;
  }>;
  sender?: FhirReference;
  source?: { endpoint?: string };
  focus?: FhirReference[];
  response?: {
    identifier?: string;
    code?: 'ok' | 'transient-error' | 'fatal-error';
    details?: FhirReference;
  };
}

export interface FhirPatient extends FhirResource {
  resourceType: 'Patient';
  identifier?: FhirIdentifier[];
  name?: Array<{
    use?: string;
    text?: string;
    family?: string;
    given?: string[];
  }>;
  gender?: string;
  birthDate?: string;
  telecom?: Array<{ system?: string; value?: string }>;
  address?: Array<{ text?: string; city?: string; country?: string }>;
}

export interface FhirCoverage extends FhirResource {
  resourceType: 'Coverage';
  status?: string;
  type?: FhirCodeableConcept;
  subscriber?: FhirReference;
  beneficiary?: FhirReference;
  relationship?: FhirCodeableConcept;
  period?: FhirPeriod;
  payor?: FhirReference[];
  identifier?: FhirIdentifier[];
  subscriberId?: string;
}

export interface FhirCoverageEligibilityRequest extends FhirResource {
  resourceType: 'CoverageEligibilityRequest';
  status?: string;
  purpose?: string[];
  patient?: FhirReference;
  servicedDate?: string;
  created?: string;
  insurer?: FhirReference;
  provider?: FhirReference;
  insurance?: Array<{
    focal?: boolean;
    coverage?: FhirReference;
  }>;
}

export interface FhirCoverageEligibilityResponse extends FhirResource {
  resourceType: 'CoverageEligibilityResponse';
  status?: string;
  purpose?: string[];
  patient?: FhirReference;
  outcome?: 'complete' | 'error' | 'partial' | 'queued';
  disposition?: string;
  insurer?: FhirReference;
  insurance?: Array<{
    coverage?: FhirReference;
    inforce?: boolean;
    benefitPeriod?: FhirPeriod;
    item?: Array<{
      category?: FhirCodeableConcept;
      name?: string;
      description?: string;
      benefit?: Array<{
        type?: FhirCodeableConcept;
        allowedMoney?: FhirMoney;
        usedMoney?: FhirMoney;
        allowedUnsignedInt?: number;
        usedUnsignedInt?: number;
      }>;
      excluded?: boolean;
      authorizationRequired?: boolean;
    }>;
  }>;
  error?: Array<{ code?: FhirCodeableConcept }>;
}

export interface FhirClaim extends FhirResource {
  resourceType: 'Claim';
  status?: string;
  type?: FhirCodeableConcept;
  use?: 'claim' | 'preauthorization' | 'predetermination';
  patient?: FhirReference;
  created?: string;
  insurer?: FhirReference;
  provider?: FhirReference;
  priority?: FhirCodeableConcept;
  insurance?: Array<{
    sequence?: number;
    focal?: boolean;
    coverage?: FhirReference;
  }>;
  diagnosis?: Array<{
    sequence?: number;
    diagnosisCodeableConcept?: FhirCodeableConcept;
    type?: FhirCodeableConcept[];
  }>;
  item?: Array<{
    sequence?: number;
    productOrService?: FhirCodeableConcept;
    servicedDate?: string;
    quantity?: FhirQuantity;
    unitPrice?: FhirMoney;
    net?: FhirMoney;
    encounter?: FhirReference[];
    extension?: FhirExtension[];
  }>;
  total?: FhirMoney;
  supportingInfo?: Array<{
    sequence?: number;
    category?: FhirCodeableConcept;
    code?: FhirCodeableConcept;
    valueString?: string;
    valueAttachment?: unknown;
  }>;
}

export interface FhirClaimResponse extends FhirResource {
  resourceType: 'ClaimResponse';
  status?: string;
  type?: FhirCodeableConcept;
  use?: string;
  patient?: FhirReference;
  outcome?: 'complete' | 'error' | 'partial' | 'queued';
  disposition?: string;
  preAuthRef?: string;
  preAuthPeriod?: FhirPeriod;
  payment?: {
    type?: FhirCodeableConcept;
    amount?: FhirMoney;
    date?: string;
  };
  total?: Array<{
    category?: FhirCodeableConcept;
    amount?: FhirMoney;
  }>;
  item?: Array<{
    itemSequence?: number;
    noteNumber?: number[];
    adjudication?: AdjudicationDetail[];
  }>;
  error?: Array<{ code?: FhirCodeableConcept }>;
  identifier?: FhirIdentifier[];
}

// ---------------------------------------------------------------------------
// Adjudication & Benefit Detail Types
// ---------------------------------------------------------------------------

export interface AdjudicationDetail {
  category?: FhirCodeableConcept;
  reason?: FhirCodeableConcept;
  amount?: FhirMoney;
  value?: number;
}

export interface BenefitDetail {
  serviceCategory: string;
  serviceCategoryDisplay?: string;
  covered: boolean;
  copay?: number;
  coinsurance?: number;
  deductible?: number;
  maxBenefit?: number;
  usedBenefit?: number;
  remainingBenefit?: number;
  authorizationRequired?: boolean;
  excluded?: boolean;
  notes?: string;
}

export interface DenialReason {
  code: string;
  display: string;
  displayAr: string;
  details?: string;
}

// ---------------------------------------------------------------------------
// Domain Interfaces
// ---------------------------------------------------------------------------

export interface NphiesPatient {
  nationalId: string;
  fullName: string;
  fullNameAr?: string;
  birthDate: string;
  gender: 'male' | 'female';
  phone?: string;
  address?: string;
}

export interface NphiesCoverage {
  insurerId: string;
  insurerName: string;
  memberId: string;
  policyNumber: string;
  planName?: string;
  relationToSubscriber: 'self' | 'spouse' | 'child' | 'other';
  subscriberId?: string;
  startDate: string;
  endDate?: string;
}

export interface NphiesEligibilityRequest {
  patient: NphiesPatient;
  coverage: NphiesCoverage;
  serviceDate: string;
  serviceType?: string;
  serviceCategories?: string[];
}

export interface NphiesEligibilityResponse {
  status: EligibilityStatus;
  eligible: boolean;
  coverageActive: boolean;
  benefitPeriod?: {
    start: string;
    end: string;
  };
  copay?: number;
  coinsurance?: number;
  deductible?: number;
  maxBenefit?: number;
  usedBenefit?: number;
  remainingBenefit?: number;
  benefits?: BenefitDetail[];
  errors?: string[];
  errorsAr?: string[];
  disposition?: string;
  rawResponse?: unknown;
}

export interface NphiesBulkEligibilityRequest {
  requests: NphiesEligibilityRequest[];
  /** Maximum concurrent requests (default: 5) */
  concurrency?: number;
}

export interface NphiesBulkEligibilityResponse {
  results: Array<{
    index: number;
    patientNationalId: string;
    response: NphiesEligibilityResponse;
  }>;
  totalProcessed: number;
  totalEligible: number;
  totalIneligible: number;
  totalErrors: number;
}

export interface NphiesPriorAuthRequest {
  patient: NphiesPatient;
  coverage: NphiesCoverage;
  encounterId?: string;
  diagnosis: {
    code: string;
    display: string;
  }[];
  services: {
    code: string;
    display: string;
    quantity: number;
    unitPrice: number;
  }[];
  supportingInfo?: {
    category: string;
    code: string;
    value: string;
  }[];
}

export interface NphiesPriorAuthResponse {
  status: PriorAuthStatus;
  approved: boolean;
  authorizationNumber?: string;
  approvedServices?: {
    code: string;
    approvedQuantity: number;
    approvedAmount: number;
  }[];
  denialReasons?: DenialReason[];
  denialReason?: string;
  denialReasonAr?: string;
  expiryDate?: string;
  disposition?: string;
  rawResponse?: unknown;
}

export interface NphiesPriorAuthStatusRequest {
  authorizationNumber: string;
  insurerId: string;
}

export interface NphiesClaimRequest {
  patient: NphiesPatient;
  coverage: NphiesCoverage;
  encounter: {
    id: string;
    type: 'outpatient' | 'inpatient' | 'emergency';
    startDate: string;
    endDate?: string;
    provider: {
      id: string;
      name: string;
      specialty: string;
    };
  };
  diagnosis: {
    code: string;
    display: string;
    type: 'principal' | 'secondary';
  }[];
  services: {
    code: string;
    display: string;
    date: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    priorAuthNumber?: string;
  }[];
  totalAmount: number;
}

export interface NphiesClaimResponse {
  status: ClaimStatus;
  accepted: boolean;
  claimId?: string;
  claimReference?: string;
  adjudicatedAmount?: number;
  patientResponsibility?: number;
  payerAmount?: number;
  adjudicationDetails?: AdjudicationDetail[];
  denialReasons?: DenialReason[];
  denialReason?: string;
  denialReasonAr?: string;
  disposition?: string;
  errors?: string[];
  errorsAr?: string[];
  rawResponse?: unknown;
}

export interface NphiesClaimStatusRequest {
  claimReference: string;
  insurerId: string;
}

export interface NphiesResubmitClaimRequest extends NphiesClaimRequest {
  originalClaimReference: string;
  resubmissionReason: string;
}

// ---------------------------------------------------------------------------
// Client / Config Types
// ---------------------------------------------------------------------------

export interface NphiesClientConfig {
  baseUrl: string;
  licenseId: string;
  senderId: string;
  providerId: string;
  clientId: string;
  clientSecret: string;
}

export interface NphiesSendBundleResult {
  success: boolean;
  data?: unknown;
  error?: unknown;
  status?: number;
  transactionId?: string;
}

// ---------------------------------------------------------------------------
// Retry Configuration
// ---------------------------------------------------------------------------

export interface NphiesRetryConfig {
  /** Maximum number of retry attempts (default: 3) */
  maxAttempts: number;
  /** Initial delay in milliseconds (default: 1000) */
  initialDelayMs: number;
  /** Multiplier for exponential backoff (default: 2) */
  backoffMultiplier: number;
  /** Maximum delay in milliseconds (default: 10000) */
  maxDelayMs: number;
}

export const DEFAULT_RETRY_CONFIG: NphiesRetryConfig = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  backoffMultiplier: 2,
  maxDelayMs: 10000,
};
