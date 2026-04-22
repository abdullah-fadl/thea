/**
 * FHIR R4 Core Types
 *
 * Canonical types for FHIR R4 resources used throughout Thea.
 * Re-uses existing NPHIES types where possible and extends for
 * general-purpose FHIR server operations.
 */

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

export interface FhirMeta {
  versionId?: string;
  lastUpdated?: string;
  profile?: string[];
}

export interface FhirCoding {
  system?: string;
  code?: string;
  display?: string;
}

export interface FhirCodeableConcept {
  coding?: FhirCoding[];
  text?: string;
}

export interface FhirIdentifier {
  use?: 'usual' | 'official' | 'temp' | 'secondary' | 'old';
  type?: FhirCodeableConcept;
  system?: string;
  value?: string;
}

export interface FhirReference {
  reference?: string;
  type?: string;
  display?: string;
}

export interface FhirPeriod {
  start?: string;
  end?: string;
}

export interface FhirHumanName {
  use?: 'usual' | 'official' | 'temp' | 'nickname' | 'anonymous' | 'old' | 'maiden';
  text?: string;
  family?: string;
  given?: string[];
  prefix?: string[];
  suffix?: string[];
}

export interface FhirContactPoint {
  system?: 'phone' | 'fax' | 'email' | 'pager' | 'url' | 'sms' | 'other';
  value?: string;
  use?: 'home' | 'work' | 'temp' | 'old' | 'mobile';
}

