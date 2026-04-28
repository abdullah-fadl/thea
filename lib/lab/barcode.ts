/**
 * Lab Specimen Barcode & Accession Number Generation
 *
 * Generates unique identifiers for lab specimens and accession numbers.
 * Format:
 *  - Accession:  LAB-YYMMDD-NNNN   (e.g., LAB-260217-0042)
 *  - Specimen:   SP-YYMMDD-NNNN-T   (T = tube type suffix)
 *  - Barcode:    Code128 numeric string for label printing
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AccessionNumber {
  accession: string;
  date: string;
  sequence: number;
}

export interface SpecimenBarcode {
  barcode: string;
  accession: string;
  tubeType: string;
  label: string;
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function getDateCode(date?: Date): string {
  const d = date ?? new Date();
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yy}${mm}${dd}`;
}

// ---------------------------------------------------------------------------
// Accession number
// ---------------------------------------------------------------------------

/**
 * Generate an accession number. Uses counter from DB to ensure uniqueness.
 *
 * @param sequence - sequential number for today (from DB counter)
 * @param date     - optional date override
 */
export function generateAccessionNumber(sequence: number, date?: Date): AccessionNumber {
  const dateCode = getDateCode(date);
  const seq = String(sequence).padStart(4, '0');
  return {
    accession: `LAB-${dateCode}-${seq}`,
    date: dateCode,
    sequence,
  };
}

/**
 * Parse an accession number back into its parts.
 */
export function parseAccessionNumber(accession: string): AccessionNumber | null {
  const match = accession.match(/^LAB-(\d{6})-(\d{4})$/);
  if (!match) return null;
  return {
    accession,
    date: match[1],
    sequence: parseInt(match[2], 10),
  };
}

// ---------------------------------------------------------------------------
// Specimen barcode
// ---------------------------------------------------------------------------

const TUBE_SUFFIX: Record<string, string> = {
  lavender: 'E',
  green: 'H',
  gold: 'S',
  blue: 'C',
  gray: 'F',
  yellow: 'A',
  red: 'P',
};

/**
 * Generate a specimen barcode string.
 *
 * @param accession - the parent accession number (e.g., "LAB-260217-0042")
 * @param tubeType  - tube color key (e.g., "lavender", "gold")
 * @param tubeIndex - index if multiple tubes of same type (default 1)
 */
export function generateSpecimenBarcode(
  accession: string,
  tubeType: string,
  tubeIndex: number = 1,
): SpecimenBarcode {
  const suffix = TUBE_SUFFIX[tubeType] ?? 'X';
  const dateSeq = accession.replace('LAB-', '');
  const barcode = `SP-${dateSeq}-${suffix}${tubeIndex > 1 ? tubeIndex : ''}`;

  return {
    barcode,
    accession,
    tubeType,
    label: barcode,
  };
}

/**
 * Generate a numeric-only barcode string suitable for Code128 scanning.
 * Encodes the accession + tube type into a scannable format.
 */
export function generateNumericBarcode(accession: string, tubeType: string): string {
  const dateSeq = accession.replace('LAB-', '').replace(/-/g, '');
  const tubeSuffix = TUBE_SUFFIX[tubeType] ?? 'X';
  const tubeCode = tubeSuffix.charCodeAt(0).toString().padStart(2, '0');
  return `${dateSeq}${tubeCode}`;
}

/**
 * Parse a specimen barcode back to its accession and tube type.
 */
export function parseSpecimenBarcode(barcode: string): { accession: string; tubeType: string } | null {
  const match = barcode.match(/^SP-(\d{6})-(\d{4})-([A-Z])(\d*)$/);
  if (!match) return null;

  const reverseTube = Object.entries(TUBE_SUFFIX).find(([, v]) => v === match[3]);
  return {
    accession: `LAB-${match[1]}-${match[2]}`,
    tubeType: reverseTube?.[0] ?? 'unknown',
  };
}

// ---------------------------------------------------------------------------
// Barcode label data for printing
// ---------------------------------------------------------------------------

export interface BarcodeLabel {
  barcodeValue: string;
  patientName: string;
  mrn: string;
  accession: string;
  tubeType: string;
  tubeColor: string;
  collectionDate: string;
  tests: string[];
}

/**
 * Build a label data object for printing.
 */
export function buildBarcodeLabel(params: {
  accession: string;
  tubeType: string;
  patientName: string;
  mrn: string;
  tests: string[];
  collectionDate?: Date;
}): BarcodeLabel {
  const barcode = generateSpecimenBarcode(params.accession, params.tubeType);
  const d = params.collectionDate ?? new Date();

  return {
    barcodeValue: barcode.barcode,
    patientName: params.patientName,
    mrn: params.mrn,
    accession: params.accession,
    tubeType: params.tubeType,
    tubeColor: params.tubeType,
    collectionDate: d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
    tests: params.tests,
  };
}
