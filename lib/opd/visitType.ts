import type { OPDVisitType } from '@/lib/models/OPDEncounter';
import { prisma } from '@/lib/db/prisma';

const FOLLOW_UP_DAYS = 14;

/**
 * Auto-detect the OPD visit type based on patient history.
 *
 * Rules:
 * - FVH: No previous OPD encounters for this patient
 * - FVC: Has OPD history but never with this doctor/resource
 * - FU:  Saw same doctor within 14 days
 * - RV:  Saw same doctor more than 14 days ago
 * - REF: Source is referral (from another doctor or ER)
 *
 * Accepts optional `db` parameter for backward compatibility during migration,
 * but uses Prisma by default.
 */
export async function detectVisitType(
  db: any, // Kept for backward compat — ignored
  tenantId: string,
  patientId: string,
  resourceId: string | null,
  source?: { system?: string; referralType?: string } | null
): Promise<OPDVisitType> {
  // ── Check if this is a referral ──
  if (source?.system === 'REFERRAL' || source?.referralType) {
    return 'REF';
  }

  // ── Get all previous CLOSED OPD encounters for this patient ──
  // EncounterCoreStatus: CREATED | ACTIVE | CLOSED (no COMPLETED)
  const previousEncounters = await prisma.encounterCore.findMany({
    where: {
      tenantId,
      patientId,
      encounterType: 'OPD',
      status: 'CLOSED',
    },
    select: { id: true, closedAt: true, updatedAt: true, createdAt: true },
    orderBy: [{ closedAt: 'desc' }, { updatedAt: 'desc' }, { createdAt: 'desc' }],
    take: 100,
  });

  // ── FVH: No previous encounters at all ──
  if (previousEncounters.length === 0) {
    return 'FVH';
  }

  // ── If no resourceId (walk-in without booking), default to FVC ──
  if (!resourceId) {
    return 'FVC';
  }

  // ── Get encounter IDs to check bookings for same doctor ──
  const previousEncounterIds = previousEncounters
    .map((e) => e.id)
    .filter(Boolean);

  // ── Find bookings for the same resource (doctor) ──
  const sameDoctorBookings = previousEncounterIds.length
    ? await prisma.opdBooking.findMany({
        where: {
          tenantId,
          resourceId,
          encounterCoreId: { in: previousEncounterIds },
          bookingType: 'PATIENT',
        },
        select: { encounterCoreId: true },
      })
    : [];

  // ── FVC: Never seen this doctor before ──
  if (sameDoctorBookings.length === 0) {
    return 'FVC';
  }

  // ── Check most recent visit with this doctor ──
  const sameDoctorEncounterIds = new Set(
    sameDoctorBookings.map((b) => String(b.encounterCoreId || ''))
  );
  const sameDoctorEncounters = previousEncounters.filter((e) =>
    sameDoctorEncounterIds.has(e.id)
  );

  if (sameDoctorEncounters.length === 0) {
    return 'FVC';
  }

  // Most recent encounter with same doctor
  const lastVisit = sameDoctorEncounters[0];
  const lastVisitDate = new Date(
    lastVisit.closedAt || lastVisit.updatedAt || lastVisit.createdAt
  );

  if (isNaN(lastVisitDate.getTime())) {
    return 'FVC';
  }

  const daysSinceLastVisit = Math.floor(
    (Date.now() - lastVisitDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  // ── FU: Within 14 days ──
  if (daysSinceLastVisit <= FOLLOW_UP_DAYS) {
    return 'FU';
  }

  // ── RV: More than 14 days ──
  return 'RV';
}
