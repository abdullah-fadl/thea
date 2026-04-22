/**
 * FHIR Search → Prisma Query Builder
 *
 * Converts parsed FHIR search parameters into Prisma-compatible `where`
 * objects, sort directives, skip/take for pagination.
 */

import type { FhirSearchParam, ParsedSearch } from './searchParams';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PrismaQuery {
  where: Record<string, unknown>;
  orderBy: Record<string, 'asc' | 'desc'>;
  skip: number;
  take: number;
}

// ---------------------------------------------------------------------------
// Field Mappings: FHIR param name → Thea DB field name
// ---------------------------------------------------------------------------

type FieldMap = Record<string, string | string[]>;

const FIELD_MAPS: Record<string, FieldMap> = {
  Patient: {
    name: ['fullName', 'firstName', 'lastName'],
    family: 'lastName',
    given: 'firstName',
    identifier: 'nationalId',
    gender: 'gender',
    birthdate: 'dob',
    active: 'status',
    telecom: 'mobile',
    email: 'email',
    phone: 'mobile',
    'address-country': 'nationality',
  },
  Encounter: {
    patient: 'patientId',
    subject: 'patientId',
    status: 'status',
    class: 'encounterType',
    type: 'department',
    date: 'createdAt',
    'service-provider': 'tenantId',
  },
  Observation: {
    patient: 'patientId',
    subject: 'patientId',
    encounter: 'encounterId',
    code: 'testCode',
    category: 'category',
    status: 'status',
    date: 'resultedAt',
  },
  DiagnosticReport: {
    patient: 'patientId',
    subject: 'patientId',
    encounter: 'encounterId',
    code: 'testCode',
    category: 'resultType',
    status: 'status',
    date: 'resultedAt',
    issued: 'verifiedAt',
  },
  ImagingStudy: {
    patient: 'patientId',
    subject: 'patientId',
    encounter: 'encounterId',
    modality: 'modality',
    status: 'status',
    started: 'studyDate',
  },
  MedicationRequest: {
    patient: 'patientId',
    subject: 'patientId',
    encounter: 'encounterId',
    status: 'isActive',
    authoredon: 'createdAt',
  },
  Condition: {
    patient: 'patientId',
    subject: 'patientId',
    encounter: 'encounterId',
    code: 'icdCode',
    'clinical-status': 'status',
    onset: 'onsetDate',
  },
  AllergyIntolerance: {
    patient: 'patientId',
    code: 'allergen',
    category: 'allergyType',
    'clinical-status': 'isActive',
    criticality: 'severity',
  },
  ServiceRequest: {
    patient: 'patientMasterId',
    subject: 'patientMasterId',
    encounter: 'encounterCoreId',
    code: 'orderCode',
    category: 'kind',
    status: 'status',
    priority: 'priority',
    authored: 'orderedAt',
  },
  Coverage: {
    patient: 'patientId',
    beneficiary: 'patientId',
    status: 'status',
    type: 'planType',
    payor: 'payerName',
  },
  Procedure: {
    patient: 'patientMasterId',
    subject: 'patientMasterId',
    encounter: 'encounterCoreId',
    code: 'orderCode',
    status: 'status',
    date: 'completedAt',
  },
  Practitioner: {
    name: 'displayName',
    identifier: 'staffId',
    active: 'isArchived',
    email: 'email',
  },
  Organization: {
    name: 'name',
    identifier: 'tenantId',
    active: 'status',
  },
};

// ---------------------------------------------------------------------------
// Value Mappings: FHIR value → Thea DB value
// ---------------------------------------------------------------------------

const VALUE_MAPS: Record<string, Record<string, Record<string, unknown>>> = {
  Patient: {
    gender: { male: 'MALE', female: 'FEMALE', other: 'OTHER', unknown: 'UNKNOWN' },
    active: { true: 'ACTIVE', false: 'MERGED' },
  },
  Encounter: {
    status: {
      planned: 'CREATED', arrived: 'ACTIVE', 'in-progress': 'ACTIVE',
      finished: 'CLOSED', cancelled: 'CANCELLED',
    },
    class: { EMER: 'ER', AMB: 'OPD', IMP: 'IPD' },
  },
  Observation: {
    status: {
      registered: 'PENDING', preliminary: 'PRELIMINARY',
      final: 'FINAL', amended: 'AMENDED',
    },
  },
  ServiceRequest: {
    status: {
      active: 'PLACED', completed: 'COMPLETED', revoked: 'CANCELLED',
    },
    priority: {
      routine: 'ROUTINE', urgent: 'URGENT', stat: 'STAT', asap: 'URGENT',
    },
  },
};

