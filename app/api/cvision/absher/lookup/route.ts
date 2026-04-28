import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Absher Lookup API
 * POST /api/cvision/absher/lookup
 *
 * Simulates an Absher (Saudi NIC) identity lookup.
 * When a National ID or Iqama number is provided, returns personal data
 * (name, gender, date of birth, nationality) that can auto-fill the
 * Add Employee form.
 *
 * ── Integration notes ──
 * In production this endpoint should call the real Absher / Yakeen API
 * (National Information Center) using the organisation's government
 * credentials.  The mock below returns realistic sample data so the
 * front-end workflow can be validated end-to-end.
 *
 * Saudi National IDs:
 *   • Start with "1" → Saudi citizen  (10 digits)
 *   • Start with "2" → Resident / Iqama holder  (10 digits)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import { CVISION_PERMISSIONS } from '@/lib/cvision/constants';
import { getCVisionCollection } from '@/lib/cvision/db';

export const dynamic = 'force-dynamic';

// ── Helpers ─────────────────────────────────────────────────────────────

function validateNationalId(id: string): { valid: boolean; type?: 'citizen' | 'resident'; error?: string } {
  const cleaned = id.replace(/\s+/g, '').trim();
  if (!/^\d{10}$/.test(cleaned)) {
    return { valid: false, error: 'National ID must be exactly 10 digits' };
  }
  if (cleaned.startsWith('1')) return { valid: true, type: 'citizen' };
  if (cleaned.startsWith('2')) return { valid: true, type: 'resident' };
  return { valid: false, error: 'National ID must start with 1 (citizen) or 2 (resident)' };
}

/** Deterministic hash for a numeric string → stable mock data per ID */
function simpleHash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// ── Mock data pools ─────────────────────────────────────────────────────

const SAUDI_FIRST_NAMES_M = ['Mohammed', 'Abdullah', 'Khalid', 'Faisal', 'Sultan', 'Turki', 'Salman', 'Nasser', 'Bandar', 'Saud'];
const SAUDI_FIRST_NAMES_F = ['Noura', 'Sara', 'Fatimah', 'Maha', 'Haya', 'Lama', 'Reem', 'Dalal', 'Abeer', 'Amal'];
const SAUDI_LAST_NAMES = ['Al-Otaibi', 'Al-Ghamdi', 'Al-Zahrani', 'Al-Qahtani', 'Al-Dossari', 'Al-Shehri', 'Al-Harbi', 'Al-Mutairi', 'Al-Rashidi', 'Al-Shamrani'];

const RESIDENT_FIRST_NAMES_M = ['Ahmed', 'Omar', 'Rajesh', 'Ali', 'Hassan', 'Imran', 'Ravi', 'Jun', 'Mark', 'Joseph'];
const RESIDENT_FIRST_NAMES_F = ['Maria', 'Fatima', 'Priya', 'Aisha', 'Nour', 'Deepa', 'Grace', 'Rose', 'Amina', 'Layla'];
const RESIDENT_LAST_NAMES = ['Hassan', 'Kumar', 'Santos', 'Ali', 'Rahman', 'Khan', 'Singh', 'Garcia', 'Mohamed', 'Ibrahim'];

const RESIDENT_NATIONALITIES = [
  'Egypt', 'India', 'Pakistan', 'Philippines', 'Bangladesh',
  'Jordan', 'Sudan', 'Yemen', 'Syria', 'Indonesia',
];

interface AbsherLookupResult {
  nationalId: string;
  idType: 'citizen' | 'resident';
  firstName: string;
  lastName: string;
  gender: 'male' | 'female';
  dateOfBirth: string;          // YYYY-MM-DD
  nationality: string;
  // Optional fields that Absher may return
  maritalStatus?: string;
  city?: string;
}

