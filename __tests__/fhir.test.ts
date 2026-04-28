/**
 * 20 FHIR R4 Tests
 *
 * Validates FHIR mappers (toFhir/fromFhir), search parameter parsing,
 * query building, CapabilityStatement, subscriptions, and route guards.
 *
 * Categories:
 *  1-3   toFhir mappers (Patient, Encounter class mapping, Observation)
 *  4-5   fromFhir mappers (Patient identifiers, Encounter status)
 *  6-7   Helper functions (isoDate/isoDateOnly via source, sanitize/findIdentifier/toDate via source)
 *  8-10  Search params (modifiers, date prefixes, pagination)
 *  11-12 Query builder (field mappings, value mappings)
 *  13-14 CapabilityStatement, operationOutcome
 *  15-16 Subscription matchesCriteria, toFhirSubscription source
 *  17-18 Route file checks (metadata public, Patient withAuthTenant)
 *  19    buildSearchBundle creates valid Bundle
 *  20    getSupportedSearchParams for Patient/Encounter
 */

import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

import { toFhirPatient, toFhirEncounter, toFhirObservation, buildSearchBundle, buildEntry } from '@/lib/fhir/mappers/toFhir'
import { fromFhirPatient, fromFhirEncounter } from '@/lib/fhir/mappers/fromFhir'
import { parseFhirSearchParams, getSupportedSearchParams } from '@/lib/fhir/search/searchParams'
import { buildFhirQuery } from '@/lib/fhir/search/queryBuilder'

function readSource(relPath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relPath), 'utf-8')
}

