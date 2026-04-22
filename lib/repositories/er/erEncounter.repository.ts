import { Prisma } from '@prisma/client';
import { BaseRepository, TransactionClient } from '../base.repository';

const DEFAULT_INCLUDE = {
  patient: true,
  encounterCore: true,
  triage: true,
  bedAssignments: { include: { bed: true } },
  staffAssignments: true,
  notes: true,
  doctorNotes: true,
  nursingNotes: true,
  dispositions: true,
  tasks: true,
} as const;

export class ErEncounterRepository extends BaseRepository {
  constructor(tenantId: string, tx?: TransactionClient) {
    super(tenantId, tx);
  }

  // ── Finders ────────────────────────────────────────────────

  async findById(id: string) {
    return this.db.erEncounter.findUnique({
      where: { id },
      include: DEFAULT_INCLUDE,
    });
  }

  async findByEncounterCoreId(encounterCoreId: string) {
    return this.db.erEncounter.findUnique({
      where: { encounterCoreId },
      include: DEFAULT_INCLUDE,
    });
  }

  async findByPatientId(patientId: string, limit = 50) {
    return this.db.erEncounter.findMany({
      where: this.where({ patientId }),
      include: DEFAULT_INCLUDE,
      take: limit,
      orderBy: { startedAt: 'desc' },
    });
  }

  async findByStatus(status: string) {
    return this.db.erEncounter.findMany({
      where: this.where({ status: status as any }),
      include: { patient: true, triage: true, bedAssignments: { include: { bed: true } } },
      orderBy: { startedAt: 'desc' },
    });
  }

  async findActive() {
    return this.db.erEncounter.findMany({
      where: this.where({
        status: {
          notIn: ['DISCHARGED', 'ADMITTED', 'TRANSFERRED', 'CANCELLED'],
        },
      }),
      include: { patient: true, triage: true, bedAssignments: { include: { bed: true } }, staffAssignments: true },
      orderBy: { startedAt: 'desc' },
    });
  }

  // ── Mutations ──────────────────────────────────────────────

  async create(data: Prisma.ErEncounterCreateInput) {
    return this.db.erEncounter.create({
      data,
      include: DEFAULT_INCLUDE,
    });
  }

  async update(id: string, data: Prisma.ErEncounterUpdateInput) {
    return this.db.erEncounter.update({
      where: { id },
      data,
      include: DEFAULT_INCLUDE,
    });
  }

  async updateStatus(id: string, status: string) {
    return this.db.erEncounter.update({
      where: { id },
      data: { status: status as any },
    });
  }

  async close(id: string) {
    return this.db.erEncounter.update({
      where: { id },
      data: {
        status: 'DISCHARGED',
        closedAt: new Date(),
      },
    });
  }

  // ── Triage ─────────────────────────────────────────────────

  async createTriage(
    encounterId: string,
    data: Omit<Prisma.ErTriageAssessmentCreateInput, 'encounter'>
  ) {
    return this.db.erTriageAssessment.create({
      data: {
        ...data,
        encounter: { connect: { id: encounterId } },
      },
    });
  }

  async updateTriage(triageId: string, data: Prisma.ErTriageAssessmentUpdateInput) {
    return this.db.erTriageAssessment.update({
      where: { id: triageId },
      data,
    });
  }

  // ── Staff Assignments ──────────────────────────────────────

  async assignStaff(
    encounterId: string,
    data: Omit<Prisma.ErStaffAssignmentCreateInput, 'encounter'>
  ) {
    return this.db.erStaffAssignment.create({
      data: {
        ...data,
        encounter: { connect: { id: encounterId } },
      },
    });
  }

  async unassignStaff(assignmentId: string) {
    return this.db.erStaffAssignment.update({
      where: { id: assignmentId },
      data: { unassignedAt: new Date() },
    });
  }

  // ── Notes ──────────────────────────────────────────────────

  async addNote(
    encounterId: string,
    data: Omit<Prisma.ErNoteCreateInput, 'encounter'>
  ) {
    return this.db.erNote.create({
      data: {
        ...data,
        encounter: { connect: { id: encounterId } },
      },
    });
  }

  async addDoctorNote(
    encounterId: string,
    data: Omit<Prisma.ErDoctorNoteCreateInput, 'encounter'>
  ) {
    return this.db.erDoctorNote.create({
      data: {
        ...data,
        encounter: { connect: { id: encounterId } },
      },
    });
  }

  async addNursingNote(
    encounterId: string,
    data: Omit<Prisma.ErNursingNoteCreateInput, 'encounter'>
  ) {
    return this.db.erNursingNote.create({
      data: {
        ...data,
        encounter: { connect: { id: encounterId } },
      },
    });
  }

  // ── Disposition ────────────────────────────────────────────

  async addDisposition(
    encounterId: string,
    data: Omit<Prisma.ErDispositionCreateInput, 'encounter'>
  ) {
    return this.db.erDisposition.create({
      data: {
        ...data,
        encounter: { connect: { id: encounterId } },
      },
    });
  }

  // ── Tasks ──────────────────────────────────────────────────

  async addTask(
    encounterId: string,
    data: Omit<Prisma.ErTaskCreateInput, 'encounter'>
  ) {
    return this.db.erTask.create({
      data: {
        ...data,
        encounter: { connect: { id: encounterId } },
      },
    });
  }

  async updateTask(taskId: string, data: Prisma.ErTaskUpdateInput) {
    return this.db.erTask.update({ where: { id: taskId }, data });
  }

  async completeTask(taskId: string) {
    return this.db.erTask.update({
      where: { id: taskId },
      data: { status: 'completed', completedAt: new Date() },
    });
  }

  // ── Observations ───────────────────────────────────────────

  async addObservation(
    encounterId: string,
    data: Omit<Prisma.ErObservationCreateInput, 'encounter'>
  ) {
    return this.db.erObservation.create({
      data: {
        ...data,
        encounter: { connect: { id: encounterId } },
      },
    });
  }

  // ── Counts ─────────────────────────────────────────────────

  async count(options?: { status?: string }) {
    return this.db.erEncounter.count({
      where: this.where({
        ...(options?.status && { status: options.status as any }),
      }),
    });
  }

  async countActive() {
    return this.db.erEncounter.count({
      where: this.where({
        status: {
          notIn: ['DISCHARGED', 'ADMITTED', 'TRANSFERRED', 'CANCELLED'],
        },
      }),
    });
  }
}
