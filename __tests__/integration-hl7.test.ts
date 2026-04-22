/**
 * 20 Integration (HL7/ASTM) Tests
 *
 * Validates HL7 parsing/building, ASTM protocol parsing, segment extraction,
 * message queue constants, and route-level integration patterns.
 *
 * Categories:
 *  1-3   HL7 parser (detectMessageType, extractLabResults, extractADTEvent)
 *  4-5   HL7 builder (buildADT structure, buildORMWithORC structure)
 *  6-7   HL7 builder (buildORU, buildACK source)
 *  8-9   HL7 segments (parseORC, parsePV1)
 *  10-12 ASTM parser (ASTM constants, extractFrameData, calculateChecksum)
 *  13-14 ASTM message parsing (parseASTMMessage, convertASTMToUnified)
 *  15-16 Message queue constants, logMessage/markForRetry source
 *  17-18 Route file checks (hl7/receive, instruments)
 *  19    Instrument schema validation
 *  20    HL7 type definitions
 */

import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

import { ASTM, extractFrameData, calculateChecksum, parseASTMMessage, convertASTMToUnified } from '@/lib/integration/astm/parser'
import { buildADT, buildORMWithORC, buildORU } from '@/lib/integration/hl7/builder'

function readSource(relPath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relPath), 'utf-8')
}

