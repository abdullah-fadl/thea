import { Prisma, OpdStatus, OpdFlowState, OpdPaymentStatus, OpdPaymentServiceType, OpdPaymentMethod, OpdDispositionType } from '@prisma/client';
import { BaseRepository, TransactionClient } from '../base.repository';

// Default includes for OPD encounter queries
const DEFAULT_INCLUDE = {
  nursingEntries: true,
  doctorEntries: true,
  doctorAddenda: true,
  resultsViewed: true,
  patient: true,
  encounterCore: true,
} as const;

export class OpdEncounterRepository extends BaseRepository {
  constructor(tenantId: string, tx?: TransactionClient) {
    super(tenantId, tx);
  }

  // ── Finders ────────────────────────────────────────────────

  async findById(id: string, include = DEFAULT_INCLUDE) {
    return this.db.opdEncounter.findUnique({
      where: { id },
      include,
    });
  }

  async findByEncounterCoreId(encounterCoreId: string) {
    return this.db.opdEncounter.findUnique({
      where: { encounterCoreId },
      include: DEFAULT_INCLUDE,
    });
  }

  async findByPatientId(patientId: string, limit = 50) {
    return this.db.opdEncounter.findMany({
      where: this.where({ patientId }),
      include: DEFAULT_INCLUDE,
      take: limit,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByStatus(status: string) {
    return this.db.opdEncounter.findMany({
      where: this.where({ status: status as OpdStatus }),
      include: { patient: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async findByFlowState(flowState: string) {
    return this.db.opdEncounter.findMany({
      where: this.where({ opdFlowState: flowState as OpdFlowState }),
      include: { patient: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async findToday() {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    return this.db.opdEncounter.findMany({
      where: this.where({
        createdAt: { gte: startOfDay },
      }),
      include: { patient: true, nursingEntries: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOpenEncounters() {
    return this.db.opdEncounter.findMany({
      where: this.where({ status: 'OPEN' }),
      include: { patient: true, nursingEntries: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Mutations ──────────────────────────────────────────────

  async create(data: Prisma.OpdEncounterCreateInput) {
    return this.db.opdEncounter.create({
      data,
      include: DEFAULT_INCLUDE,
    });
  }

  async update(id: string, data: Prisma.OpdEncounterUpdateInput) {
    return this.db.opdEncounter.update({
      where: { id },
      data,
      include: DEFAULT_INCLUDE,
    });
  }

  async updateFlowState(id: string, flowState: string) {
    return this.db.opdEncounter.update({
      where: { id },
      data: { opdFlowState: flowState as OpdFlowState },
    });
  }

  async updatePayment(id: string, payment: {
    paymentStatus?: string;
    paymentServiceType?: string;
    paymentPaidAt?: Date;
    paymentAmount?: number;
    paymentMethod?: string;
    paymentInvoiceId?: string;
    paymentReference?: string;
  }) {
    return this.db.opdEncounter.update({
      where: { id },
      data: {
          ...(payment.paymentStatus !== undefined && { paymentStatus: payment.paymentStatus as OpdPaymentStatus }),
          ...(payment.paymentServiceType !== undefined && { paymentServiceType: payment.paymentServiceType as OpdPaymentServiceType }),
          ...(payment.paymentPaidAt !== undefined && { paymentPaidAt: payment.paymentPaidAt }),
          ...(payment.paymentAmount !== undefined && { paymentAmount: payment.paymentAmount }),
          ...(payment.paymentMethod !== undefined && { paymentMethod: payment.paymentMethod as OpdPaymentMethod }),
          ...(payment.paymentInvoiceId !== undefined && { paymentInvoiceId: payment.paymentInvoiceId }),
          ...(payment.paymentReference !== undefined && { paymentReference: payment.paymentReference }),
        },
    });
  }

  async complete(id: string, disposition?: { type?: string; note?: string }) {
    return this.db.opdEncounter.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        ...(disposition && {
          dispositionType: disposition.type as OpdDispositionType,
          dispositionNote: disposition.note,
        }),
      },
    });
  }

  // ── Nursing Entries ────────────────────────────────────────

  async addNursingEntry(
    encounterId: string,
    data: Omit<Prisma.OpdNursingEntryCreateInput, 'opdEncounter'>
  ) {
    return this.db.opdNursingEntry.create({
      data: {
        ...data,
        opdEncounter: { connect: { id: encounterId } },
      },
    });
  }

  async correctNursingEntry(
    entryId: string,
    correctedByUserId: string,
    reason: string,
    newData: Omit<Prisma.OpdNursingEntryCreateInput, 'opdEncounter'>
  ) {
    // Mark old entry as corrected
    const oldEntry = await this.db.opdNursingEntry.update({
      where: { id: entryId },
      data: {
        isCorrected: true,
        correctedAt: new Date(),
        correctedByUserId,
        correctionReason: reason,
      },
    });

    // Create corrected entry
    return this.db.opdNursingEntry.create({
      data: {
        ...newData,
        correctedEntryId: entryId,
        opdEncounter: { connect: { id: oldEntry.opdEncounterId } },
      },
    });
  }

  // ── Doctor Entries ─────────────────────────────────────────

  async addDoctorEntry(
    encounterId: string,
    data: Omit<Prisma.OpdDoctorEntryCreateInput, 'opdEncounter'>
  ) {
    return this.db.opdDoctorEntry.create({
      data: {
        ...data,
        opdEncounter: { connect: { id: encounterId } },
      },
    });
  }

  async addDoctorAddendum(
    encounterId: string,
    data: Omit<Prisma.OpdDoctorAddendumCreateInput, 'opdEncounter'>
  ) {
    return this.db.opdDoctorAddendum.create({
      data: {
        ...data,
        opdEncounter: { connect: { id: encounterId } },
      },
    });
  }

  // ── Results Viewed ─────────────────────────────────────────

  async markResultViewed(
    encounterId: string,
    resultId: string,
    viewedBy: string
  ) {
    return this.db.opdResultViewed.create({
      data: {
        resultId,
        viewedAt: new Date(),
        viewedBy,
        opdEncounter: { connect: { id: encounterId } },
      },
    });
  }

  // ── Counts ─────────────────────────────────────────────────

  async count(options?: { status?: string; flowState?: string }) {
    return this.db.opdEncounter.count({
      where: this.where({
        ...(options?.status && { status: options.status as OpdStatus }),
        ...(options?.flowState && { opdFlowState: options.flowState as OpdFlowState }),
      }),
    });
  }

  async countToday() {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    return this.db.opdEncounter.count({
      where: this.where({ createdAt: { gte: startOfDay } }),
    });
  }
}