// ─────────────────────────────────────────────────────────────────────────────
// Group 1: toFhir Mappers (FHIR-01 .. FHIR-03)
// ─────────────────────────────────────────────────────────────────────────────
describe('FHIR — toFhir Mappers', () => {
  // FHIR-01: toFhirPatient maps names and identifiers
  it('FHIR-01: toFhirPatient maps patient names, identifiers, and gender', () => {
    const patient = toFhirPatient({
      id: 'p-001',
      mrn: 'MRN-12345',
      nationalId: '1234567890',
      iqama: '2345678901',
      firstName: 'Ahmed',
      middleName: 'Mohammed',
      lastName: 'Al-Rashid',
      fullName: 'Ahmed Mohammed Al-Rashid',
      gender: 'MALE',
      dob: '1990-05-15',
      mobile: '+966501234567',
      email: 'ahmed@test.com',
      status: 'KNOWN',
    })

    expect(patient.resourceType).toBe('Patient')
    expect(patient.id).toBe('p-001')
    expect(patient.active).toBe(true)
    expect(patient.gender).toBe('male')

    // Identifiers: mrn, nationalId, iqama
    expect(patient.identifier).toBeDefined()
    expect(patient.identifier!.length).toBe(3)
    expect(patient.identifier!.find(i => i.system === 'https://thea.com.sa/fhir/mrn')?.value).toBe('MRN-12345')
    expect(patient.identifier!.find(i => i.system === 'https://nphies.sa/identifier/nid')?.value).toBe('1234567890')
    expect(patient.identifier!.find(i => i.system === 'https://nphies.sa/identifier/iqama')?.value).toBe('2345678901')

    // Name
    expect(patient.name![0].family).toBe('Al-Rashid')
    expect(patient.name![0].given).toContain('Ahmed')

    // Telecom
    expect(patient.telecom).toBeDefined()
    expect(patient.telecom!.find(t => t.system === 'phone')?.value).toBe('+966501234567')
    expect(patient.telecom!.find(t => t.system === 'email')?.value).toBe('ahmed@test.com')

    // MERGED → active=false
    const merged = toFhirPatient({ id: 'p-002', status: 'MERGED' })
    expect(merged.active).toBe(false)
  })

  // FHIR-02: toFhirEncounter class mapping ER→EMER, OPD→AMB, IPD→IMP
  it('FHIR-02: toFhirEncounter maps class correctly (ER→EMER, OPD→AMB, IPD→IMP)', () => {
    const erEnc = toFhirEncounter({ id: 'e-1', encounterType: 'ER', status: 'ACTIVE', patientId: 'p-1' })
    expect(erEnc.resourceType).toBe('Encounter')
    expect(erEnc.class.code).toBe('EMER')

    const opdEnc = toFhirEncounter({ id: 'e-2', encounterType: 'OPD', status: 'ACTIVE' })
    expect(opdEnc.class.code).toBe('AMB')

    const ipdEnc = toFhirEncounter({ id: 'e-3', encounterType: 'IPD', status: 'ACTIVE' })
    expect(ipdEnc.class.code).toBe('IMP')

    // Status mapping: ACTIVE→in-progress, CLOSED→finished, CANCELLED→cancelled
    expect(erEnc.status).toBe('in-progress')

    const closed = toFhirEncounter({ id: 'e-4', status: 'CLOSED' })
    expect(closed.status).toBe('finished')

    const cancelled = toFhirEncounter({ id: 'e-5', status: 'CANCELLED' })
    expect(cancelled.status).toBe('cancelled')
  })

  // FHIR-03: toFhirObservation maps value and abnormalFlag
  it('FHIR-03: toFhirObservation maps numeric value, unit, and abnormal flags', () => {
    const obs = toFhirObservation({
      id: 'obs-1',
      testCode: 'GLU',
      testName: 'Glucose',
      value: 140,
      unit: 'mg/dL',
      status: 'FINAL',
      patientId: 'p-1',
      encounterId: 'e-1',
      flag: 'H',
    })

    expect(obs.resourceType).toBe('Observation')
    expect(obs.status).toBe('final')
    expect(obs.valueQuantity?.value).toBe(140)
    expect(obs.valueQuantity?.unit).toBe('mg/dL')
    expect(obs.interpretation).toBeDefined()
    expect(obs.interpretation![0].coding![0].code).toBe('H')

    // String value
    const strObs = toFhirObservation({ id: 'obs-2', value: 'Positive', status: 'FINAL' })
    expect(strObs.valueString).toBe('Positive')
    expect(strObs.valueQuantity).toBeUndefined()

    // Critical high flag
    const critical = toFhirObservation({ id: 'obs-3', value: 500, flag: 'HH' })
    expect(critical.interpretation![0].coding![0].code).toBe('HH')
    expect(critical.interpretation![0].coding![0].display).toBe('Critical High')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Group 2: fromFhir Mappers (FHIR-04 .. FHIR-05)
// ─────────────────────────────────────────────────────────────────────────────
describe('FHIR — fromFhir Mappers', () => {
  // FHIR-04: fromFhirPatient extracts identifiers
  it('FHIR-04: fromFhirPatient extracts names, identifiers, and gender', () => {
    const result = fromFhirPatient({
      resourceType: 'Patient',
      id: 'fhir-p1',
      identifier: [
        { system: 'https://thea.com.sa/fhir/mrn', value: 'MRN-999' },
        { system: 'https://nphies.sa/identifier/nid', value: '1234567890' },
        { system: 'https://nphies.sa/identifier/passport', value: 'AB123456' },
      ],
      name: [{ use: 'official', text: 'Ahmed Al-Rashid', family: 'Al-Rashid', given: ['Ahmed', 'Mohammed'] }],
      gender: 'male',
      birthDate: '1990-05-15',
      telecom: [
        { system: 'phone', value: '+966501234567' },
        { system: 'email', value: 'ahmed@test.com' },
      ],
      active: true,
    } as Record<string, unknown>)

    expect(result.mrn).toBe('MRN-999')
    expect(result.nationalId).toBe('1234567890')
    expect(result.passport).toBe('AB123456')
    expect(result.firstName).toBe('Ahmed')
    expect(result.middleName).toBe('Mohammed')
    expect(result.lastName).toBe('Al-Rashid')
    expect(result.gender).toBe('MALE')
    expect(result.status).toBe('KNOWN')

    // active=false → MERGED
    const merged = fromFhirPatient({ resourceType: 'Patient', active: false } as Record<string, unknown>)
    expect(merged.status).toBe('MERGED')
  })

  // FHIR-05: fromFhirEncounter maps FHIR status to Thea status
  it('FHIR-05: fromFhirEncounter maps FHIR statuses to Thea statuses', () => {
    const enc = fromFhirEncounter({
      resourceType: 'Encounter',
      id: 'fhir-e1',
      status: 'in-progress',
      class: { code: 'AMB' },
      subject: { reference: 'Patient/p-1' },
    } as Record<string, unknown>)

    expect(enc.status).toBe('ACTIVE')

    const finished = fromFhirEncounter({
      resourceType: 'Encounter', id: 'e2', status: 'finished',
      class: { code: 'EMER' },
    } as Record<string, unknown>)
    expect(finished.status).toBe('CLOSED')

    const planned = fromFhirEncounter({
      resourceType: 'Encounter', id: 'e3', status: 'planned',
      class: { code: 'IMP' },
    } as Record<string, unknown>)
    expect(planned.status).toBe('CREATED')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Group 3: Helper functions via source inspection (FHIR-06 .. FHIR-07)
// ─────────────────────────────────────────────────────────────────────────────
describe('FHIR — Helper Functions', () => {
  // FHIR-06: isoDate, isoDateOnly, ref helpers in toFhir
  it('FHIR-06: toFhir.ts has isoDate, isoDateOnly, ref helper functions', () => {
    const src = readSource('lib/fhir/mappers/toFhir.ts')

    expect(src).toContain('function isoDate(d: Date | string | null | undefined)')
    expect(src).toContain('function isoDateOnly(d: Date | string | null | undefined)')
    expect(src).toContain("function ref(resourceType: string, id: string, display?: string)")
    expect(src).toContain("const THEA_SYSTEM = 'https://thea.com.sa/fhir'")
  })

  // FHIR-07: sanitize, findIdentifier, toDate helpers in fromFhir
  it('FHIR-07: fromFhir.ts has sanitize, findIdentifier, toDate helpers', () => {
    const src = readSource('lib/fhir/mappers/fromFhir.ts')

    expect(src).toContain('function sanitize(value: string | undefined | null, maxLen = 200)')
    expect(src).toContain('function findIdentifier(identifiers:')
    expect(src).toContain('function toDate(s: string | undefined)')
    // sanitize strips control chars
    expect(src).toContain('replace(/[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F]/g')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Group 4: Search Parameters (FHIR-08 .. FHIR-10)
// ─────────────────────────────────────────────────────────────────────────────
describe('FHIR — Search Parameters', () => {
  // FHIR-08: parseFhirSearchParams handles modifiers :exact/:contains
  it('FHIR-08: parseFhirSearchParams parses modifiers :exact and :contains', () => {
    const params = new URLSearchParams('name:exact=Ahmed&family:contains=Al')
    const parsed = parseFhirSearchParams('Patient', params)

    expect(parsed.params.length).toBe(2)
    const nameParam = parsed.params.find(p => p.name === 'name')
    expect(nameParam?.modifier).toBe('exact')
    expect(nameParam?.value).toBe('Ahmed')

    const familyParam = parsed.params.find(p => p.name === 'family')
    expect(familyParam?.modifier).toBe('contains')
    expect(familyParam?.value).toBe('Al')
  })

  // FHIR-09: parseFhirSearchParams handles date prefixes ge/lt
  it('FHIR-09: parseFhirSearchParams extracts date prefixes (ge, lt)', () => {
    const params = new URLSearchParams('birthdate=ge2020-01-01&birthdate=lt2025-12-31')
    const parsed = parseFhirSearchParams('Patient', params)

    expect(parsed.params.length).toBe(2)
    expect(parsed.params[0].prefix).toBe('ge')
    expect(parsed.params[0].value).toBe('2020-01-01')
    expect(parsed.params[1].prefix).toBe('lt')
    expect(parsed.params[1].value).toBe('2025-12-31')
  })

  // FHIR-10: parseFhirSearchParams handles pagination and sort
  it('FHIR-10: parseFhirSearchParams parses _count, _page, _sort, _summary', () => {
    const params = new URLSearchParams('_count=50&_page=3&_sort=-birthdate&_summary=count')
    const parsed = parseFhirSearchParams('Patient', params)

    expect(parsed.count).toBe(50)
    expect(parsed.page).toBe(3)
    expect(parsed.sort).toBe('birthdate')
    expect(parsed.sortDirection).toBe('desc')
    expect(parsed.summary).toBe('count')

    // _count capped at 100
    const huge = parseFhirSearchParams('Patient', new URLSearchParams('_count=500'))
    expect(huge.count).toBe(100)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Group 5: Query Builder (FHIR-11 .. FHIR-12)
// ─────────────────────────────────────────────────────────────────────────────
describe('FHIR — Query Builder', () => {
  // FHIR-11: buildFhirQuery maps FHIR params to Prisma where
  it('FHIR-11: buildFhirQuery builds Prisma-compatible where clause', () => {
    const params = new URLSearchParams('name=Ahmed&gender=male')
    const parsed = parseFhirSearchParams('Patient', params)
    const query = buildFhirQuery('Patient', parsed, 'tenant-123')

    expect(query.where.tenantId).toBe('tenant-123')
    expect(query.skip).toBeDefined()
    expect(query.take).toBeDefined()
  })

  // FHIR-12: query builder field mappings are correct
  it('FHIR-12: queryBuilder.ts has correct FHIR→Thea field mappings', () => {
    const src = readSource('lib/fhir/search/queryBuilder.ts')

    // Patient field mappings
    expect(src).toContain("family: 'lastName'")
    expect(src).toContain("given: 'firstName'")
    expect(src).toContain("birthdate: 'dob'")
    expect(src).toContain("gender: 'gender'")

    // Encounter field mappings
    expect(src).toContain("patient: 'patientId'")
    expect(src).toContain("class: 'encounterType'")
    expect(src).toContain("date: 'createdAt'")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Group 6: CapabilityStatement & OperationOutcome (FHIR-13 .. FHIR-14)
// ─────────────────────────────────────────────────────────────────────────────
describe('FHIR — Server Core', () => {
  // FHIR-13: buildCapabilityStatement via source inspection
  it('FHIR-13: buildCapabilityStatement returns valid FHIR CapabilityStatement', () => {
    const src = readSource('lib/fhir/server.ts')

    expect(src).toContain("export function buildCapabilityStatement(baseUrl: string)")
    expect(src).toContain("resourceType: 'CapabilityStatement'")
    expect(src).toContain("id: 'thea-fhir-server'")
    expect(src).toContain("fhirVersion: '4.0.1'")
    expect(src).toContain("format: ['application/fhir+json', 'application/json']")
    expect(src).toContain("software: { name: 'Thea EHR', version: '2.0.0' }")
    expect(src).toContain("mode: 'server'")
    // Supports 13 resource types
    expect(src).toContain("'Patient', 'Encounter', 'Observation', 'DiagnosticReport'")
  })

  // FHIR-14: operationOutcome function exists
  it('FHIR-14: server.ts has operationOutcome helper and FHIR CRUD functions', () => {
    const src = readSource('lib/fhir/server.ts')

    expect(src).toContain('operationOutcome')
    expect(src).toContain('fhirRead')
    expect(src).toContain('fhirSearch')
    expect(src).toContain('fhirCreate')
    expect(src).toContain('fhirUpdate')
    // Summary=count optimization
    expect(src).toContain("parsed.summary === 'count'")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Group 7: Subscriptions (FHIR-15 .. FHIR-16)
// ─────────────────────────────────────────────────────────────────────────────
describe('FHIR — Subscriptions', () => {
  // FHIR-15: matchesCriteria logic via source inspection
  it('FHIR-15: subscription manager has matchesCriteria with ResourceType?param=value format', () => {
    const src = readSource('lib/fhir/subscriptions/manager.ts')

    expect(src).toContain('function matchesCriteria(')
    expect(src).toContain("const [criteriaType, queryString] = criteria.split('?')")
    expect(src).toContain('if (criteriaType !== resourceType) return false')
    expect(src).toContain('if (!queryString) return true')
    // 10s timeout for webhook
    expect(src).toContain('AbortSignal.timeout(10000)')
  })

  // FHIR-16: subscription CRUD and notification dispatch
  it('FHIR-16: subscription manager exports CRUD + notifySubscribers', () => {
    const src = readSource('lib/fhir/subscriptions/manager.ts')

    expect(src).toContain('export async function createSubscription(')
    expect(src).toContain('export async function listSubscriptions(')
    expect(src).toContain('export async function getSubscription(')
    expect(src).toContain('export async function deleteSubscription(')
    expect(src).toContain('export async function notifySubscribers(')
    // Only rest-hook supported
    expect(src).toContain("subscription.channel.type !== 'rest-hook'")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Group 8: Route File Checks (FHIR-17 .. FHIR-18)
// ─────────────────────────────────────────────────────────────────────────────
describe('FHIR — Route Guards', () => {
  // FHIR-17: metadata route is public (no auth)
  it('FHIR-17: metadata route is public with no auth guard', () => {
    const src = readSource('app/api/fhir/metadata/route.ts')

    // No withAuthTenant — this is public per FHIR spec
    expect(src).not.toContain('withAuthTenant')
    expect(src).toContain('buildCapabilityStatement')
    expect(src).toContain("'Content-Type': 'application/fhir+json'")
    expect(src).toMatch(/export (async function|const) GET/)
  })

  // FHIR-18: Patient route is read-only and flag-gated (Phase 5.4)
  it('FHIR-18: Patient route is read-only, flag-gated, and uses fhir.patient.read permission', () => {
    const src = readSource('app/api/fhir/Patient/route.ts')

    expect(src).toContain("import { withAuthTenant } from '@/lib/core/guards/withAuthTenant'")
    expect(src).toContain("import { withErrorHandler } from '@/lib/core/errors'")
    expect(src).toContain('export const GET = withAuthTenant(')
    // Phase 5.4: read-only — no write endpoints
    expect(src).not.toContain('export const POST = withAuthTenant(')
    expect(src).not.toContain('export const PUT = withAuthTenant(')
    // Phase 5.4: feature-flagged
    expect(src).toContain("isEnabled('FF_FHIR_API_ENABLED')")
    expect(src).toContain("permissionKey: 'fhir.patient.read'")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Group 9: buildSearchBundle & getSupportedSearchParams (FHIR-19 .. FHIR-20)
// ─────────────────────────────────────────────────────────────────────────────
describe('FHIR — Bundle & Params', () => {
  // FHIR-19: buildSearchBundle creates valid Bundle structure
  it('FHIR-19: buildSearchBundle creates a valid FHIR searchset Bundle', () => {
    const entry = buildEntry(
      { resourceType: 'Patient', id: 'p-1', name: [{ text: 'Test' }] },
      'https://thea.health',
    )

    const bundle = buildSearchBundle([entry], 1, 'https://thea.health', 'Patient')

    expect(bundle.resourceType).toBe('Bundle')
    expect(bundle.type).toBe('searchset')
    expect(bundle.total).toBe(1)
    expect(bundle.link![0].relation).toBe('self')
    expect(bundle.link![0].url).toBe('https://thea.health/api/fhir/Patient')
    expect(bundle.entry).toHaveLength(1)
    expect(bundle.entry![0].fullUrl).toBe('https://thea.health/api/fhir/Patient/p-1')
    expect(bundle.entry![0].search?.mode).toBe('match')
    expect(bundle.timestamp).toBeDefined()

    // Empty bundle
    const empty = buildSearchBundle([], 0, 'https://thea.health')
    expect(empty.total).toBe(0)
    expect(empty.entry).toEqual([])
  })

  // FHIR-20: getSupportedSearchParams returns correct params
  it('FHIR-20: getSupportedSearchParams returns params for Patient and Encounter', () => {
    const patientParams = getSupportedSearchParams('Patient')
    expect(patientParams.name).toBe('string')
    expect(patientParams.family).toBe('string')
    expect(patientParams.identifier).toBe('token')
    expect(patientParams.gender).toBe('token')
    expect(patientParams.birthdate).toBe('date')

    const encounterParams = getSupportedSearchParams('Encounter')
    expect(encounterParams.patient).toBe('reference')
    expect(encounterParams.status).toBe('token')
    expect(encounterParams.class).toBe('token')
    expect(encounterParams.date).toBe('date')

    // Unknown resource returns empty
    const unknown = getSupportedSearchParams('FakeResource')
    expect(Object.keys(unknown)).toHaveLength(0)
  })
})