function generateMockData(nationalId: string, idType: 'citizen' | 'resident'): AbsherLookupResult {
  const h = simpleHash(nationalId);
  const isMale = h % 3 !== 0; // ~67% male for realistic distribution

  let firstName: string;
  let lastName: string;
  let nationality: string;

  if (idType === 'citizen') {
    firstName = isMale
      ? SAUDI_FIRST_NAMES_M[h % SAUDI_FIRST_NAMES_M.length]
      : SAUDI_FIRST_NAMES_F[h % SAUDI_FIRST_NAMES_F.length];
    lastName = SAUDI_LAST_NAMES[h % SAUDI_LAST_NAMES.length];
    nationality = 'Saudi Arabia';
  } else {
    firstName = isMale
      ? RESIDENT_FIRST_NAMES_M[h % RESIDENT_FIRST_NAMES_M.length]
      : RESIDENT_FIRST_NAMES_F[h % RESIDENT_FIRST_NAMES_F.length];
    lastName = RESIDENT_LAST_NAMES[h % RESIDENT_LAST_NAMES.length];
    nationality = RESIDENT_NATIONALITIES[h % RESIDENT_NATIONALITIES.length];
  }

  // Generate a date of birth between 1965 and 2000
  const birthYear = 1965 + (h % 35);
  const birthMonth = 1 + (h % 12);
  const birthDay = 1 + (h % 28);
  const dateOfBirth = `${birthYear}-${String(birthMonth).padStart(2, '0')}-${String(birthDay).padStart(2, '0')}`;

  const cities = idType === 'citizen'
    ? ['Riyadh', 'Jeddah', 'Dammam', 'Mecca', 'Medina', 'Khobar', 'Tabuk', 'Abha']
    : ['Riyadh', 'Jeddah', 'Dammam', 'Khobar', 'Jubail'];

  return {
    nationalId,
    idType,
    firstName,
    lastName,
    gender: isMale ? 'male' : 'female',
    dateOfBirth,
    nationality,
    maritalStatus: h % 2 === 0 ? 'Married' : 'Single',
    city: cities[h % cities.length],
  };
}

// ── Route handler ───────────────────────────────────────────────────────

export const POST = withAuthTenant(
  async (request, { tenantId, userId }) => {
    try {
      const body = await request.json();
      const { nationalId } = body;

      if (!nationalId) {
        return NextResponse.json(
          { success: false, error: 'nationalId is required' },
          { status: 400 },
        );
      }

      const cleaned = String(nationalId).replace(/\s+/g, '').trim();
      const validation = validateNationalId(cleaned);

      if (!validation.valid) {
        return NextResponse.json(
          { success: false, error: validation.error },
          { status: 400 },
        );
      }

      // ── Step 1: Check if this ID already exists in employees ──
      const empCollection = await getCVisionCollection(tenantId, 'employees');
      const existing = await empCollection.findOne({
        tenantId,
        nationalId: cleaned,
        isArchived: { $ne: true },
      } as Record<string, unknown>);

      if (existing) {
        const emp = existing as Record<string, unknown>;
        return NextResponse.json({
          success: false,
          error: `An employee with this National ID already exists: ${emp.firstName || ''} ${emp.lastName || ''} (${emp.employeeNo || emp.employeeNumber || 'N/A'})`.trim(),
          code: 'DUPLICATE_ID',
          existingEmployeeId: emp.id,
        }, { status: 409 });
      }

      // ── Step 2: Generate mock Absher response ──
      // In production, replace this with a real Absher/Yakeen API call:
      //   const absherResponse = await absherClient.citizenInfo(cleaned);
      const data = generateMockData(cleaned, validation.type!);

      // Simulate a small network delay (100–300ms) for realism
      await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));

      return NextResponse.json({
        success: true,
        source: 'mock',  // Change to 'absher' when using real API
        data,
      });
    } catch (error: any) {
      logger.error('[CVision Absher Lookup]', error?.message || String(error));
      return NextResponse.json(
        { success: false, error: 'Internal server error', message: error.message },
        { status: 500 },
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.EMPLOYEES_WRITE },
);