// ─────────────────────────────────────────────────────────────────────────────
// Group 1: HL7 Parser (INT-01 .. INT-03)
// ─────────────────────────────────────────────────────────────────────────────
describe('Integration — HL7 Parser', () => {
  // INT-01: detectMessageType via source inspection
  it('INT-01: parser.ts re-exports parseHL7Message and has detectMessageType', () => {
    const src = readSource('lib/integration/hl7/parser.ts')

    expect(src).toContain('export { baseParseHL7Message as parseHL7Message')
    expect(src).toContain('export function detectMessageType(rawMessage: string): string')
    expect(src).toContain("return 'UNKNOWN'")
    expect(src).toContain('export function extractLabResults(message: HL7Message)')
    expect(src).toContain('export function extractADTEvent(message: HL7Message)')
  })

  // INT-02: extractLabResults only processes ORU messages
  it('INT-02: extractLabResults only processes ORU messages and returns null otherwise', () => {
    const src = readSource('lib/integration/hl7/parser.ts')

    expect(src).toContain("if (!message.type.startsWith('ORU')) return null")
    expect(src).toContain("const pidSegment = getSegment(message, 'PID')")
    expect(src).toContain('if (results.length === 0) return null')
    // Maps OBX abnormal flags
    expect(src).toContain("abnormalFlag: (obx.abnormalFlags || 'N') as AbnormalFlag")
    expect(src).toContain("status: (obx.observationResultStatus || 'F') as ResultStatus")
  })

  // INT-03: extractADTEvent only processes ADT messages
  it('INT-03: extractADTEvent only processes ADT messages', () => {
    const src = readSource('lib/integration/hl7/parser.ts')

    expect(src).toContain("if (!message.type.startsWith('ADT')) return null")
    expect(src).toContain("const pv1Segment = getSegment(message, 'PV1')")
    expect(src).toContain("message.type.replace('ADT_', '') as ADTEvent['eventType']")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Group 2: HL7 Builder (INT-04 .. INT-07)
// ─────────────────────────────────────────────────────────────────────────────
describe('Integration — HL7 Builder', () => {
  // INT-04: buildADT creates valid ADT message with MSH/EVN/PID/PV1
  it('INT-04: buildADT creates a valid ADT message with required segments', () => {
    const msg = buildADT({
      sendingApplication: 'THEA',
      sendingFacility: 'HOSPITAL',
      receivingApplication: 'HIS',
      receivingFacility: 'LAB',
      eventType: 'A01',
      patientId: 'P-12345',
      patientName: 'Al-Rashid^Ahmed',
      dateOfBirth: '19900515',
      sex: 'M',
      patientClass: 'I',
      assignedLocation: 'ICU-1',
      attendingDoctor: 'Dr. Smith',
      visitNumber: 'V-001',
    })

    const segments = msg.split('\r')
    expect(segments.length).toBe(4)

    // MSH segment
    expect(segments[0]).toContain('MSH|^~\\&|THEA|HOSPITAL|HIS|LAB')
    expect(segments[0]).toContain('ADT^A01')
    expect(segments[0]).toContain('P|2.5')

    // EVN segment
    expect(segments[1]).toContain('EVN|A01')

    // PID segment
    expect(segments[2]).toContain('PID|1||P-12345^^^MRN||Al-Rashid^Ahmed||19900515|M')

    // PV1 segment
    expect(segments[3]).toContain('PV1|1|I')
  })

  // INT-05: buildORMWithORC creates ORM message with ORC and OBR
  it('INT-05: buildORMWithORC creates ORM with ORC and OBR segments', () => {
    const msg = buildORMWithORC({
      sendingApplication: 'THEA',
      sendingFacility: 'HOSPITAL',
      receivingApplication: 'LIS',
      receivingFacility: 'LAB',
      patientId: 'P-001',
      patientName: 'Test^Patient',
      dateOfBirth: '19850101',
      sex: 'F',
      orderId: 'ORD-100',
      orderControl: 'NW',
      orderDateTime: new Date('2025-06-01T10:00:00Z'),
      tests: [
        { code: 'CBC', name: 'Complete Blood Count', priority: 'S' },
        { code: 'BMP', name: 'Basic Metabolic Panel' },
      ],
      orderingProvider: 'Dr. Ahmed',
      clinicalInfo: 'Routine checkup',
    })

    const segments = msg.split('\r')

    // MSH
    expect(segments[0]).toContain('ORM^O01')
    // PID
    expect(segments[1]).toContain('PID|1||P-001')
    // PV1
    expect(segments[2]).toContain('PV1|1|O')
    // ORC for test 1
    expect(segments[3]).toContain('ORC|NW|ORD-100-1')
    // OBR for test 1
    expect(segments[4]).toContain('OBR|1|ORD-100-1')
    expect(segments[4]).toContain('CBC^Complete Blood Count^L')
    expect(segments[4]).toContain('|S|') // STAT priority
    // ORC/OBR for test 2
    expect(segments[5]).toContain('ORC|NW|ORD-100-2')
    expect(segments[6]).toContain('OBR|2|ORD-100-2')
  })

  // INT-06: buildORU creates ORU result message
  it('INT-06: buildORU creates ORU result message with OBX segments', () => {
    const msg = buildORU({
      sendingApplication: 'LIS',
      sendingFacility: 'LAB',
      receivingApplication: 'THEA',
      receivingFacility: 'HOSPITAL',
      patientId: 'P-001',
      patientName: 'Test^Patient',
      orderId: 'ORD-100',
      accessionNumber: 'ACC-2025-001',
      results: [
        {
          testCode: 'GLU', testName: 'Glucose', value: '120',
          unit: 'mg/dL', referenceRange: '70-110', abnormalFlag: 'H',
          status: 'F', observationDateTime: new Date('2025-06-01T12:00:00Z'),
        },
      ],
    })

    const segments = msg.split('\r')

    expect(segments[0]).toContain('ORU^R01')
    expect(segments[1]).toContain('PID|1||P-001')
    expect(segments[2]).toContain('OBR|1|ORD-100|ACC-2025-001')
    expect(segments[3]).toContain('OBX|1|NM|GLU^Glucose^L||120|mg/dL|70-110|H|||F')
  })

  // INT-07: buildACK re-exported from base builder
  it('INT-07: builder.ts re-exports buildACK and buildORM from base', () => {
    const src = readSource('lib/integration/hl7/builder.ts')

    expect(src).toContain("export { buildACK, buildORM } from '@/lib/integrations/hl7/builder'")
    expect(src).toContain('export function buildADT(options: ADTBuildOptions)')
    expect(src).toContain('export function buildORMWithORC(options: ORMBuildOptions)')
    expect(src).toContain('export function buildORU(options: ORUBuildOptions)')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Group 3: HL7 Segments (INT-08 .. INT-09)
// ─────────────────────────────────────────────────────────────────────────────
describe('Integration — HL7 Segments', () => {
  // INT-08: parseORC extracts order control fields
  it('INT-08: parseORC extracts orderControl and provider from ORC segment fields', () => {
    const src = readSource('lib/integration/hl7/segments.ts')

    expect(src).toContain('export function parseORC(segment: HL7Segment): ORCSegment')
    expect(src).toContain("orderControl: (f[0] || 'NW')")
    expect(src).toContain("placerOrderNumber: f[1] || ''")
    expect(src).toContain("fillerOrderNumber: f[2] || ''")
    expect(src).toContain("orderingProvider: f[11] || ''")
  })

  // INT-09: parsePV1 extracts patient visit information
  it('INT-09: segments.ts exports parsePV1 and PV1Segment interface', () => {
    const src = readSource('lib/integration/hl7/segments.ts')

    expect(src).toContain('export interface PV1Segment')
    expect(src).toContain('patientClass: string')
    expect(src).toContain('assignedPatientLocation: string')
    expect(src).toContain('attendingDoctor: string')
    expect(src).toContain('admitDateTime: string')
    expect(src).toContain('dischargeDateTime: string')
    expect(src).toContain('visitNumber: string')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Group 4: ASTM Parser (INT-10 .. INT-14)
// ─────────────────────────────────────────────────────────────────────────────
describe('Integration — ASTM Parser', () => {
  // INT-10: ASTM constants are correct
  it('INT-10: ASTM constants match ASTM E1394 protocol specification', () => {
    expect(ASTM.ENQ).toBe('\x05')
    expect(ASTM.ACK).toBe('\x06')
    expect(ASTM.NAK).toBe('\x15')
    expect(ASTM.STX).toBe('\x02')
    expect(ASTM.ETX).toBe('\x03')
    expect(ASTM.EOT).toBe('\x04')
    expect(ASTM.CR).toBe('\r')
    expect(ASTM.LF).toBe('\n')
    expect(ASTM.FIELD_DELIMITER).toBe('|')
    expect(ASTM.COMPONENT_DELIMITER).toBe('^')
  })

  // INT-11: extractFrameData strips framing
  it('INT-11: extractFrameData removes STX, frame number, ETX, and checksum', () => {
    // Framed data: STX + frame# + data + ETX + checksum
    const framed = `${ASTM.STX}1H|\\^&|||Analyzer${ASTM.ETX}5A${ASTM.CR}${ASTM.LF}`
    const data = extractFrameData(framed)
    expect(data).toBe('H|\\^&|||Analyzer')

    // Already clean data passes through
    const clean = extractFrameData('H|\\^&|||Analyzer')
    expect(clean).toBe('H|\\^&|||Analyzer')

    // Empty string
    expect(extractFrameData('')).toBe('')
  })

  // INT-12: calculateChecksum returns 2-char hex
  it('INT-12: calculateChecksum returns 2-character uppercase hex checksum', () => {
    const frameData = '1H|\\^&|||Analyzer'
    const checksum = calculateChecksum(frameData)

    expect(typeof checksum).toBe('string')
    expect(checksum).toHaveLength(2)
    expect(checksum).toMatch(/^[0-9A-F]{2}$/)

    // Different data → different checksum
    const checksum2 = calculateChecksum('2P|1|||Patient^Name')
    expect(checksum2).not.toBe(checksum)
  })

  // INT-13: parseASTMMessage full message parsing
  it('INT-13: parseASTMMessage parses a complete ASTM message with H/P/O/R/L records', () => {
    // ASTM records: f[0]=TypeSeq (e.g. "P1"), remaining f[1..N] are data fields
    // Parser uses: patientName=f[4], universalTestId=f[2], value=f[3], units=f[4], ref=f[5], flag=f[6]
    // We need to build data so that fields land in the right indices per each parser function
    const rawData = [
      'H1|\\^&|||Cobas 6000|||||||P|1|20250601120000',
      'P1|PID-001|||Ahmed^Al-Rashid||19900515|M',
      'O1|SPEC-001||^^^GLU|R|20250601100000',
      'R1|1|^^^GLU^Glucose|120|mg/dL|70-110|H||F||||||',
      'L1|N',
    ].join('\r')

    const message = parseASTMMessage(rawData)

    expect(message.header.recordType).toBe('H')
    expect(message.header.senderName).toBe('Cobas 6000')
    expect(message.header.processingId).toBe('P')
    expect(message.patients).toHaveLength(1)
    expect(message.patients[0].patient.patientName).toBe('Ahmed^Al-Rashid')
    expect(message.patients[0].orders).toHaveLength(1)
    expect(message.patients[0].orders[0].results).toHaveLength(1)
    expect(message.patients[0].orders[0].results[0].testCode).toBe('GLU')
    expect(message.patients[0].orders[0].results[0].value).toBe('120')
    expect(message.patients[0].orders[0].results[0].valueNumeric).toBe(120)
    expect(message.patients[0].orders[0].results[0].abnormalFlag).toBe('H')
    expect(message.terminator).not.toBeNull()
  })

  // INT-14: convertASTMToUnified produces unified results
  it('INT-14: convertASTMToUnified converts ASTM message to UnifiedLabResult[]', () => {
    // ASTM record: f[0]=TypeSeq, f[1..N] data fields
    // R record: f[1]=seqNum, f[2]=testId, f[3]=value, f[4]=units, f[5]=ref, f[6]=flag, f[8]=status
    const rawData = [
      'H1|\\^&|||AnalyzerX',
      'P1|PAT-100|||Smith^John||19801231|M',
      'O1|SPEC-200|',
      'R1|1|^^^HGB^Hemoglobin|14.5|g/dL|12-16|N||F||||20250601120000',
      'R2|2|^^^WBC^White Blood Cells|11.2|K/uL|4.5-11|H||F||||20250601120000',
      'L1|N',
    ].join('\r')

    const message = parseASTMMessage(rawData)
    const unified = convertASTMToUnified(message)

    expect(unified).toHaveLength(1)
    expect(unified[0].patientName).toBe('Smith^John')
    expect(unified[0].instrumentId).toBe('AnalyzerX')
    expect(unified[0].results).toHaveLength(2)
    expect(unified[0].results[0].testCode).toBe('HGB')
    expect(unified[0].results[0].value).toBe('14.5')
    expect(unified[0].results[0].unit).toBe('g/dL')
    expect(unified[0].results[0].abnormalFlag).toBe('N')
    expect(unified[0].results[1].testCode).toBe('WBC')
    expect(unified[0].results[1].abnormalFlag).toBe('H')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Group 5: Message Queue (INT-15 .. INT-16)
// ─────────────────────────────────────────────────────────────────────────────
describe('Integration — Message Queue', () => {
  // INT-15: Message queue constants
  it('INT-15: messageQueue.ts has MAX_RETRIES=3 and RETRY_BASE_DELAY_MS=5000', () => {
    const src = readSource('lib/integration/messageQueue.ts')

    expect(src).toContain('const MAX_RETRIES = 3')
    expect(src).toContain('const RETRY_BASE_DELAY_MS = 5000')
    // Exponential backoff comment
    expect(src).toContain('5s, 10s, 20s (exponential)')
  })

  // INT-16: logMessage and markForRetry exports
  it('INT-16: messageQueue exports logMessage, markForRetry, updateMessageStatus', () => {
    const src = readSource('lib/integration/messageQueue.ts')

    expect(src).toContain('export async function logMessage(')
    expect(src).toContain('export async function updateMessageStatus(')
    expect(src).toContain('export async function markForRetry(')
    expect(src).toContain('export async function getRetryableMessages(')
    expect(src).toContain('export async function queryMessages(')
    expect(src).toContain('export async function getMessageStats(')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Group 6: Route File Checks (INT-17 .. INT-18)
// ─────────────────────────────────────────────────────────────────────────────
describe('Integration — Route Guards', () => {
  // INT-17: hl7/receive route uses withErrorHandler
  it('INT-17: hl7/receive route uses withErrorHandler and validates HL7 input', () => {
    const src = readSource('app/api/integration/hl7/receive/route.ts')

    expect(src).toContain("import { withErrorHandler } from '@/lib/core/errors'")
    expect(src).toContain('parseHL7Message')
    expect(src).toContain('extractLabResults')
    expect(src).toContain('extractADTEvent')
    expect(src).toContain('detectMessageType')
    expect(src).toContain('logMessage')
    expect(src).toContain("message: z.string().min(1, 'message is required')")
  })

  // INT-18: instruments route uses withAuthTenant
  it('INT-18: instruments route uses withAuthTenant and validates instrumentSchema', () => {
    const src = readSource('app/api/integration/instruments/route.ts')

    expect(src).toContain("import { withAuthTenant } from '@/lib/core/guards/withAuthTenant'")
    expect(src).toContain("import { withErrorHandler } from '@/lib/core/errors'")
    // Instrument type enum
    expect(src).toContain("z.enum(['lab_analyzer', 'imaging_modality', 'vitals_monitor', 'ecg'])")
    // Protocol enum
    expect(src).toContain("z.enum(['HL7', 'ASTM', 'DICOM', 'FHIR', 'REST'])")
    // Connection type enum
    expect(src).toContain("z.enum(['tcp', 'http', 'serial', 'dicom_cstore'])")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Group 7: Schema & Types (INT-19 .. INT-20)
// ─────────────────────────────────────────────────────────────────────────────
describe('Integration — Schema & Types', () => {
  // INT-19: parseASTMMessage throws on missing header
  it('INT-19: parseASTMMessage throws error when Header record is missing', () => {
    const noHeader = 'P|1|||PAT-001||Test^Patient\rL|1|N'

    expect(() => parseASTMMessage(noHeader)).toThrowError('ASTM message missing Header (H) record')
  })

  // INT-20: HL7 types.ts defines all integration types
  it('INT-20: types.ts defines message, instrument, and result types', () => {
    const src = readSource('lib/integration/hl7/types.ts')

    // Core message types
    expect(src).toContain('HL7LabResult')
    expect(src).toContain('HL7ResultObservation')
    expect(src).toContain('ADTEvent')
    expect(src).toContain('AbnormalFlag')
    expect(src).toContain('ResultStatus')
    expect(src).toContain('OrderControl')
    expect(src).toContain('AckCode')

    // Instrument types
    expect(src).toContain('InstrumentType')
    expect(src).toContain('InstrumentProtocol')
    expect(src).toContain('ConnectionType')
    expect(src).toContain('InstrumentStatus')
    expect(src).toContain('IntegrationMessage')
    expect(src).toContain('MessageDirection')
    expect(src).toContain('MessageStatus')
  })
})
