import { Prisma } from '@prisma/client';
import { BaseRepository, TransactionClient } from '../base.repository';

export class EncounterCoreRepository extends BaseRepository {
  constructor(tenantId: string, tx?: TransactionClient) {
    super(tenantId, tx);
  }

  async findById(id: string) {
    return this.db.encounterCore.findUnique({ where: { id } });
  }

  async findByPatientId(patientId: string) {
    return this.db.encounterCore.findMany({
      where: this.where({ patientId }),
      orderBy: { openedAt: 'desc' },
    });
  }

  async findActive(patientId: string) {
    return this.db.encounterCore.findMany({
      where: this.where({
        patientId,
        status: 'ACTIVE',
      }),
      orderBy: { openedAt: 'desc' },
    });
  }

  async findByType(type: 'ER' | 'OPD' | 'IPD' | 'PROCEDURE') {
    return this.db.encounterCore.findMany({
      where: this.where({ encounterType: type as any }),
      orderBy: { openedAt: 'desc' },
    });
  }

  async create(data: Prisma.EncounterCoreCreateInput) {
    return this.db.encounterCore.create({ data });
  }

  async update(id: string, data: Prisma.EncounterCoreUpdateInput) {
    return this.db.encounterCore.update({ where: { id }, data });
  }

  async close(id: string) {
    return this.db.encounterCore.update({
      where: { id },
      data: {
        status: 'CLOSED',
        closedAt: new Date(),
      },
    });
  }

  async count(options?: { type?: string; status?: string }) {
    return this.db.encounterCore.count({
      where: this.where({
        ...(options?.type && { encounterType: options.type as any }),
        ...(options?.status && { status: options.status as any }),
      }),
    });
  }
}
