import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Access Control Indexes
 *
 * Run once per tenant to create necessary indexes for:
 * - cvision_delegations
 * - cvision_approval_matrix
 * - cvision_audit_logs
 */

import { getTenantDbByKey } from '@/lib/cvision/infra';

export async function ensureAccessControlIndexes(tenantId: string): Promise<void> {
  const db = await getTenantDbByKey(tenantId);

  // ── Delegations ──────────────────────────────────────────────────
  const delegations = db.collection('cvision_delegations');
  await Promise.all([
    delegations.createIndex({ tenantId: 1, delegatorId: 1, status: 1 }),
    delegations.createIndex({ tenantId: 1, delegateId: 1, status: 1 }),
    delegations.createIndex({ tenantId: 1, endDate: 1, status: 1 }),
  ]);

  // ── Approval Matrix ──────────────────────────────────────────────
  const approvalMatrix = db.collection('cvision_approval_matrix');
  await approvalMatrix.createIndex(
    { tenantId: 1, requestType: 1, isActive: 1, priority: -1 },
  );

  // ── Audit Logs ───────────────────────────────────────────────────
  const auditLogs = db.collection('cvision_audit_logs');
  await Promise.all([
    auditLogs.createIndex({ tenantId: 1, createdAt: -1 }),
    auditLogs.createIndex({ tenantId: 1, actorUserId: 1, createdAt: -1 }),
  ]);

  logger.info(`[CVision] Access control indexes created for tenant: ${tenantId}`);
}
