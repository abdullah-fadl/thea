/**
 * FHIR R4 Server Core
 *
 * Handles FHIR REST operations: read, search, create, update, delete.
 * Maps between Thea database models (Prisma) and FHIR resources.
 */

import { v4 as uuidv4 } from 'uuid';
import { prisma } from '@/lib/db/prisma';
import type { FhirResource, FhirBundle, FhirOperationOutcome, FhirCapabilityStatement } from './resources/types';
import { parseFhirSearchParams, getSupportedSearchParams } from './search/searchParams';
import { buildFhirQuery } from './search/queryBuilder';
import * as toFhir from './mappers/toFhir';
import { logger } from '@/lib/monitoring/logger';

// ---------------------------------------------------------------------------
// Prisma Model Mapping
// ---------------------------------------------------------------------------

/**
 * Returns the Prisma delegate (e.g. prisma.patientMaster) for a given
 * FHIR resource type.  The cast to `any` is intentional — we use the
 * delegate generically via findFirst / findMany / create / update / count.
 */
function prismaModel(resourceType: string): any | null {
  switch (resourceType) {
    case 'Patient':            return prisma.patientMaster;
    case 'Encounter':          return prisma.encounterCore;
    case 'Observation':        return prisma.labResult;
    case 'DiagnosticReport':   return prisma.orderResult;
    case 'ImagingStudy':       return prisma.radiologyReport;
    case 'MedicationRequest':  return prisma.homeMedication;
    case 'Condition':          return prisma.patientProblem;
    case 'AllergyIntolerance': return prisma.patientAllergy;
    case 'ServiceRequest':     return prisma.ordersHub;
    case 'Coverage':           return prisma.patientInsurance;
    case 'Procedure':          return prisma.ordersHub;
    case 'Practitioner':       return prisma.user;
    case 'Organization':       return prisma.tenant;
    default:                   return null;
  }
}

const SUPPORTED_RESOURCE_TYPES = [
  'Patient', 'Encounter', 'Observation', 'DiagnosticReport',
  'ImagingStudy', 'MedicationRequest', 'Condition', 'AllergyIntolerance',
  'ServiceRequest', 'Coverage', 'Procedure', 'Practitioner', 'Organization',
];

const RESOURCE_MAPPERS: Record<string, (doc: Record<string, unknown>) => FhirResource> = {
  Patient: toFhir.toFhirPatient,
  Encounter: toFhir.toFhirEncounter,
  Observation: (d) => toFhir.toFhirObservation(d, 'laboratory'),
  DiagnosticReport: toFhir.toFhirDiagnosticReport,
  ImagingStudy: toFhir.toFhirImagingStudy,
  MedicationRequest: toFhir.toFhirMedicationRequest,
  Condition: toFhir.toFhirCondition,
  AllergyIntolerance: toFhir.toFhirAllergyIntolerance,
  ServiceRequest: toFhir.toFhirServiceRequest,
  Coverage: toFhir.toFhirCoverage,
  Procedure: toFhir.toFhirProcedure,
  Practitioner: toFhir.toFhirPractitioner,
};

// ---------------------------------------------------------------------------
// Capability Statement
// ---------------------------------------------------------------------------

export function buildCapabilityStatement(baseUrl: string): FhirCapabilityStatement {
  return {
    resourceType: 'CapabilityStatement',
    id: 'thea-fhir-server',
    status: 'active',
    date: new Date().toISOString(),
    publisher: 'Thea EHR',
    kind: 'instance',
    software: { name: 'Thea EHR', version: '2.0.0' },
    implementation: {
      description: 'Thea EHR FHIR R4 Server',
      url: `${baseUrl}/api/fhir`,
    },
    fhirVersion: '4.0.1',
    format: ['application/fhir+json', 'application/json'],
    rest: [{
      mode: 'server',
      security: {
        cors: true,
        service: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/restful-security-service', code: 'SMART-on-FHIR' }] }],
      },
      resource: SUPPORTED_RESOURCE_TYPES.map((type) => ({
        type,
        interaction: [
          { code: 'read' },
          { code: 'search-type' },
          { code: 'create' },
          { code: 'update' },
        ],
        searchParam: Object.entries(getSupportedSearchParams(type)).map(([name, paramType]) => ({
          name,
          type: paramType,
        })),
      })),
    }],
  };
}

