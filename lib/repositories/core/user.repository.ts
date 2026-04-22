import { Prisma } from '@prisma/client';
import { BaseRepository, TransactionClient } from '../base.repository';

export class UserRepository extends BaseRepository {
  constructor(tenantId: string, tx?: TransactionClient) {
    super(tenantId, tx);
  }

  async findById(id: string) {
    return this.db.user.findUnique({ where: { id } });
  }

  async findByEmail(email: string) {
    return this.db.user.findFirst({
      where: this.where({ email }),
    });
  }

  async findByEmailAnyTenant(email: string) {
    return this.db.user.findFirst({
      where: { email },
    });
  }

  async findAll(options?: { isActive?: boolean }) {
    return this.db.user.findMany({
      where: this.where({
        ...(options?.isActive !== undefined && { isActive: options.isActive }),
      }),
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
  }

  async findByRole(role: string) {
    return this.db.user.findMany({
      where: this.where({ role: role as string }),
      orderBy: { firstName: 'asc' },
      take: 500,
    });
  }

  async findByDepartment(department: string) {
    return this.db.user.findMany({
      where: this.where({ department }),
      orderBy: { firstName: 'asc' },
      take: 500,
    });
  }

  async create(data: Prisma.UserCreateInput) {
    return this.db.user.create({ data });
  }

  async update(id: string, data: Prisma.UserUpdateInput) {
    return this.db.user.update({ where: { id }, data });
  }

  async updateActiveSession(id: string, sessionId: string | null) {
    return this.db.user.update({
      where: { id },
      data: { activeSessionId: sessionId },
    });
  }

  async deactivate(id: string) {
    return this.db.user.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async count() {
    return this.db.user.count({
      where: this.tenantFilter(),
    });
  }

  async countActive() {
    return this.db.user.count({
      where: this.where({ isActive: true }),
    });
  }
}
