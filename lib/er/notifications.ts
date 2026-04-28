import { prisma } from '@/lib/db/prisma';

export type ErNotificationType =
  | 'ESCALATION_OPEN'
  | 'TRANSFER_REQUEST_OPEN'
  | 'CRITICAL_VITALS'
  | 'OVERDUE_VITALS'
  | 'OVERDUE_TASKS';

export type ErNotificationSeverity = 'INFO' | 'WARN' | 'CRITICAL';

export function severityForType(type: ErNotificationType): ErNotificationSeverity {
  if (type === 'CRITICAL_VITALS') return 'CRITICAL';
  if (type === 'ESCALATION_OPEN' || type === 'TRANSFER_REQUEST_OPEN') return 'WARN';
  if (type === 'OVERDUE_VITALS' || type === 'OVERDUE_TASKS') return 'WARN';
  return 'INFO';
}

export function messageFor(type: ErNotificationType, encounterId: string): string {
  switch (type) {
    case 'ESCALATION_OPEN':
      return `Escalation opened for encounter ${encounterId}.`;
    case 'TRANSFER_REQUEST_OPEN':
      return `Transfer request opened for encounter ${encounterId}.`;
    case 'CRITICAL_VITALS':
      return `Critical vitals detected for encounter ${encounterId}.`;
    case 'OVERDUE_VITALS':
      return `Vitals re-check overdue for encounter ${encounterId}.`;
    case 'OVERDUE_TASKS':
      return `Pending tasks overdue for encounter ${encounterId}.`;
    default:
      return `Update for encounter ${encounterId}.`;
  }
}

export function bucket30Min(d: Date): string {
  const n = Math.floor(d.getTime() / (30 * 60 * 1000));
  return String(n);
}

/**
 * Create a system-generated ER notification if one with the same
 * deduplication key (type + encounterId + dedupeKey title) does not
 * already exist.
 *
 * The Prisma ErNotification model does not have a dedicated dedupeKey
 * column.  We encode the deduplication key into `title` (prefixed with
 * "SYSTEM:") and check for an existing row matching (encounterId, title).
 *
 * `recipientId` is set to "SYSTEM" for system-generated notifications.
 */
export async function createErNotificationIfMissing(args: {
  _db?: any;
  db?: any;
  tenantId: string;
  type: ErNotificationType;
  encounterId: string;
  dedupeKey: string;
  createdAt?: Date;
}) {
  const title = `SYSTEM:${args.dedupeKey}`;

  const existing = await prisma.erNotification.findFirst({
    where: {
      tenantId: args.tenantId,
      encounterId: args.encounterId,
      title,
    },
    select: { id: true },
  });

  if (existing) return { created: false as const, id: existing.id };

  const record = await prisma.erNotification.create({
    data: {
      tenantId: args.tenantId,
      encounterId: args.encounterId,
      type: args.type,
      recipientId: 'SYSTEM',
      title,
      message: messageFor(args.type, args.encounterId),
      readAt: null,
      createdAt: args.createdAt ?? new Date(),
    },
  });

  return { created: true as const, id: record.id };
}

/**
 * Batch-insert ER notifications with deduplication.
 *
 * For each item, checks whether a notification already exists with the
 * same (encounterId, title=SYSTEM:<dedupeKey>).  Only inserts missing ones.
 */
export async function createErNotificationsDeduped(args: {
  _db?: any;
  db?: any;
  tenantId: string;
  items: Array<{ type: ErNotificationType; encounterId: string; dedupeKey: string }>;
}) {
  const items = args.items || [];
  if (items.length === 0) return { inserted: 0 };

  // Build the titles we'll use for deduplication
  const titleMap = items.map((i) => ({
    ...i,
    title: `SYSTEM:${i.dedupeKey}`,
  }));

  const titles = Array.from(new Set(titleMap.map((i) => i.title)));

  // Fetch all existing notifications that match any of our deduplication titles (scoped to tenant)
  const existing = await prisma.erNotification.findMany({
    where: {
      tenantId: args.tenantId,
      title: { in: titles },
    },
    select: { title: true, encounterId: true },
  });

  const existingSet = new Set(
    existing.map((e) => `${e.encounterId}::${e.title}`)
  );

  const toInsert = titleMap.filter(
    (i) => !existingSet.has(`${i.encounterId}::${i.title}`)
  );

  if (toInsert.length > 0) {
    await prisma.erNotification.createMany({
      data: toInsert.map((i) => ({
        tenantId: args.tenantId,
        encounterId: i.encounterId,
        type: i.type,
        recipientId: 'SYSTEM',
        title: i.title,
        message: messageFor(i.type, i.encounterId),
        readAt: null,
      })),
    });
  }

  return { inserted: toInsert.length };
}