// ---------------------------------------------------------------------------
// FHIR Operations
// ---------------------------------------------------------------------------

/**
 * Read a single resource by ID.
 */
export async function fhirRead(
  tenantId: string,
  resourceType: string,
  id: string,
): Promise<FhirResource | FhirOperationOutcome> {
  const model = prismaModel(resourceType);
  const mapper = RESOURCE_MAPPERS[resourceType];

  if (!model || !mapper) {
    return operationOutcome('error', 'not-supported', `Resource type ${resourceType} is not supported`);
  }

  const doc = await model.findFirst({
    where: { tenantId, id },
  });

  if (!doc) {
    return operationOutcome('error', 'not-found', `${resourceType}/${id} not found`);
  }

  return mapper(doc as Record<string, unknown>);
}

/**
 * Search for resources.
 */
export async function fhirSearch(
  tenantId: string,
  resourceType: string,
  searchParams: URLSearchParams,
  baseUrl: string,
): Promise<FhirBundle> {
  const model = prismaModel(resourceType);
  const mapper = RESOURCE_MAPPERS[resourceType];

  if (!model || !mapper) {
    return toFhir.buildSearchBundle([], 0, baseUrl, resourceType);
  }

  const parsed = parseFhirSearchParams(resourceType, searchParams);

  // Summary=count — just return the count
  if (parsed.summary === 'count') {
    const query = buildFhirQuery(resourceType, parsed, tenantId);
    const total = await model.count({ where: query.where });
    return toFhir.buildSearchBundle([], total, baseUrl, resourceType);
  }

  const query = buildFhirQuery(resourceType, parsed, tenantId);

  // Add extra filter for Procedure — only kind=PROCEDURE from orders_hub
  if (resourceType === 'Procedure') {
    query.where.kind = 'PROCEDURE';
  }

  const [docs, total] = await Promise.all([
    model.findMany({
      where: query.where,
      orderBy: query.orderBy,
      skip: query.skip,
      take: query.take,
    }),
    model.count({ where: query.where }),
  ]);

  const entries = (docs as Record<string, unknown>[]).map((doc: Record<string, unknown>) =>
    toFhir.buildEntry(mapper(doc) as unknown as Record<string, unknown>, baseUrl),
  );

  return toFhir.buildSearchBundle(entries, total, baseUrl, resourceType);
}

/**
 * Create a new resource.
 */
export async function fhirCreate(
  tenantId: string,
  resourceType: string,
  resource: Record<string, unknown>,
): Promise<{ resource: FhirResource; id: string } | FhirOperationOutcome> {
  const model = prismaModel(resourceType);
  if (!model) {
    return operationOutcome('error', 'not-supported', `Resource type ${resourceType} is not supported`);
  }

  const id = uuidv4();
  const now = new Date();

  const doc = await model.create({
    data: {
      ...resource,
      id,
      tenantId,
      createdAt: now,
      updatedAt: now,
    },
  });

  const mapper = RESOURCE_MAPPERS[resourceType];
  const fhirResource = mapper ? mapper(doc as Record<string, unknown>) : { resourceType, id } as FhirResource;

  logger.info('FHIR resource created', {
    category: 'api',
    tenantId,
    resourceType,
    resourceId: id,
  } as Record<string, unknown>);

  return { resource: fhirResource, id };
}

/**
 * Update an existing resource.
 */
export async function fhirUpdate(
  tenantId: string,
  resourceType: string,
  id: string,
  updates: Record<string, unknown>,
): Promise<FhirResource | FhirOperationOutcome> {
  const model = prismaModel(resourceType);
  if (!model) {
    return operationOutcome('error', 'not-supported', `Resource type ${resourceType} is not supported`);
  }

  // First check the record exists for this tenant
  const existing = await model.findFirst({
    where: { tenantId, id },
  });

  if (!existing) {
    return operationOutcome('error', 'not-found', `${resourceType}/${id} not found`);
  }

  // [F-01] Ensure tenant isolation on update — use updateMany with tenantId filter
  const { tenantId: _ignoredTid, id: _ignoredId, ...safeUpdates } = updates;
  await model.updateMany({
    where: { tenantId, id },
    data: { ...safeUpdates, updatedAt: new Date() },
  });

  // Return updated resource
  return fhirRead(tenantId, resourceType, id);
}

