/**
 * FHIR Search Parameter Parser
 *
 * Parses FHIR R4 search parameters from URL query strings and converts
 * them to structured search criteria for the query builder.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FhirSearchParamType = 'string' | 'token' | 'reference' | 'date' | 'number' | 'quantity';

export interface FhirSearchParam {
  name: string;
  type: FhirSearchParamType;
  value: string;
  modifier?: string;       // :exact, :contains, :missing, :not
  prefix?: string;          // eq, ne, lt, gt, le, ge, sa, eb, ap (for date/number)
}

export interface ParsedSearch {
  params: FhirSearchParam[];
  page: number;
  count: number;
  sort?: string;
  sortDirection: 'asc' | 'desc';
  include?: string[];
  revinclude?: string[];
  summary?: 'true' | 'text' | 'data' | 'count' | 'false';
}

// ---------------------------------------------------------------------------
// Resource Search Parameter Definitions
// ---------------------------------------------------------------------------

type ParamDef = Record<string, FhirSearchParamType>;

const SEARCH_PARAMS: Record<string, ParamDef> = {
  Patient: {
    name: 'string', family: 'string', given: 'string',
    identifier: 'token', gender: 'token', birthdate: 'date',
    active: 'token', telecom: 'token', address: 'string',
    'address-city': 'string', 'address-country': 'string',
    email: 'token', phone: 'token',
  },
  Encounter: {
    patient: 'reference', subject: 'reference', status: 'token',
    class: 'token', type: 'token', date: 'date',
    'service-provider': 'reference',
  },
  Observation: {
    patient: 'reference', subject: 'reference', encounter: 'reference',
    code: 'token', category: 'token', status: 'token',
    date: 'date', 'value-quantity': 'quantity',
    'combo-code': 'token',
  },
  DiagnosticReport: {
    patient: 'reference', subject: 'reference', encounter: 'reference',
    code: 'token', category: 'token', status: 'token',
    date: 'date', issued: 'date',
  },
  ImagingStudy: {
    patient: 'reference', subject: 'reference', encounter: 'reference',
    modality: 'token', status: 'token', started: 'date',
  },
  MedicationRequest: {
    patient: 'reference', subject: 'reference', encounter: 'reference',
    status: 'token', intent: 'token', authoredon: 'date',
    medication: 'reference',
  },
  Condition: {
    patient: 'reference', subject: 'reference', encounter: 'reference',
    code: 'token', 'clinical-status': 'token', 'verification-status': 'token',
    category: 'token', onset: 'date',
  },
  AllergyIntolerance: {
    patient: 'reference', code: 'token', category: 'token',
    'clinical-status': 'token', criticality: 'token', type: 'token',
  },
  ServiceRequest: {
    patient: 'reference', subject: 'reference', encounter: 'reference',
    code: 'token', category: 'token', status: 'token',
    priority: 'token', authored: 'date',
  },
  Coverage: {
    patient: 'reference', beneficiary: 'reference',
    status: 'token', type: 'token', payor: 'reference',
  },
  Procedure: {
    patient: 'reference', subject: 'reference', encounter: 'reference',
    code: 'token', status: 'token', date: 'date',
  },
  Practitioner: {
    name: 'string', identifier: 'token', active: 'token',
    email: 'token', phone: 'token',
  },
  Organization: {
    name: 'string', identifier: 'token', active: 'token', type: 'token',
  },
};

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

/**
 * Parse URL search params into structured FHIR search criteria.
 */
export function parseFhirSearchParams(
  resourceType: string,
  searchParams: URLSearchParams,
): ParsedSearch {
  const defs = SEARCH_PARAMS[resourceType] || {};
  const params: FhirSearchParam[] = [];

  // Pagination
  const page = Math.max(1, parseInt(searchParams.get('_page') || '1'));
  const count = Math.min(100, Math.max(1, parseInt(searchParams.get('_count') || '20')));

  // Sort
  let sort = searchParams.get('_sort') || undefined;
  let sortDirection: 'asc' | 'desc' = 'asc';
  if (sort?.startsWith('-')) {
    sort = sort.slice(1);
    sortDirection = 'desc';
  }

  // Include/RevInclude
  const include = searchParams.getAll('_include').filter(Boolean);
  const revinclude = searchParams.getAll('_revinclude').filter(Boolean);

  // Summary
  const summary = searchParams.get('_summary') as ParsedSearch['summary'];

  // Parse search parameters
  for (const [key, value] of searchParams.entries()) {
    if (key.startsWith('_')) continue; // Skip meta parameters

    // Check for modifiers (e.g., name:exact)
    const parts = key.split(':');
    const paramName = parts[0];
    const modifier = parts[1];

    const type = defs[paramName];
    if (!type) continue; // Unknown parameter — skip

    // Check for prefix on date/number (e.g., ge2024-01-01)
    let prefix: string | undefined;
    let paramValue = value;

    if (type === 'date' || type === 'number' || type === 'quantity') {
      const prefixMatch = value.match(/^(eq|ne|lt|gt|le|ge|sa|eb|ap)(.+)/);
      if (prefixMatch) {
        prefix = prefixMatch[1];
        paramValue = prefixMatch[2];
      }
    }

    params.push({
      name: paramName,
      type,
      value: paramValue,
      modifier,
      prefix,
    });
  }

  return { params, page, count, sort, sortDirection, include, revinclude, summary };
}

/**
 * Get supported search parameters for a resource type.
 */
export function getSupportedSearchParams(resourceType: string): ParamDef {
  return SEARCH_PARAMS[resourceType] || {};
}
