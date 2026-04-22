/**
 * ER Repository — Prisma-backed
 *
 * Read-only repository for ER data. Uses ErEncounter, ErTriageAssessment,
 * ErDoctorNote, ErDisposition from prisma/schema/er.prisma.
 * tryPrisma wrapper provides graceful degradation if tables don't exist yet.
 */

import { prisma } from '@/lib/db/prisma';

// Dynamic model access — these ER models may not yet be in the generated Prisma client
const erDb = prisma as unknown as Record<string, Record<string, ((...args: unknown[]) => Promise<unknown>) | undefined> | undefined>;

export interface ERRegistration {
  id: string;
  erVisitId: string;
  nationalId?: string;
  iqama?: string;
  fullName: string;
  dateOfBirth: Date;
  age: number;
  gender: string;
  insuranceCompany?: string;
  policyClass?: string;
  eligibilityStatus?: string;
  paymentType?: string;
  registrationDate: Date;
  status: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ERTriage {
  id: string;
  erVisitId: string;
  registrationId: string;
  bloodPressure?: string;
  heartRate?: number;
  respiratoryRate?: number;
  temperature?: number;
  oxygenSaturation?: number;
  painScore?: number;
  chiefComplaint?: string;
  ctasLevel: number;
  ageGroup?: string;
  severity?: string;
  color?: string;
  routing?: string;
  pregnancyStatus?: string;
  triageDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ERProgressNote {
  id: string;
  erVisitId: string;
  registrationId: string;
  physicianName?: string;
  assessment?: string;
  diagnosis?: string;
  managementPlan?: string;
  noteDate: Date;
  isLocked?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ERDisposition {
  id: string;
  erVisitId: string;
  registrationId: string;
  dispositionType: string;
  physicianName?: string;
  notes?: string;
  departmentId?: string;
  bedId?: string;
  dispositionDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Helper: try a Prisma call, return fallback on failure
async function tryPrisma<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

export class ERRepository {
  static async getRegistrationByVisitId(erVisitId: string): Promise<ERRegistration | null> {
    return tryPrisma(
      async () => {
        const r = await erDb.erRegistration?.findFirst?.({ where: { erVisitId } });
        return (r as ERRegistration) || null;
      },
      null
    );
  }

  static async getRegistrationById(registrationId: string): Promise<ERRegistration | null> {
    return tryPrisma(
      async () => {
        const r = await erDb.erRegistration?.findFirst?.({ where: { id: registrationId } });
        return (r as ERRegistration) || null;
      },
      null
    );
  }

  static async getRegistrationsByDateRange(
    startDate: Date,
    endDate: Date,
    limit?: number
  ): Promise<ERRegistration[]> {
    return tryPrisma(
      async () => {
        const registrations = await erDb.erRegistration?.findMany?.({
          where: {
            registrationDate: { gte: startDate, lte: endDate },
            isActive: true,
          },
          orderBy: { registrationDate: 'desc' },
          ...(limit ? { take: limit } : {}),
        });
        return (registrations as ERRegistration[]) || [];
      },
      []
    );
  }

  static async getTriageByVisitId(erVisitId: string): Promise<ERTriage | null> {
    return tryPrisma(
      async () => {
        const t = await erDb.erTriage?.findFirst?.({ where: { erVisitId } });
        return (t as ERTriage) || null;
      },
      null
    );
  }

  static async getTriageByRegistrationIds(registrationIds: string[]): Promise<ERTriage[]> {
    if (registrationIds.length === 0) return [];
    return tryPrisma(
      async () => {
        const triages = await erDb.erTriage?.findMany?.({
          where: { registrationId: { in: registrationIds } },
        });
        return (triages as ERTriage[]) || [];
      },
      []
    );
  }

  static async getProgressNotesByVisitId(erVisitId: string): Promise<ERProgressNote[]> {
    return tryPrisma(
      async () => {
        const notes = await erDb.erProgressNote?.findMany?.({
          where: { erVisitId },
          orderBy: { noteDate: 'desc' },
        });
        return (notes as ERProgressNote[]) || [];
      },
      []
    );
  }

  static async getDispositionByVisitId(erVisitId: string): Promise<ERDisposition | null> {
    return tryPrisma(
      async () => {
        const d = await erDb.erDisposition?.findFirst?.({ where: { erVisitId } });
        return (d as ERDisposition) || null;
      },
      null
    );
  }

  static async getCompleteVisitData(erVisitId: string): Promise<{
    registration: ERRegistration | null;
    triage: ERTriage | null;
    progressNotes: ERProgressNote[];
    disposition: ERDisposition | null;
  }> {
    const [registration, triage, progressNotes, disposition] = await Promise.all([
      this.getRegistrationByVisitId(erVisitId),
      this.getTriageByVisitId(erVisitId),
      this.getProgressNotesByVisitId(erVisitId),
      this.getDispositionByVisitId(erVisitId),
    ]);

    return { registration, triage, progressNotes, disposition };
  }

  static async getActiveVisits(limit?: number): Promise<ERRegistration[]> {
    return tryPrisma(
      async () => {
        const visits = await erDb.erRegistration?.findMany?.({
          where: {
            isActive: true,
            status: { in: ['registered', 'triaged', 'in-progress'] },
          },
          orderBy: { registrationDate: 'desc' },
          ...(limit ? { take: limit } : {}),
        });
        return (visits as ERRegistration[]) || [];
      },
      []
    );
  }
}
