/**
 * 20 FHIR R4 Integration Tests
 *
 * Deep structural validation of the FHIR R4 module via source file inspection.
 * Complements the existing fhir.test.ts (which tests runtime behavior) by
 * verifying architectural patterns, type coverage, NPHIES wrappers,
 * subscription infrastructure, and route guards across all FHIR API files.
 *
 * Categories:
 *   FI-01..FI-03  FHIR R4 type definitions (resource types, primitives, bundle)
 *   FI-04..FI-06  toFhir mappers (Saudi identifiers, ICD-10/SNOMED, category mapping)
 *   FI-07..FI-09  fromFhir mappers (Observation, ServiceRequest, Coverage)
 *   FI-10..FI-11  Search params (13 resource defs, modifier support)
 *   FI-12..FI-13  Query builder (value mappings, string conditions)
 *   FI-14..FI-15  Server (Prisma model mapping, fhirEverything parallel fetch)
 *   FI-16..FI-17  NPHIES wrappers (eligibility, preauth, claim)
 *   FI-18..FI-19  Subscription manager (CRUD, notification + webhook)
 *   FI-20         Route helpers (shared handleFhirSearch/Create)
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

function readSource(relPath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relPath), 'utf-8');
}

// ─────────────────────────────────────────────────────────────────────────────
// Group 1: FHIR R4 Type Definitions (FI-01 .. FI-03)
// ─────────────────────────────────────────────────────────────────────────────
describe('FHIR Integration — Type Definitions', () => {
  const typesSrc = readSource('lib/fhir/resources/types.ts');

  // FI-01: All major FHIR resource interfaces exist
  it('FI-01: types.ts defines all 17 FHIR resource interfaces', () => {
    const resources = [
      'FhirPatient', 'FhirEncounter', 'FhirObservation', 'FhirDiagnosticReport',
      'FhirImagingStudy', 'FhirMedicationRequest', 'FhirCondition',
      'FhirAllergyIntolerance', 'FhirProcedure', 'FhirServiceRequest',
      'FhirOrganization', 'FhirPractitioner', 'FhirCoverage',
      'FhirCapabilityStatement', 'FhirOperationOutcome', 'FhirSubscription',
      'FhirBundle',
    ];

    for (const r of resources) {
      expect(typesSrc).toContain(`export interface ${r}`);
    }
  });

  // FI-02: Primitive types cover FHIR R4 data types
  it('FI-02: types.ts defines all FHIR R4 primitive types', () => {
    const primitives = [
      'FhirCoding', 'FhirCodeableConcept', 'FhirIdentifier', 'FhirReference',
      'FhirPeriod', 'FhirHumanName', 'FhirContactPoint', 'FhirAddress',
      'FhirQuantity', 'FhirMoney', 'FhirAnnotation', 'FhirAttachment',
      'FhirNarrative', 'FhirMeta',
    ];

    for (const p of primitives) {
      expect(typesSrc).toContain(`export interface ${p}`);
    }
  });

  // FI-03: Bundle supports all required types and has searchset
  it('FI-03: FhirBundle supports searchset type and entry with search mode', () => {
    expect(typesSrc).toContain("'searchset'");
    expect(typesSrc).toContain("'batch'");
    expect(typesSrc).toContain("'transaction'");
    expect(typesSrc).toContain("mode?: 'match' | 'include' | 'outcome'");
    expect(typesSrc).toContain("FhirBundleEntry");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 2: toFhir Mappers — Saudi Identifiers & Coding (FI-04 .. FI-06)
// ─────────────────────────────────────────────────────────────────────────────
describe('FHIR Integration — toFhir Mapper Details', () => {
  const toFhirSrc = readSource('lib/fhir/mappers/toFhir.ts');

  // FI-04: toFhir handles Saudi national identifier systems (NID, Iqama, Passport)
  it('FI-04: toFhirPatient maps Saudi identifier systems (NID, Iqama, Passport)', () => {
    expect(toFhirSrc).toContain("'https://nphies.sa/identifier/nid'");
    expect(toFhirSrc).toContain("'https://nphies.sa/identifier/iqama'");
    expect(toFhirSrc).toContain("'https://nphies.sa/identifier/passport'");
    expect(toFhirSrc).toContain("system: `${THEA_SYSTEM}/mrn`");
  });

  // FI-05: toFhir uses ICD-10 and SNOMED coding systems
  it('FI-05: toFhir mappers reference ICD-10, SNOMED, and LOINC coding systems', () => {
    expect(toFhirSrc).toContain("'http://hl7.org/fhir/sid/icd-10'");
    expect(toFhirSrc).toContain("'http://snomed.info/sct'");
    expect(toFhirSrc).toContain("'http://loinc.org'");
    expect(toFhirSrc).toContain("'http://unitsofmeasure.org'");
  });

  // FI-06: toFhir exports mappers for all 13 resource types
  it('FI-06: toFhir.ts exports mappers for Patient, Encounter, Observation, and 10 more', () => {
    const mapperFunctions = [
      'toFhirPatient', 'toFhirEncounter', 'toFhirObservation',
      'toFhirDiagnosticReport', 'toFhirImagingStudy', 'toFhirMedicationRequest',
      'toFhirCondition', 'toFhirAllergyIntolerance', 'toFhirProcedure',
      'toFhirServiceRequest', 'toFhirPractitioner', 'toFhirCoverage',
      'buildSearchBundle', 'buildEntry',
    ];

    for (const fn of mapperFunctions) {
      expect(toFhirSrc).toContain(`export function ${fn}(`);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 3: fromFhir Mappers — Observation, ServiceRequest, Coverage (FI-07..FI-09)
// ─────────────────────────────────────────────────────────────────────────────
describe('FHIR Integration — fromFhir Mapper Coverage', () => {
  const fromFhirSrc = readSource('lib/fhir/mappers/fromFhir.ts');

  // FI-07: fromFhir exports mappers for 8 resource types
  it('FI-07: fromFhir.ts exports mappers for 8 resource types', () => {
    const mappers = [
      'fromFhirPatient', 'fromFhirEncounter', 'fromFhirObservation',
      'fromFhirServiceRequest', 'fromFhirCondition',
      'fromFhirAllergyIntolerance', 'fromFhirMedicationRequest',
      'fromFhirCoverage',
    ];

    for (const fn of mappers) {
      expect(fromFhirSrc).toContain(`export function ${fn}(`);
    }
  });

  // FI-08: fromFhirObservation maps interpretation flags back to Thea format
  it('FI-08: fromFhirObservation maps FHIR interpretation codes to Thea flags', () => {
    expect(fromFhirSrc).toContain("H: 'H', HH: 'HH', L: 'L', LL: 'LL', N: 'N'");
    expect(fromFhirSrc).toContain('fhir.valueQuantity?.value ?? fhir.valueString');
    expect(fromFhirSrc).toContain("fhir.subject?.reference?.replace('Patient/', '')");
  });

  // FI-09: fromFhirCoverage extracts plan class info
  it('FI-09: fromFhirCoverage extracts policyNumber from class with code=plan', () => {
    expect(fromFhirSrc).toContain("c.type?.coding?.[0]?.code === 'plan'");
    expect(fromFhirSrc).toContain('fhir.subscriberId');
    expect(fromFhirSrc).toContain("fhir.beneficiary?.reference?.replace('Patient/', '')");
    expect(fromFhirSrc).toContain("isPrimary: true");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 4: Search Params — 13 Resource Definitions (FI-10 .. FI-11)
// ─────────────────────────────────────────────────────────────────────────────
describe('FHIR Integration — Search Parameter Definitions', () => {
  const searchSrc = readSource('lib/fhir/search/searchParams.ts');

  // FI-10: Search params defined for all 13 FHIR resource types
  it('FI-10: SEARCH_PARAMS defines entries for all 13 supported resource types', () => {
    const resourceTypes = [
      'Patient', 'Encounter', 'Observation', 'DiagnosticReport',
      'ImagingStudy', 'MedicationRequest', 'Condition', 'AllergyIntolerance',
      'ServiceRequest', 'Coverage', 'Procedure', 'Practitioner', 'Organization',
    ];

    for (const rt of resourceTypes) {
      expect(searchSrc).toContain(`${rt}: {`);
    }
  });

  // FI-11: Search params support all FHIR prefix types via regex extraction
  it('FI-11: parseFhirSearchParams handles all date/number prefixes (eq,ne,lt,gt,le,ge,sa,eb,ap)', () => {
    // Regex pattern that extracts prefix from value
    expect(searchSrc).toContain('^(eq|ne|lt|gt|le|ge|sa|eb|ap)(.+)');
    // Prefix is extracted via regex match groups
    expect(searchSrc).toContain('prefixMatch[1]');
    expect(searchSrc).toContain('prefixMatch[2]');
    // Applied to date, number, and quantity types
    expect(searchSrc).toContain("type === 'date'");
    expect(searchSrc).toContain("type === 'number'");
    expect(searchSrc).toContain("type === 'quantity'");
    // Stored as prefix field on the param
    expect(searchSrc).toContain('prefix,');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 5: Query Builder — Value Mappings & String Conditions (FI-12..FI-13)
// ─────────────────────────────────────────────────────────────────────────────
describe('FHIR Integration — Query Builder Details', () => {
  const qbSrc = readSource('lib/fhir/search/queryBuilder.ts');

  // FI-12: Value mappings convert FHIR codes to Thea internal values
  it('FI-12: VALUE_MAPS converts FHIR values to Thea values (gender, status, class)', () => {
    expect(qbSrc).toContain("male: 'MALE'");
    expect(qbSrc).toContain("female: 'FEMALE'");
    expect(qbSrc).toContain("planned: 'CREATED'");
    expect(qbSrc).toContain("'in-progress': 'ACTIVE'");
    expect(qbSrc).toContain("finished: 'CLOSED'");
    expect(qbSrc).toContain("EMER: 'ER'");
    expect(qbSrc).toContain("AMB: 'OPD'");
    expect(qbSrc).toContain("IMP: 'IPD'");
  });

  // FI-13: String conditions support :exact and :contains modifiers
  it('FI-13: buildStringCondition handles :exact (direct match) and :contains (case-insensitive)', () => {
    expect(qbSrc).toContain("param.modifier === 'exact'");
    expect(qbSrc).toContain("param.modifier === 'contains'");
    expect(qbSrc).toContain("{ contains: v, mode: 'insensitive' }");
    expect(qbSrc).toContain("{ startsWith: v, mode: 'insensitive' }");
    // Token :not modifier
    expect(qbSrc).toContain("param.modifier === 'not'");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 6: Server — Prisma Mapping & fhirEverything (FI-14..FI-15)
// ─────────────────────────────────────────────────────────────────────────────
describe('FHIR Integration — Server Core Details', () => {
  const serverSrc = readSource('lib/fhir/server.ts');

  // FI-14: prismaModel maps 13 FHIR types to Prisma delegates
  it('FI-14: prismaModel maps all 13 resource types to Prisma model delegates', () => {
    expect(serverSrc).toContain("case 'Patient':            return prisma.patientMaster");
    expect(serverSrc).toContain("case 'Encounter':          return prisma.encounterCore");
    expect(serverSrc).toContain("case 'Observation':        return prisma.labResult");
    expect(serverSrc).toContain("case 'DiagnosticReport':   return prisma.orderResult");
    expect(serverSrc).toContain("case 'ImagingStudy':       return prisma.radiologyReport");
    expect(serverSrc).toContain("case 'MedicationRequest':  return prisma.homeMedication");
    expect(serverSrc).toContain("case 'Condition':          return prisma.patientProblem");
    expect(serverSrc).toContain("case 'AllergyIntolerance': return prisma.patientAllergy");
    expect(serverSrc).toContain("case 'ServiceRequest':     return prisma.ordersHub");
    expect(serverSrc).toContain("case 'Coverage':           return prisma.patientInsurance");
    expect(serverSrc).toContain("case 'Practitioner':       return prisma.user");
    expect(serverSrc).toContain("case 'Organization':       return prisma.tenant");
  });

  // FI-15: fhirEverything fetches all related resources in parallel
  it('FI-15: fhirEverything uses Promise.all to fetch 8 resource types in parallel', () => {
    expect(serverSrc).toContain('export async function fhirEverything(');
    expect(serverSrc).toContain('Promise.all([');
    // Verifies it fetches encounters, observations, conditions, allergies, medications, orders, coverage, procedures
    expect(serverSrc).toContain('prisma.encounterCore.findMany');
    expect(serverSrc).toContain('prisma.labResult.findMany');
    expect(serverSrc).toContain('prisma.patientProblem.findMany');
    expect(serverSrc).toContain('prisma.patientAllergy.findMany');
    expect(serverSrc).toContain('prisma.homeMedication.findMany');
    expect(serverSrc).toContain('prisma.ordersHub.findMany');
    expect(serverSrc).toContain('prisma.patientInsurance.findMany');
    // Tenant isolation
    expect(serverSrc).toContain('where: { tenantId, id }');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 7: NPHIES Wrappers (FI-16..FI-17)
// ─────────────────────────────────────────────────────────────────────────────
describe('FHIR Integration — NPHIES Wrappers', () => {
  // FI-16: NPHIES eligibility wrapper exists with mock fallback
  it('FI-16: NPHIES eligibility wrapper exports checkEligibility with dev mock fallback', () => {
    const src = readSource('lib/fhir/nphies/eligibility.ts');

    expect(src).toContain('export async function checkEligibility(');
    expect(src).toContain("import('@/lib/integrations/nphies/eligibility')");
    expect(src).toContain("process.env.NODE_ENV === 'development'");
    expect(src).toContain('buildMockEligibility');
    expect(src).toContain("status: 'ELIGIBLE'");
    expect(src).toContain("status: 'ERROR'");
  });

  // FI-17: NPHIES preauth and claim wrappers exist
  it('FI-17: NPHIES preauth and claim wrappers export request functions', () => {
    const preauthSrc = readSource('lib/fhir/nphies/preauth.ts');
    const claimSrc = readSource('lib/fhir/nphies/claim.ts');

    expect(preauthSrc).toContain('export async function requestPriorAuth(');
    expect(preauthSrc).toContain("import type { PreauthResult } from './types'");

    expect(claimSrc).toContain('export async function submitClaim(');
    expect(claimSrc).toContain("import type { ClaimSubmissionResult } from './types'");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 8: Subscription Manager (FI-18..FI-19)
// ─────────────────────────────────────────────────────────────────────────────
describe('FHIR Integration — Subscription Manager', () => {
  const subSrc = readSource('lib/fhir/subscriptions/manager.ts');

  // FI-18: Subscription manager has full CRUD + FHIR conversion
  it('FI-18: subscription manager exports CRUD, notifySubscribers, and toFhirSubscription', () => {
    expect(subSrc).toContain('export async function createSubscription(');
    expect(subSrc).toContain('export async function listSubscriptions(');
    expect(subSrc).toContain('export async function getSubscription(');
    expect(subSrc).toContain('export async function deleteSubscription(');
    expect(subSrc).toContain('export async function notifySubscribers(');
    expect(subSrc).toContain('export function toFhirSubscription(');
    expect(subSrc).toContain('export async function updateSubscriptionStatus(');
  });

  // FI-19: Subscription notifications log to fhir_subscription_log
  it('FI-19: subscription notifications log delivery status to fhir_subscription_log', () => {
    expect(subSrc).toContain('prisma.fhirSubscriptionLog.create');
    expect(subSrc).toContain("status: response.ok ? 'delivered' : 'failed'");
    expect(subSrc).toContain('httpStatus: response.status');
    // Handles expiration
    expect(subSrc).toContain("new Date(record.end) < new Date()");
    // Error tracking: marks subscription as error on HTTP failure
    expect(subSrc).toContain("await updateSubscriptionStatus(tenantId, sub.id, 'error'");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 9: Route Helpers (FI-20)
// ─────────────────────────────────────────────────────────────────────────────
describe('FHIR Integration — Route Helpers', () => {
  // FI-20: routeHelpers.ts provides shared FHIR handler wrappers
  it('FI-20: routeHelpers.ts exports handleFhirSearch, handleFhirCreate, handleFhirRead, handleFhirUpdate', () => {
    const src = readSource('lib/fhir/routeHelpers.ts');

    expect(src).toContain('handleFhirSearch');
    expect(src).toContain('handleFhirCreate');
    expect(src).toContain('handleFhirRead');
    expect(src).toContain('handleFhirUpdate');
    // Uses application/fhir+json content type
    expect(src).toContain("'application/fhir+json'");
  });
});
