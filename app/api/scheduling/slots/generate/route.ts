import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { createAuditLog } from '@/lib/utils/audit';
import { canManageScheduling } from '@/lib/scheduling/access';
import { validateBody } from '@/lib/validation/helpers';
import { generateSlotsSchema } from '@/lib/validation/scheduling.schema';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function parseDate(value: string): Date | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateRange(from: string, to: string) {
  const dates: string[] = [];
  let cursor = parseDate(from);
  const end = parseDate(to);
  if (!cursor || !end) return dates;
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
  }
  return dates;
}

function addOneDay(dateStr: string): string {
  const d = parseDate(dateStr);
  if (!d) return dateStr;
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function timeToMinutes(time: string) {
  const [h, m] = time.split(':').map((n) => Number(n));
  return h * 60 + m;
}

function buildKeyISO(date: string, minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const hh = String(h).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  return `${date}T${hh}:${mm}:00.000Z`;
}

function normalizeTimezone(input: any): 'UTC' | 'Asia/Riyadh' {
  const tz = String(input || '').trim();
  // Thea Health is Saudi-centric; default to Asia/Riyadh to avoid "shifted" schedules.
  if (!tz) return 'Asia/Riyadh';
  if (tz === 'Asia/Riyadh') return 'Asia/Riyadh';
  // Legacy templates were often saved as UTC even though times were entered as local.
  // Treat UTC as Asia/Riyadh to match real-world schedules.
  if (tz.toUpperCase() === 'UTC') return 'Asia/Riyadh';
  if (tz.toUpperCase() === 'ETC/UTC') return 'Asia/Riyadh';
  // Safe default
  return 'Asia/Riyadh';
}

function buildInstant(date: string, minutes: number, timezone: 'UTC' | 'Asia/Riyadh') {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const hh = String(h).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  const suffix = timezone === 'Asia/Riyadh' ? '+03:00' : 'Z';
  // Parse as the *local time* in the given timezone, producing a UTC instant.
  return new Date(`${date}T${hh}:${mm}:00.000${suffix}`);
}

function overlaps(startA: number, endA: number, startB: number, endB: number) {
  return startA < endB && startB < endA;
}

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user, role }) => {
  if (!canManageScheduling({ user, tenantId, role })) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const v = validateBody(body, generateSlotsSchema);
  if ('error' in v) return v.error;

  const resourceId = String(body.resourceId || '').trim();
  const fromDate = String(body.fromDate || '').trim();
  const toDate = String(body.toDate || '').trim();

  if (!resourceId || !fromDate || !toDate) {
    return NextResponse.json({ error: 'Validation failed', missing: ['resourceId', 'fromDate', 'toDate'] }, { status: 400 });
  }

  // [S-01] Guard: cap generation range to 90 days to prevent resource exhaustion
  const rangeDays = (new Date(toDate).getTime() - new Date(fromDate).getTime()) / (24 * 60 * 60 * 1000);
  if (rangeDays > 90) {
    return NextResponse.json(
      { error: 'Date range exceeds 90 days. Please generate in smaller batches.', code: 'RANGE_TOO_LARGE' },
      { status: 400 }
    );
  }
  if (rangeDays < 0) {
    return NextResponse.json({ error: 'fromDate must be before toDate' }, { status: 400 });
  }

  const templates = await prisma.schedulingTemplate.findMany({
    where: { tenantId, resourceId, status: 'ACTIVE' },
    take: 200,
  });

  const overrides = await prisma.schedulingAvailabilityOverride.findMany({
    where: { tenantId, resourceId, date: { gte: fromDate, lte: toDate } },
    take: 200,
  });
  const overridesByDate = overrides.reduce<Record<string, (typeof overrides)[0]>>((acc, item) => {
    acc[String(item.date || '')] = item;
    return acc;
  }, {});

  const dates = dateRange(fromDate, toDate);
  const slotMap = new Map<string, any>();

  for (const date of dates) {
    const day = new Date(`${date}T00:00:00.000Z`).getUTCDay();
    const applicable = templates.filter((t: any) => {
      if (t.effectiveFrom && date < t.effectiveFrom) return false;
      if (t.effectiveTo && date > t.effectiveTo) return false;
      return Array.isArray(t.daysOfWeek) ? t.daysOfWeek.includes(day) : false;
    });
    // Root fix: treat templates as versioned. For a given date, use only the latest effectiveFrom
    // (but allow multiple templates with the same effectiveFrom for split shifts).
    const maxEffectiveFrom = applicable.reduce<string>((max, t: any) => {
      const ef = String(t.effectiveFrom || '').trim();
      if (!ef) return max;
      return !max || ef > max ? ef : max;
    }, '');
    const dayTemplates = maxEffectiveFrom ? applicable.filter((t: any) => String(t.effectiveFrom || '').trim() === maxEffectiveFrom) : applicable;

    for (const tmpl of dayTemplates) {
      const tz = normalizeTimezone(tmpl.timezone);
      const startMin = timeToMinutes(tmpl.startTime!);
      let endMin = timeToMinutes(tmpl.endTime!);
      const step = Number(tmpl.slotMinutes || 0);
      if (!step) continue;
      // Overnight shift (e.g. 20:00–02:00): endMin < startMin — split into same-day + next-day
      const overnight = endMin <= startMin;
      if (overnight) endMin += 24 * 60; // treat end as "next day" for loop
      for (let m = startMin; m + step <= endMin; m += step) {
        const slotDate = overnight && m >= 24 * 60 ? addOneDay(date) : date;
        if (slotDate < fromDate || slotDate > toDate) continue;
        const slotM = overnight && m >= 24 * 60 ? m - 24 * 60 : m;
        const slotMEnd = slotM + step;
        const startKey = buildKeyISO(slotDate, slotM);
        const endKey = buildKeyISO(slotDate, slotMEnd);
        const generationKey = `${resourceId}:${slotDate}:${startKey}`;
        if (!slotMap.has(generationKey)) {
          slotMap.set(generationKey, {
            status: 'OPEN',
            templateId: tmpl.id,
            date: slotDate,
            startKey,
            endKey,
            startAt: buildInstant(slotDate, slotM, tz),
            endAt: buildInstant(slotDate, slotMEnd, tz),
          });
        }
      }
    }

    const override = overridesByDate[date];
    if (override) {
      const tz = normalizeTimezone((dayTemplates[0] as Record<string, unknown>)?.timezone) || 'UTC';
      const opens = Array.isArray(override.opens) ? override.opens : [];
      for (const open of opens) {
        const openItem = open as Record<string, unknown>;
        const startMin = timeToMinutes(String(openItem.startTime || ''));
        const endMin = timeToMinutes(String(openItem.endTime || ''));
        const step = Number((dayTemplates[0] as Record<string, unknown>)?.slotMinutes || 15);
        if (!step || startMin >= endMin) continue;
        for (let m = startMin; m + step <= endMin; m += step) {
          const startKey = buildKeyISO(date, m);
          const endKey = buildKeyISO(date, m + step);
          const generationKey = `${resourceId}:${date}:${startKey}`;
          if (!slotMap.has(generationKey)) {
            slotMap.set(generationKey, {
              status: 'OPEN',
              templateId: null,
              date,
              startKey,
              endKey,
              startAt: buildInstant(date, m, tz),
              endAt: buildInstant(date, m + step, tz),
            });
          }
        }
      }

      const blocks = Array.isArray(override.blocks) ? override.blocks : [];
      for (const block of blocks) {
        const blockItem = block as Record<string, unknown>;
        const blockStart = timeToMinutes(String(blockItem.startTime || ''));
        const blockEnd = timeToMinutes(String(blockItem.endTime || ''));
        for (const [key, slot] of slotMap.entries()) {
          if (!key.includes(`:${date}:`)) continue;
          const slotStart = timeToMinutes(String(slot.startKey).slice(11, 16));
          const slotEnd = timeToMinutes(String(slot.endKey).slice(11, 16));
          if (overlaps(slotStart, slotEnd, blockStart, blockEnd)) {
            slot.status = 'BLOCKED';
          }
        }
      }
    }
  }

  const now = new Date();
  const datesWithSlots = [...new Set(Array.from(slotMap.values()).map((s) => String(s.date || '').trim()).filter(Boolean))];
  const allDates = dateRange(fromDate, toDate);
  const datesSkipped = allDates.filter((d) => !datesWithSlots.includes(d));

  // Remove stale OPEN/BLOCKED slots in the range before regenerating.
  // Booked/held slots are preserved.
  await prisma.schedulingSlot.deleteMany({
    where: {
      tenantId,
      resourceId,
      date: { gte: fromDate, lte: toDate },
      status: { in: ['OPEN', 'BLOCKED'] },
    },
  });

  // Fetch existing generationKeys (BOOKED/HELD slots that survived deleteMany)
  const existingRows = await prisma.schedulingSlot.findMany({
    where: { tenantId, resourceId, date: { gte: fromDate, lte: toDate } },
    select: { generationKey: true },
    take: 5000,
  });
  const existingKeys = new Set(existingRows.map((r) => r.generationKey).filter(Boolean));

  // Batch insert new slots only (existing BOOKED/HELD slots are preserved)
  const toInsert: any[] = [];
  for (const [generationKey, slot] of slotMap.entries()) {
    if (existingKeys.has(generationKey)) continue;
    const docId = uuidv4();
    const startAt = slot.startAt instanceof Date ? slot.startAt : new Date(slot.startAt);
    const endAt = slot.endAt instanceof Date ? slot.endAt : new Date(slot.endAt);
    const date = String(slot.date || '').trim() || String(generationKey.split(':')[1] || '').trim() || fromDate;
    const status = String(slot.status || 'OPEN');
    const derivedFrom = { templateId: slot.templateId ?? null, generationKey };
    toInsert.push({
      id: docId,
      tenantId,
      resourceId,
      date,
      status,
      startAt,
      endAt,
      generationKey,
      templateId: slot.templateId ?? null,
      derivedFrom,
    });
  }

  let upsertedCount = 0;
  const modifiedCount = 0;
  if (toInsert.length > 0) {
    const batchRes = await prisma.schedulingSlot.createMany({ data: toInsert });
    upsertedCount = batchRes.count;
  }
  const total = slotMap.size;
  const noOpCount = Math.max(0, total - upsertedCount - modifiedCount);

  try {
    await createAuditLog(
      'scheduling_slot',
      String(resourceId),
      'GENERATE_BULK',
      userId || 'system',
      user?.email,
      {
        after: {
          resourceId,
          fromDate,
          toDate,
          total,
          inserted: upsertedCount,
          updated: modifiedCount,
          noOp: noOpCount,
        },
      },
      tenantId
    );
  } catch {
    // Best-effort auditing; do not fail generation.
  }

  return NextResponse.json({
    generatedCount: upsertedCount + modifiedCount,
    insertedCount: upsertedCount,
    updatedCount: modifiedCount,
    noOpCount,
    total,
    datesWithSlots,
    datesSkipped,
  });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'scheduling.create' }
);
