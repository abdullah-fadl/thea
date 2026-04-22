const SCHEDULE_HOURS: Record<string, number> = {
  Q6H: 6,
  Q8H: 8,
  Q12H: 12,
  Q24H: 24,
};

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function withinWindow(date: Date, start: Date, end: Date): boolean {
  return date.getTime() >= start.getTime() && date.getTime() <= end.getTime();
}

export function computeMarDue(args: {
  orders: any[];
  latestByOrder: Record<string, any>;
  windowEvents: any[];
  now?: Date;
}): {
  due: any[];
  prn: any[];
  overdueCountByOrder: Record<string, number>;
} {
  const { orders, latestByOrder, windowEvents } = args;
  const now = args.now || new Date();
  const windowStart = addHours(now, -24);
  const windowEnd = addHours(now, 24);
  const graceMs = 60 * 60 * 1000;

  const eventsByKey = new Map<string, any>();
  for (const ev of windowEvents) {
    const key = `${ev.orderId}:${new Date(ev.scheduledFor).toISOString()}`;
    eventsByKey.set(key, ev);
  }

  const due: any[] = [];
  const prn: any[] = [];
  for (const o of orders) {
    const currentStatus = latestByOrder[o.id]?.status || o.status || 'DRAFT';
    if (currentStatus !== 'ACTIVE' && currentStatus !== 'VERIFIED') continue;

    const type = String(o.type || '').toUpperCase();
    if (type === 'PRN') {
      prn.push({
        orderId: o.id,
        drugName: o.drugName,
        route: o.route,
        type,
        prnMaxPer24h: o.prnMaxPer24h ?? null,
      });
      continue;
    }

    const startAt = o.startAt ? new Date(o.startAt) : new Date(o.createdAt);
    const endAt = o.endAt ? new Date(o.endAt) : null;

    const addDue = (scheduledFor: Date) => {
      if (!withinWindow(scheduledFor, windowStart, windowEnd)) return;
      if (endAt && scheduledFor.getTime() > endAt.getTime()) return;
      const key = `${o.id}:${scheduledFor.toISOString()}`;
      if (eventsByKey.has(key)) return;
      const overdue = now.getTime() > scheduledFor.getTime() + graceMs;
      due.push({
        orderId: o.id,
        drugName: o.drugName,
        route: o.route,
        type,
        schedule: o.schedule || null,
        scheduledFor,
        overdue,
      });
    };

    if (type === 'STAT' || type === 'ONCE') {
      addDue(startAt);
      continue;
    }

    const hours = SCHEDULE_HOURS[String(o.schedule || '').toUpperCase()] || 0;
    if (!hours) continue;
    let cursor = new Date(startAt);
    while (cursor.getTime() < windowStart.getTime()) {
      cursor = addHours(cursor, hours);
    }
    while (cursor.getTime() <= windowEnd.getTime()) {
      addDue(cursor);
      cursor = addHours(cursor, hours);
    }
  }

  const overdueCountByOrder: Record<string, number> = {};
  for (const item of due) {
    if (!item.overdue) continue;
    overdueCountByOrder[item.orderId] = (overdueCountByOrder[item.orderId] || 0) + 1;
  }

  return { due, prn, overdueCountByOrder };
}