export interface FhirAddress {
  use?: 'home' | 'work' | 'temp' | 'old' | 'billing';
  type?: 'postal' | 'physical' | 'both';
  text?: string;
  line?: string[];
  city?: string;
  district?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface FhirQuantity {
  value?: number;
  unit?: string;
  system?: string;
  code?: string;
  comparator?: '<' | '<=' | '>=' | '>';
}

export interface FhirMoney {
  value?: number;
  currency?: string;
}

export interface FhirAnnotation {
  authorReference?: FhirReference;
  authorString?: string;
  time?: string;
  text: string;
}

export interface FhirAttachment {
  contentType?: string;
  language?: string;
  data?: string;
  url?: string;
  size?: number;
  hash?: string;
  title?: string;
  creation?: string;
}

export interface FhirNarrative {
  status: 'generated' | 'extensions' | 'additional' | 'empty';
  div: string;
}

// ---------------------------------------------------------------------------
// Base Resource
// ---------------------------------------------------------------------------

export interface FhirResource {
  resourceType: string;
  id?: string;
  meta?: FhirMeta;
  text?: FhirNarrative;
}

// ---------------------------------------------------------------------------
// Bundle
// ---------------------------------------------------------------------------

export interface FhirBundleEntry {
  fullUrl?: string;
  resource?: FhirResource;
  search?: { mode?: 'match' | 'include' | 'outcome'; score?: number };
  request?: { method: string; url: string };
  response?: { status: string; location?: string; etag?: string; lastModified?: string };
}

export interface FhirBundle extends FhirResource {
  resourceType: 'Bundle';
  type: 'searchset' | 'batch' | 'transaction' | 'document' | 'message' | 'collection' | 'history';
  total?: number;
  link?: { relation: string; url: string }[];
  entry?: FhirBundleEntry[];
  timestamp?: string;
}

// ---------------------------------------------------------------------------
// Patient
// ---------------------------------------------------------------------------

export interface FhirPatient extends FhirResource {
  resourceType: 'Patient';
  identifier?: FhirIdentifier[];
  active?: boolean;
  name?: FhirHumanName[];
  telecom?: FhirContactPoint[];
  gender?: 'male' | 'female' | 'other' | 'unknown';
  birthDate?: string;
  deceasedBoolean?: boolean;
  deceasedDateTime?: string;
  address?: FhirAddress[];
  maritalStatus?: FhirCodeableConcept;
  contact?: {
    relationship?: FhirCodeableConcept[];
    name?: FhirHumanName;
    telecom?: FhirContactPoint[];
  }[];
  generalPractitioner?: FhirReference[];
  managingOrganization?: FhirReference;
}

// ---------------------------------------------------------------------------
// Encounter
// ---------------------------------------------------------------------------

export interface FhirEncounter extends FhirResource {
  resourceType: 'Encounter';
  identifier?: FhirIdentifier[];
  status: 'planned' | 'arrived' | 'triaged' | 'in-progress' | 'onleave' | 'finished' | 'cancelled' | 'entered-in-error' | 'unknown';
  class: FhirCoding;
  type?: FhirCodeableConcept[];
  serviceType?: FhirCodeableConcept;
  priority?: FhirCodeableConcept;
  subject?: FhirReference;
  participant?: {
    type?: FhirCodeableConcept[];
    period?: FhirPeriod;
    individual?: FhirReference;
  }[];
  period?: FhirPeriod;
  reasonCode?: FhirCodeableConcept[];
  diagnosis?: {
    condition: FhirReference;
    use?: FhirCodeableConcept;
    rank?: number;
  }[];
  hospitalization?: {
    admitSource?: FhirCodeableConcept;
    dischargeDisposition?: FhirCodeableConcept;
  };
  location?: {
    location: FhirReference;
    status?: string;
    period?: FhirPeriod;
  }[];
  serviceProvider?: FhirReference;
}

// ---------------------------------------------------------------------------
// Observation (Lab Results + Vitals)
// ---------------------------------------------------------------------------

export interface FhirObservation extends FhirResource {
  resourceType: 'Observation';
  identifier?: FhirIdentifier[];
  status: 'registered' | 'preliminary' | 'final' | 'amended' | 'corrected' | 'cancelled' | 'entered-in-error' | 'unknown';
  category?: FhirCodeableConcept[];
  code: FhirCodeableConcept;
  subject?: FhirReference;
  encounter?: FhirReference;
  effectiveDateTime?: string;
  effectivePeriod?: FhirPeriod;
  issued?: string;
  performer?: FhirReference[];
  valueQuantity?: FhirQuantity;
  valueString?: string;
  valueCodeableConcept?: FhirCodeableConcept;
  interpretation?: FhirCodeableConcept[];
  note?: FhirAnnotation[];
  referenceRange?: {
    low?: FhirQuantity;
    high?: FhirQuantity;
    type?: FhirCodeableConcept;
    text?: string;
  }[];
  component?: {
    code: FhirCodeableConcept;
    valueQuantity?: FhirQuantity;
    valueString?: string;
    interpretation?: FhirCodeableConcept[];
    referenceRange?: FhirObservation['referenceRange'];
  }[];
}

// ---------------------------------------------------------------------------
// DiagnosticReport
// ---------------------------------------------------------------------------

export interface FhirDiagnosticReport extends FhirResource {
  resourceType: 'DiagnosticReport';
  identifier?: FhirIdentifier[];
  status: 'registered' | 'partial' | 'preliminary' | 'final' | 'amended' | 'corrected' | 'appended' | 'cancelled' | 'entered-in-error' | 'unknown';
  category?: FhirCodeableConcept[];
  code: FhirCodeableConcept;
  subject?: FhirReference;
  encounter?: FhirReference;
  effectiveDateTime?: string;
  effectivePeriod?: FhirPeriod;
  issued?: string;
  performer?: FhirReference[];
  result?: FhirReference[];
  imagingStudy?: FhirReference[];
  conclusion?: string;
  conclusionCode?: FhirCodeableConcept[];
  presentedForm?: FhirAttachment[];
}

// ---------------------------------------------------------------------------
// ImagingStudy
// ---------------------------------------------------------------------------

export interface FhirImagingStudy extends FhirResource {
  resourceType: 'ImagingStudy';
  identifier?: FhirIdentifier[];
  status: 'registered' | 'available' | 'cancelled' | 'entered-in-error' | 'unknown';
  modality?: FhirCoding[];
  subject: FhirReference;
  encounter?: FhirReference;
  started?: string;
  basedOn?: FhirReference[];
  numberOfSeries?: number;
  numberOfInstances?: number;
  procedureReference?: FhirReference;
  procedureCode?: FhirCodeableConcept[];
  description?: string;
  series?: {
    uid: string;
    number?: number;
    modality: FhirCoding;
    description?: string;
    numberOfInstances?: number;
    bodySite?: FhirCoding;
    laterality?: FhirCoding;
    instance?: {
      uid: string;
      sopClass: FhirCoding;
      number?: number;
      title?: string;
    }[];
  }[];
}

// ---------------------------------------------------------------------------
// MedicationRequest
// ---------------------------------------------------------------------------

export interface FhirMedicationRequest extends FhirResource {
  resourceType: 'MedicationRequest';
  identifier?: FhirIdentifier[];
  status: 'active' | 'on-hold' | 'cancelled' | 'completed' | 'entered-in-error' | 'stopped' | 'draft' | 'unknown';
  intent: 'proposal' | 'plan' | 'order' | 'original-order' | 'reflex-order' | 'filler-order' | 'instance-order' | 'option';
  medicationCodeableConcept?: FhirCodeableConcept;
  medicationReference?: FhirReference;
  subject: FhirReference;
  encounter?: FhirReference;
  authoredOn?: string;
  requester?: FhirReference;
  dosageInstruction?: {
    text?: string;
    timing?: { repeat?: { frequency?: number; period?: number; periodUnit?: string } };
    route?: FhirCodeableConcept;
    doseAndRate?: { doseQuantity?: FhirQuantity }[];
  }[];
  note?: FhirAnnotation[];
}

// ---------------------------------------------------------------------------
// Condition (Diagnoses)
// ---------------------------------------------------------------------------

export interface FhirCondition extends FhirResource {
  resourceType: 'Condition';
  identifier?: FhirIdentifier[];
  clinicalStatus?: FhirCodeableConcept;
  verificationStatus?: FhirCodeableConcept;
  category?: FhirCodeableConcept[];
  severity?: FhirCodeableConcept;
  code?: FhirCodeableConcept;
  bodySite?: FhirCodeableConcept[];
  subject: FhirReference;
  encounter?: FhirReference;
  onsetDateTime?: string;
  abatementDateTime?: string;
  recordedDate?: string;
  recorder?: FhirReference;
  note?: FhirAnnotation[];
}

// ---------------------------------------------------------------------------
// AllergyIntolerance
// ---------------------------------------------------------------------------

export interface FhirAllergyIntolerance extends FhirResource {
  resourceType: 'AllergyIntolerance';
  identifier?: FhirIdentifier[];
  clinicalStatus?: FhirCodeableConcept;
  verificationStatus?: FhirCodeableConcept;
  type?: 'allergy' | 'intolerance';
  category?: ('food' | 'medication' | 'environment' | 'biologic')[];
  criticality?: 'low' | 'high' | 'unable-to-assess';
  code?: FhirCodeableConcept;
  patient: FhirReference;
  encounter?: FhirReference;
  onsetDateTime?: string;
  recordedDate?: string;
  recorder?: FhirReference;
  reaction?: {
    substance?: FhirCodeableConcept;
    manifestation: FhirCodeableConcept[];
    severity?: 'mild' | 'moderate' | 'severe';
    description?: string;
  }[];
}

// ---------------------------------------------------------------------------
// Procedure
// ---------------------------------------------------------------------------

export interface FhirProcedure extends FhirResource {
  resourceType: 'Procedure';
  identifier?: FhirIdentifier[];
  status: 'preparation' | 'in-progress' | 'not-done' | 'on-hold' | 'stopped' | 'completed' | 'entered-in-error' | 'unknown';
  category?: FhirCodeableConcept;
  code?: FhirCodeableConcept;
  subject: FhirReference;
  encounter?: FhirReference;
  performedDateTime?: string;
  performedPeriod?: FhirPeriod;
  performer?: { actor: FhirReference; function?: FhirCodeableConcept }[];
  reasonCode?: FhirCodeableConcept[];
  bodySite?: FhirCodeableConcept[];
  outcome?: FhirCodeableConcept;
  report?: FhirReference[];
  note?: FhirAnnotation[];
}

// ---------------------------------------------------------------------------
// ServiceRequest (Orders)
// ---------------------------------------------------------------------------

export interface FhirServiceRequest extends FhirResource {
  resourceType: 'ServiceRequest';
  identifier?: FhirIdentifier[];
  status: 'draft' | 'active' | 'on-hold' | 'revoked' | 'completed' | 'entered-in-error' | 'unknown';
  intent: 'proposal' | 'plan' | 'directive' | 'order' | 'original-order' | 'reflex-order' | 'filler-order' | 'instance-order' | 'option';
  category?: FhirCodeableConcept[];
  priority?: 'routine' | 'urgent' | 'asap' | 'stat';
  code?: FhirCodeableConcept;
  subject: FhirReference;
  encounter?: FhirReference;
  authoredOn?: string;
  requester?: FhirReference;
  performer?: FhirReference[];
  reasonCode?: FhirCodeableConcept[];
  note?: FhirAnnotation[];
}

// ---------------------------------------------------------------------------
// Organization
// ---------------------------------------------------------------------------

export interface FhirOrganization extends FhirResource {
  resourceType: 'Organization';
  identifier?: FhirIdentifier[];
  active?: boolean;
  type?: FhirCodeableConcept[];
  name?: string;
  telecom?: FhirContactPoint[];
  address?: FhirAddress[];
}

// ---------------------------------------------------------------------------
// Practitioner
// ---------------------------------------------------------------------------

export interface FhirPractitioner extends FhirResource {
  resourceType: 'Practitioner';
  identifier?: FhirIdentifier[];
  active?: boolean;
  name?: FhirHumanName[];
  telecom?: FhirContactPoint[];
  gender?: 'male' | 'female' | 'other' | 'unknown';
  birthDate?: string;
  qualification?: {
    identifier?: FhirIdentifier[];
    code: FhirCodeableConcept;
    period?: FhirPeriod;
    issuer?: FhirReference;
  }[];
}

// ---------------------------------------------------------------------------
// Coverage (Insurance)
// ---------------------------------------------------------------------------

export interface FhirCoverage extends FhirResource {
  resourceType: 'Coverage';
  identifier?: FhirIdentifier[];
  status: 'active' | 'cancelled' | 'draft' | 'entered-in-error';
  type?: FhirCodeableConcept;
  subscriber?: FhirReference;
  subscriberId?: string;
  beneficiary: FhirReference;
  relationship?: FhirCodeableConcept;
  period?: FhirPeriod;
  payor: FhirReference[];
  class?: {
    type: FhirCodeableConcept;
    value: string;
    name?: string;
  }[];
}

// ---------------------------------------------------------------------------
// CapabilityStatement
// ---------------------------------------------------------------------------

export interface FhirCapabilityStatement extends FhirResource {
  resourceType: 'CapabilityStatement';
  status: 'draft' | 'active' | 'retired' | 'unknown';
  date: string;
  publisher?: string;
  kind: 'instance' | 'capability' | 'requirements';
  software?: { name: string; version?: string };
  implementation?: { description: string; url?: string };
  fhirVersion: string;
  format: string[];
  rest?: {
    mode: 'server' | 'client';
    resource?: {
      type: string;
      interaction?: { code: string }[];
      searchParam?: { name: string; type: string; documentation?: string }[];
    }[];
    security?: {
      cors?: boolean;
      service?: FhirCodeableConcept[];
    };
  }[];
}

// ---------------------------------------------------------------------------
// OperationOutcome
// ---------------------------------------------------------------------------

export interface FhirOperationOutcome extends FhirResource {
  resourceType: 'OperationOutcome';
  issue: {
    severity: 'fatal' | 'error' | 'warning' | 'information';
    code: string;
    diagnostics?: string;
    details?: FhirCodeableConcept;
    location?: string[];
  }[];
}

// ---------------------------------------------------------------------------
// Subscription
// ---------------------------------------------------------------------------

export interface FhirSubscription extends FhirResource {
  resourceType: 'Subscription';
  status: 'requested' | 'active' | 'error' | 'off';
  reason: string;
  criteria: string;
  channel: {
    type: 'rest-hook' | 'websocket' | 'email' | 'sms' | 'message';
    endpoint?: string;
    payload?: string;
    header?: string[];
  };
  end?: string;
}
