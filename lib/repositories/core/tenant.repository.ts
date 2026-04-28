import { Prisma } from '@prisma/client';
import { BaseRepository, TransactionClient } from '../base.repository';

export class TenantRepository extends BaseRepository {
  constructor(tenantId: string, tx?: TransactionClient) {
    super(tenantId, tx);
  }

  async findById(id: string) {
    return this.db.tenant.findUnique({ where: { id } });
  }

  async findByTenantId(tenantId: string) {
    return this.db.tenant.findUnique({ where: { tenantId } });
  }

  async findAll() {
    return this.db.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
  }

  async findActive() {
    return this.db.tenant.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { name: 'asc' },
      take: 500,
    });
  }

  async create(data: Prisma.TenantCreateInput) {
    return this.db.tenant.create({ data });
  }

  async update(id: string, data: Prisma.TenantUpdateInput) {
    return this.db.tenant.update({ where: { id }, data });
  }

  async updateByTenantId(tenantId: string, data: Prisma.TenantUpdateInput) {
    return this.db.tenant.update({ where: { tenantId }, data });
  }

  async countUsers(id: string) {
    return this.db.user.count({ where: { tenantId: id } });
  }
}
