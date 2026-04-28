import { Prisma } from '@prisma/client';
import { BaseRepository, TransactionClient } from '../base.repository';

export class SessionRepository extends BaseRepository {
  constructor(tenantId: string, tx?: TransactionClient) {
    super(tenantId, tx);
  }

  async findById(id: string) {
    return this.db.session.findUnique({ where: { id } });
  }

  async findBySessionId(sessionId: string) {
    return this.db.session.findUnique({ where: { sessionId } });
  }

  async findByUserId(userId: string) {
    return this.db.session.findMany({
      where: { userId },
      orderBy: { lastSeenAt: 'desc' },
      take: 100,
    });
  }

  async findActiveByUserId(userId: string) {
    return this.db.session.findMany({
      where: {
        userId,
        expiresAt: { gt: new Date() },
      },
      orderBy: { lastSeenAt: 'desc' },
      take: 100,
    });
  }

  async create(data: Prisma.SessionCreateInput) {
    return this.db.session.create({ data });
  }

  async update(id: string, data: Prisma.SessionUpdateInput) {
    return this.db.session.update({ where: { id }, data });
  }

  async updateBySessionId(sessionId: string, data: Prisma.SessionUpdateInput) {
    return this.db.session.update({ where: { sessionId }, data });
  }

  async touch(sessionId: string) {
    const now = new Date();
    return this.db.session.update({
      where: { sessionId },
      data: {
        lastSeenAt: now,
        lastActivityAt: now,
      },
    });
  }

  async deleteBySessionId(sessionId: string) {
    return this.db.session.delete({ where: { sessionId } });
  }

  async deleteExpired() {
    return this.db.session.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
  }

  async deleteAllForUser(userId: string) {
    return this.db.session.deleteMany({ where: { userId } });
  }
}
