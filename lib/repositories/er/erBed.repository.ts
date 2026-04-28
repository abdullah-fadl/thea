import { Prisma } from '@prisma/client';
import { BaseRepository, TransactionClient } from '../base.repository';

export class ErBedRepository extends BaseRepository {
  constructor(tenantId: string, tx?: TransactionClient) {
    super(tenantId, tx);
  }

  // ── Finders ────────────────────────────────────────────────

  async findById(id: string) {
    return this.db.erBed.findUnique({
      where: { id },
      include: {
        assignments: {
          where: { unassignedAt: null },
          include: { encounter: { include: { patient: true } } },
        },
      },
    });
  }

  async findAll() {
    return this.db.erBed.findMany({
      where: this.tenantFilter(),
      include: {
        assignments: {
          where: { unassignedAt: null },
          include: { encounter: { include: { patient: true } } },
        },
      },
      orderBy: [{ zone: 'asc' }, { bedLabel: 'asc' }],
    });
  }

  async findByZone(zone: string) {
    return this.db.erBed.findMany({
      where: this.where({ zone }),
      include: {
        assignments: {
          where: { unassignedAt: null },
        },
      },
      orderBy: { bedLabel: 'asc' },
    });
  }

  async findVacant() {
    return this.db.erBed.findMany({
      where: this.where({ state: 'VACANT' }),
      orderBy: [{ zone: 'asc' }, { bedLabel: 'asc' }],
    });
  }

  async findByState(state: string) {
    return this.db.erBed.findMany({
      where: this.where({ state: state as any }),
      orderBy: [{ zone: 'asc' }, { bedLabel: 'asc' }],
    });
  }

  // ── Mutations ──────────────────────────────────────────────

  async create(data: Prisma.ErBedCreateInput) {
    return this.db.erBed.create({ data });
  }

  async update(id: string, data: Prisma.ErBedUpdateInput) {
    return this.db.erBed.update({ where: { id }, data });
  }

  async updateState(id: string, state: string) {
    return this.db.erBed.update({
      where: { id },
      data: { state: state as any },
    });
  }

  // ── Assignments ────────────────────────────────────────────

  async assignPatient(bedId: string, encounterId: string, assignedByUserId: string) {
    // Set bed to occupied
    await this.db.erBed.update({
      where: { id: bedId },
      data: { state: 'OCCUPIED' },
    });

    return this.db.erBedAssignment.create({
      data: {
        assignedAt: new Date(),
        assignedByUserId,
        bed: { connect: { id: bedId } },
        encounter: { connect: { id: encounterId } },
      },
    });
  }

  async unassignPatient(assignmentId: string) {
    const assignment = await this.db.erBedAssignment.update({
      where: { id: assignmentId },
      data: { unassignedAt: new Date() },
    });

    // Set bed to cleaning
    await this.db.erBed.update({
      where: { id: assignment.bedId },
      data: { state: 'CLEANING' },
    });

    return assignment;
  }

  // ── Counts ─────────────────────────────────────────────────

  async countByState() {
    const results = await this.db.erBed.groupBy({
      by: ['state'],
      where: this.tenantFilter(),
      _count: true,
    });
    return results.reduce(
      (acc, r) => ({ ...acc, [r.state]: r._count }),
      {} as Record<string, number>
    );
  }

  async countByZone() {
    const results = await this.db.erBed.groupBy({
      by: ['zone'],
      where: this.tenantFilter(),
      _count: true,
    });
    return results.reduce(
      (acc, r) => ({ ...acc, [r.zone]: r._count }),
      {} as Record<string, number>
    );
  }
}
