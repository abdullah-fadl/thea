import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { normalizeName, normalizeIdentifier } from '@/lib/hospital/patientMaster';
import { decryptDocuments } from '@/lib/security/fieldEncryption';
import { rateLimitSearch, getRequestIp } from '@/lib/security/rateLimit';
import { withAccessAudit } from '@/lib/audit/accessLogger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function parseDateRange(value: string | null): { start: Date; end: Date } | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

function normalizePhone(value: string | null): string | null {
  const digits = String(value || '').replace(/\D/g, '');
  return digits ? digits : null;
}

/** Convert Arabic/Eastern Arabic numerals (٠١٢٣٤٥٦٧٨٩ ۰۱۲۳۴۵۶۷۸۹) to English (0-9) */
function normalizeArabicNumerals(value: string): string {
  const arabicToEn: Record<string, string> = {
    '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
    '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
  };
  return String(value).replace(/[٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹]/g, (c) => arabicToEn[c] ?? c);
}

export const GET = withAuthTenant(
  withAccessAudit(withErrorHandler(async (req: NextRequest, { tenantId, userId }) => {
  const rl = await rateLimitSearch({ ip: getRequestIp(req), userId });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
    );
  }

  const params = req.nextUrl.searchParams;
  const rawQ = params.get('q') || params.get('search') || params.get('name') || '';
  const searchQuery = normalizeArabicNumerals(String(rawQ).trim());
  const dob = params.get('dob');
  const mrn = normalizeArabicNumerals(String(params.get('mrn') || '').trim());
  const mobile = normalizePhone(normalizeArabicNumerals(params.get('mobile') || ''));
  const nationalId = normalizeIdentifier(normalizeArabicNumerals(params.get('nationalId') || ''));
  const iqama = normalizeIdentifier(normalizeArabicNumerals(params.get('iqama') || ''));
  const passport = normalizeIdentifier(normalizeArabicNumerals(params.get('passport') || ''));
  const status = params.get('status');
  const limit = Math.min(Number(params.get('limit') || '20'), 50);

  const mobileSearchFields = [
    'phone',
    'mobile',
    'contact.phone',
    'contact.mobile',
    'contacts.phone',
    'contacts.mobile',
  ];

  // Build the where clause
  const where: any = { tenantId };
  if (status) {
    const normalizedStatus = status.toUpperCase();
    if (normalizedStatus === 'MERGED') {
      return NextResponse.json({ items: [] });
    }
    where.status = normalizedStatus;
  } else {
    where.status = { not: 'MERGED' };
  }

  const orConditions: any[] = [];

  // Identifier-based search (using flat columns)
  if (nationalId) {
    orConditions.push({ nationalId: { contains: nationalId, mode: 'insensitive' } });
    orConditions.push({ iqama: { contains: nationalId, mode: 'insensitive' } });
    orConditions.push({ passport: { contains: nationalId, mode: 'insensitive' } });
  }
  if (iqama) orConditions.push({ iqama: { contains: iqama, mode: 'insensitive' } });
  if (passport) orConditions.push({ passport: { contains: passport, mode: 'insensitive' } });

  // MRN search
  if (mrn) {
    orConditions.push({ mrn: { contains: mrn, mode: 'insensitive' } });
  }

  // Mobile search (flat column)
  if (mobile) {
    orConditions.push({ mobile: { contains: mobile } });
  }

  // UUID-based ID search
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const normalizedName = normalizeName(searchQuery);
  if (normalizedName) {
    orConditions.push({ nameNormalized: { contains: normalizedName, mode: 'insensitive' } });
    if (UUID_RE.test(searchQuery)) {
      orConditions.push({ id: searchQuery });
    }
  }

  // General text search across multiple fields
  if (searchQuery) {
    orConditions.push(
      { firstName: { contains: searchQuery, mode: 'insensitive' } },
      { lastName: { contains: searchQuery, mode: 'insensitive' } },
      { fullName: { contains: searchQuery, mode: 'insensitive' } },
      { nameNormalized: { contains: searchQuery, mode: 'insensitive' } },
      { mrn: { contains: searchQuery, mode: 'insensitive' } },
      { nationalId: { contains: searchQuery, mode: 'insensitive' } },
      { iqama: { contains: searchQuery, mode: 'insensitive' } },
      { passport: { contains: searchQuery, mode: 'insensitive' } },
      { mobile: { contains: searchQuery, mode: 'insensitive' } },
    );
  }

  // DOB range filter
  const dobRange = parseDateRange(dob);
  if (dobRange) {
    where.dob = { gte: dobRange.start, lt: dobRange.end };
  }

  if (orConditions.length) {
    where.OR = orConditions;
  }

  const patients = await prisma.patientMaster.findMany({
    where,
    orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }],
    take: limit,
  });

  if (mobile && patients.length === 0) {
    return NextResponse.json({ items: [], code: 'NO_MATCH_MOBILE', searchedFields: mobileSearchFields });
  }

  const decrypted = decryptDocuments('patient_master', patients);
  return NextResponse.json({ items: decrypted, searchedFields: mobile ? mobileSearchFields : undefined });
}), { resourceType: 'patient', logResponseMeta: true }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'patients.master.view' }
);
