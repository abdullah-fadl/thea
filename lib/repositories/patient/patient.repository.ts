import { Prisma } from '@prisma/client';
import { BaseRepository, TransactionClient } from '../base.repository';

export class PatientRepository extends BaseRepository {
  constructor(tenantId: string, tx?: TransactionClient) {
    super(tenantId, tx);
  }

  // ── Finders ────────────────────────────────────────────────

  async findById(id: string) {
    return this.db.patientMaster.findUnique({
      where: { id },
      include: {
        allergies: true,
        problems: true,
        insurances: true,
        identityLinks: true,
      },
    });
  }

  async findByNationalId(nationalId: string) {
    return this.db.patientMaster.findFirst({
      where: this.where({ nationalId }),
    });
  }

  async search(query: string, limit = 20) {
    const lowerQuery = query.toLowerCase();
    return this.db.patientMaster.findMany({
      where: {
        ...this.tenantFilter(),
        OR: [
          { nationalId: { contains: query, mode: 'insensitive' } },
          { nameNormalized: { contains: lowerQuery } },
          { firstName: { contains: query, mode: 'insensitive' } },
          { lastName: { contains: query, mode: 'insensitive' } },
          { iqama: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: limit,
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findAll(options?: {
    status?: string;
    limit?: number;
    offset?: number;
  }) {
    return this.db.patientMaster.findMany({
      where: this.where({
        ...(options?.status && { status: options.status as any }),
      }),
      take: options?.limit ?? 50,
      skip: options?.offset ?? 0,
      orderBy: { updatedAt: 'desc' },
    });
  }

  // ── Mutations ──────────────────────────────────────────────

  async create(data: Prisma.PatientMasterCreateInput) {
    return this.db.patientMaster.create({ data });
  }

  async update(id: string, data: Prisma.PatientMasterUpdateInput) {
    return this.db.patientMaster.update({ where: { id }, data });
  }

  async merge(survivorId: string, duplicateId: string) {
    return this.db.patientMaster.update({
      where: { id: duplicateId },
      data: {
        status: 'MERGED',
        mergedIntoPatientId: survivorId,
      },
    });
  }

  // ── Allergies ──────────────────────────────────────────────

  async addAllergy(patientId: string, data: Omit<Prisma.PatientAllergyCreateInput, 'patient'>) {
    return this.db.patientAllergy.create({
      data: {
        ...data,
        patient: { connect: { id: patientId } },
      },
    });
  }

  async removeAllergy(allergyId: string) {
    return this.db.patientAllergy.delete({ where: { id: allergyId } });
  }

  // ── Problems ───────────────────────────────────────────────

  async addProblem(patientId: string, data: Omit<Prisma.PatientProblemCreateInput, 'patient'>) {
    return this.db.patientProblem.create({
      data: {
        ...data,
        patient: { connect: { id: patientId } },
      },
    });
  }

  async removeProblem(problemId: string) {
    return this.db.patientProblem.delete({ where: { id: problemId } });
  }

  // ── Insurance ──────────────────────────────────────────────

  async addInsurance(patientId: string, data: Omit<Prisma.PatientInsuranceCreateInput, 'patient'>) {
    return this.db.patientInsurance.create({
      data: {
        ...data,
        patient: { connect: { id: patientId } },
      },
    });
  }

  async updateInsurance(insuranceId: string, data: Prisma.PatientInsuranceUpdateInput) {
    return this.db.patientInsurance.update({
      where: { id: insuranceId },
      data,
    });
  }

  // ── Count ──────────────────────────────────────────────────

  async count() {
    return this.db.patientMaster.count({
      where: this.tenantFilter(),
    });
  }
}
