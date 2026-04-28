import { prisma } from '@/lib/db/prisma';
import { tenantWhere } from '@/lib/db/tenantLookup';
import { createAuditLog } from '@/lib/utils/audit';

export type NotificationScope = 'ER' | 'IPD' | 'OPD' | 'ORDERS' | 'RESULTS' | 'BILLING' | 'SYSTEM';
export type NotificationSeverity = 'INFO' | 'WARN' | 'CRITICAL';

export async function emitNotification(args: {
  db?: any; // ignored — kept for call-site compat
  tenantId: string;
  recipientUserId: string;
  recipientRole?: string | null;
  scope: NotificationScope;
  kind: string;
  severity?: NotificationSeverity;
  title: string;
  message: string;
  entity?: {
    type: string;
    id: string;
    encounterCoreId?: string | null;
    patientMasterId?: string | null;
    orderId?: string | null;
    taskId?: string | null;
    link?: string | null;
  } | null;
  dedupeKey: string;
  actorUserId?: string | null;
  actorUserEmail?: string | null;
}) {
  const {
    tenantId,
    recipientUserId,
    recipientRole,
    scope,
    kind,
    severity = 'INFO',
    title,
    message,
    entity,
    dedupeKey,
    actorUserId,
    actorUserEmail,
  } = args;

  // Resolve tenant UUID from key
  const tenant = await prisma.tenant.findFirst({
    where: tenantWhere(tenantId),
    select: { id: true },
  });
  const tenantUuid = tenant?.id || tenantId;

  // Dedupe check — look for existing notification with this dedupeKey
  const existing = await prisma.notification.findFirst({
    where: {
      tenantId: tenantUuid,
      dedupeKey,
    },
  });
  if (existing) {
    return { noOp: true, notification: existing };
  }

  const now = new Date();

  const notification = await prisma.notification.create({
    data: {
      tenantId: tenantUuid,
      recipientUserId,
      recipientRole: recipientRole || null,
      recipientType: 'user',
      type: 'in-app',
      kind,
      scope,
      severity,
      channel: scope,
      title,
      body: message,
      message,
      status: 'OPEN',
      dedupeKey,
      actorUserId: actorUserId || null,
      actorUserEmail: actorUserEmail || null,
      entity: entity ? (entity as unknown as string) : null,
      metadata: {
        entity: entity || null,
      },
      createdAt: now,
    },
  });

  await createAuditLog(
    'notification',
    notification.id,
    'CREATE',
    actorUserId || 'system',
    actorUserEmail || undefined,
    { after: notification },
    tenantId
  );

  return { notification };
}

export async function emitNotificationToRole(args: {
  db?: any; // ignored
  tenantId: string;
  recipientRole: string;
  scope: NotificationScope;
  kind: string;
  severity?: NotificationSeverity;
  title: string;
  message: string;
  entity?: {
    type: string;
    id: string;
    encounterCoreId?: string | null;
    patientMasterId?: string | null;
    orderId?: string | null;
    taskId?: string | null;
    link?: string | null;
  } | null;
  dedupeKey: string;
  actorUserId?: string | null;
  actorUserEmail?: string | null;
}) {
  const { tenantId, recipientRole, dedupeKey } = args;

  // Resolve tenant UUID
  const tenant = await prisma.tenant.findFirst({
    where: tenantWhere(tenantId),
    select: { id: true },
  });
  const tenantUuid = tenant?.id || tenantId;

  // Find users with the matching role (case-insensitive contains)
  const users = await prisma.user.findMany({
    where: {
      tenantId: tenantUuid,
      role: { equals: recipientRole.toUpperCase() as string },
    },
    select: { id: true, email: true, role: true },
  });

  if (!users.length) return { notifications: [] };

  const notifications = [];
  for (const user of users) {
    const userId = String(user.id || '');
    if (!userId) continue;
    const result = await emitNotification({
      ...args,
      recipientUserId: userId,
      recipientRole,
      dedupeKey: `${dedupeKey}:${userId}`,
    });
    notifications.push(result.notification || result);
  }

  return { notifications };
}
