import { Prisma } from '@prisma/client';
import { BaseRepository, TransactionClient } from '../base.repository';

export class OpdBookingRepository extends BaseRepository {
  constructor(tenantId: string, tx?: TransactionClient) {
    super(tenantId, tx);
  }

  async findById(id: string) {
    return this.db.opdBooking.findUnique({ where: { id } });
  }

  async findByPatientId(patientId: string) {
    return this.db.opdBooking.findMany({
      where: this.where({ patientId }),
      orderBy: { bookingDate: 'desc' },
    });
  }

  async findByDoctorId(doctorId: string, date?: Date) {
    return this.db.opdBooking.findMany({
      where: this.where({
        doctorId,
        ...(date && { bookingDate: date }),
      }),
      orderBy: { startTime: 'asc' },
    });
  }

  async findByDate(date: Date) {
    return this.db.opdBooking.findMany({
      where: this.where({ bookingDate: date }),
      orderBy: { startTime: 'asc' },
    });
  }

  async findByDateRange(from: Date, to: Date) {
    return this.db.opdBooking.findMany({
      where: this.where({
        bookingDate: { gte: from, lte: to },
      }),
      orderBy: { bookingDate: 'asc' },
    });
  }

  async findByStatus(status: string) {
    return this.db.opdBooking.findMany({
      where: this.where({ status }),
      orderBy: { bookingDate: 'desc' },
    });
  }

  async create(data: Prisma.OpdBookingCreateInput) {
    return this.db.opdBooking.create({ data });
  }

  async update(id: string, data: Prisma.OpdBookingUpdateInput) {
    return this.db.opdBooking.update({ where: { id }, data });
  }

  async cancel(id: string, reason?: string) {
    return this.db.opdBooking.update({
      where: { id },
      data: {
        status: 'cancelled',
        cancelReason: reason,
      },
    });
  }

  async confirm(id: string) {
    return this.db.opdBooking.update({
      where: { id },
      data: { status: 'confirmed' },
    });
  }

  async markCompleted(id: string) {
    return this.db.opdBooking.update({
      where: { id },
      data: { status: 'completed' },
    });
  }

  async markNoShow(id: string) {
    return this.db.opdBooking.update({
      where: { id },
      data: { status: 'no_show' },
    });
  }

  async countByDate(date: Date) {
    return this.db.opdBooking.count({
      where: this.where({ bookingDate: date }),
    });
  }

  async countByStatus(status: string) {
    return this.db.opdBooking.count({
      where: this.where({ status }),
    });
  }
}