/**
 * Patient/$everything — returns a bundle of all patient data.
 */
export async function fhirEverything(
  tenantId: string,
  patientId: string,
  baseUrl: string,
): Promise<FhirBundle> {
  const entries: FhirBundle['entry'] = [];

  // Patient
  const patient = await prisma.patientMaster.findFirst({
    where: { tenantId, id: patientId },
  });

  if (!patient) {
    return toFhir.buildSearchBundle([], 0, baseUrl);
  }

  entries.push(toFhir.buildEntry(toFhir.toFhirPatient(patient as unknown as Record<string, unknown>) as unknown as Record<string, unknown>, baseUrl));

  // Fetch all related resources in parallel
  const [
    encounters, observations, conditions, allergies,
    medications, orders, coverage, procedures,
  ] = await Promise.all([
    prisma.encounterCore.findMany({
      where: { tenantId, patientId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    prisma.labResult.findMany({
      where: { tenantId, patientId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    prisma.patientProblem.findMany({
      where: { tenantId, patientId },
      take: 100,
    }),
    prisma.patientAllergy.findMany({
      where: { tenantId, patientId },
      take: 100,
    }),
    prisma.homeMedication.findMany({
      where: { tenantId, patientId },
      take: 100,
    }),
    prisma.ordersHub.findMany({
      where: { tenantId, patientMasterId: patientId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    prisma.patientInsurance.findMany({
      where: { tenantId, patientId },
      take: 20,
    }),
    prisma.ordersHub.findMany({
      where: { tenantId, patientMasterId: patientId, kind: 'PROCEDURE' },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
  ]);

  for (const e of encounters as unknown as Record<string, unknown>[]) entries.push(toFhir.buildEntry(toFhir.toFhirEncounter(e) as unknown as Record<string, unknown>, baseUrl));
  for (const o of observations as unknown as Record<string, unknown>[]) entries.push(toFhir.buildEntry(toFhir.toFhirObservation(o) as unknown as Record<string, unknown>, baseUrl));
  for (const c of conditions as unknown as Record<string, unknown>[]) entries.push(toFhir.buildEntry(toFhir.toFhirCondition(c) as unknown as Record<string, unknown>, baseUrl));
  for (const a of allergies as unknown as Record<string, unknown>[]) entries.push(toFhir.buildEntry(toFhir.toFhirAllergyIntolerance(a) as unknown as Record<string, unknown>, baseUrl));
  for (const m of medications as unknown as Record<string, unknown>[]) entries.push(toFhir.buildEntry(toFhir.toFhirMedicationRequest(m) as unknown as Record<string, unknown>, baseUrl));
  for (const s of orders as unknown as Record<string, unknown>[]) entries.push(toFhir.buildEntry(toFhir.toFhirServiceRequest(s) as unknown as Record<string, unknown>, baseUrl));
  for (const cv of coverage as unknown as Record<string, unknown>[]) entries.push(toFhir.buildEntry(toFhir.toFhirCoverage(cv) as unknown as Record<string, unknown>, baseUrl));
  for (const p of procedures as unknown as Record<string, unknown>[]) entries.push(toFhir.buildEntry(toFhir.toFhirProcedure(p) as unknown as Record<string, unknown>, baseUrl));

  return toFhir.buildSearchBundle(entries, entries.length, baseUrl);
}

// ---------------------------------------------------------------------------
// OperationOutcome Helper
// ---------------------------------------------------------------------------

export function operationOutcome(
  severity: 'fatal' | 'error' | 'warning' | 'information',
  code: string,
  diagnostics: string,
): FhirOperationOutcome {
  return {
    resourceType: 'OperationOutcome',
    issue: [{ severity, code, diagnostics }],
  };
}