// ---------------------------------------------------------------------------
// Query Builder
// ---------------------------------------------------------------------------

/**
 * Build a Prisma query from parsed FHIR search parameters.
 */
export function buildFhirQuery(
  resourceType: string,
  search: ParsedSearch,
  tenantId: string,
): PrismaQuery {
  const fieldMap = FIELD_MAPS[resourceType] || {};
  const valueMap = VALUE_MAPS[resourceType] || {};
  const where: Record<string, unknown> = { tenantId };

  for (const param of search.params) {
    const fieldName = fieldMap[param.name];
    if (!fieldName) continue;

    const mappedValue = mapValue(param, valueMap[param.name]);

    if (Array.isArray(fieldName)) {
      // Multiple fields — build Prisma OR query
      where.OR = fieldName.map((f) => buildFieldCondition(f, param, mappedValue));
    } else {
      const condition = buildFieldCondition(fieldName, param, mappedValue);
      Object.assign(where, condition);
    }
  }

  // Build sort
  const orderBy: Record<string, 'asc' | 'desc'> = {};
  if (search.sort) {
    const sortField = fieldMap[search.sort];
    if (typeof sortField === 'string') {
      orderBy[sortField] = search.sortDirection === 'desc' ? 'desc' : 'asc';
    }
  }
  if (Object.keys(orderBy).length === 0) {
    orderBy.createdAt = 'desc'; // Default: newest first
  }

  return {
    where,
    orderBy,
    skip: (search.page - 1) * search.count,
    take: search.count,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapValue(
  param: FhirSearchParam,
  valueMapping?: Record<string, unknown>,
): unknown {
  if (valueMapping && param.value in valueMapping) {
    return valueMapping[param.value];
  }
  return param.value;
}

function buildFieldCondition(
  field: string,
  param: FhirSearchParam,
  value: unknown,
): Record<string, unknown> {
  switch (param.type) {
    case 'string':
      return buildStringCondition(field, param, value);
    case 'token':
      return buildTokenCondition(field, param, value);
    case 'reference':
      return buildReferenceCondition(field, value);
    case 'date':
      return buildDateCondition(field, param, value);
    case 'number':
    case 'quantity':
      return buildNumberCondition(field, param, value);
    default:
      return { [field]: value };
  }
}

function buildStringCondition(
  field: string,
  param: FhirSearchParam,
  value: unknown,
): Record<string, unknown> {
  const v = String(value);
  if (param.modifier === 'exact') {
    return { [field]: v };
  }
  if (param.modifier === 'contains') {
    return { [field]: { contains: v, mode: 'insensitive' } };
  }
  // Default: starts-with (case-insensitive)
  return { [field]: { startsWith: v, mode: 'insensitive' } };
}

function buildTokenCondition(
  field: string,
  param: FhirSearchParam,
  value: unknown,
): Record<string, unknown> {
  const v = String(value);
  // Token can be system|code or just code
  const pipeIndex = v.indexOf('|');
  if (pipeIndex > -1) {
    // system|code — just use code for now
    return { [field]: v.substring(pipeIndex + 1) };
  }
  if (param.modifier === 'not') {
    return { [field]: { not: v } };
  }
  return { [field]: v };
}

function buildReferenceCondition(
  field: string,
  value: unknown,
): Record<string, unknown> {
  const v = String(value);
  // Reference can be ResourceType/id or just id
  const slashIndex = v.lastIndexOf('/');
  const id = slashIndex > -1 ? v.substring(slashIndex + 1) : v;
  return { [field]: id };
}

function buildDateCondition(
  field: string,
  param: FhirSearchParam,
  value: unknown,
): Record<string, unknown> {
  const dateStr = String(value);
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return {};

  switch (param.prefix) {
    case 'gt': return { [field]: { gt: date } };
    case 'ge': return { [field]: { gte: date } };
    case 'lt': return { [field]: { lt: date } };
    case 'le': return { [field]: { lte: date } };
    case 'ne': return { [field]: { not: date } };
    case 'eq':
    default: {
      // For dates, "eq" means the whole day
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);
      return { [field]: { gte: dayStart, lte: dayEnd } };
    }
  }
}

function buildNumberCondition(
  field: string,
  param: FhirSearchParam,
  value: unknown,
): Record<string, unknown> {
  const num = Number(value);
  if (isNaN(num)) return {};

  switch (param.prefix) {
    case 'gt': return { [field]: { gt: num } };
    case 'ge': return { [field]: { gte: num } };
    case 'lt': return { [field]: { lt: num } };
    case 'le': return { [field]: { lte: num } };
    case 'ne': return { [field]: { not: num } };
    case 'eq':
    default:
      return { [field]: num };
  }
}
