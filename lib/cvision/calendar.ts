/**
 * CVision Company Calendar & Events Engine
 *
 * Handles:
 *  - Event CRUD with recurrence
 *  - Saudi holidays pre-populated
 *  - RSVP tracking
 *  - Birthday/anniversary integration
 *  - Month/week/day views
 */

import { v4 as uuidv4 } from 'uuid';
import type { Db } from '@/lib/cvision/infra/mongo-compat';

// ── Types ───────────────────────────────────────────────────────────────

export interface CalendarEvent {
  _id?: string;
  id: string;
  tenantId: string;
  eventId: string;
  title: string;
  description?: string;
  type: 'HOLIDAY' | 'COMPANY_EVENT' | 'TRAINING' | 'MEETING' | 'DEADLINE' | 'BIRTHDAY' | 'ANNIVERSARY' | 'RAMADAN' | 'CUSTOM';
  startDate: string;
  endDate: string;
  allDay: boolean;
  time?: string;
  location?: string;
  virtualLink?: string;
  recurring: boolean;
  recurrenceRule?: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  visibility: 'ALL' | 'DEPARTMENT' | 'MANAGEMENT' | 'CUSTOM';
  departments?: string[];
  rsvpRequired: boolean;
  attendees?: { employeeId: string; employeeName: string; rsvp: 'YES' | 'NO' | 'MAYBE' | 'PENDING' }[];
  color: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// ── Event Type Config ───────────────────────────────────────────────────

export const EVENT_TYPES = [
  { value: 'HOLIDAY', label: 'Holiday', color: '#ef4444', icon: 'calendar' },
  { value: 'COMPANY_EVENT', label: 'Company Event', color: '#3b82f6', icon: 'party' },
  { value: 'TRAINING', label: 'Training', color: '#8b5cf6', icon: 'graduation' },
  { value: 'MEETING', label: 'Meeting', color: '#06b6d4', icon: 'users' },
  { value: 'DEADLINE', label: 'Deadline', color: '#f97316', icon: 'clock' },
  { value: 'BIRTHDAY', label: 'Birthday', color: '#ec4899', icon: 'cake' },
  { value: 'ANNIVERSARY', label: 'Work Anniversary', color: '#10b981', icon: 'award' },
  { value: 'RAMADAN', label: 'Ramadan', color: '#6366f1', icon: 'moon' },
  { value: 'CUSTOM', label: 'Custom', color: '#6b7280', icon: 'star' },
] as const;

export const EVENT_TYPE_COLORS: Record<string, string> = {
  HOLIDAY: '#ef4444',
  COMPANY_EVENT: '#3b82f6',
  TRAINING: '#8b5cf6',
  MEETING: '#06b6d4',
  DEADLINE: '#f97316',
  BIRTHDAY: '#ec4899',
  ANNIVERSARY: '#10b981',
  RAMADAN: '#6366f1',
  CUSTOM: '#6b7280',
};

// ── Saudi Holidays 2026 ─────────────────────────────────────────────────

export const SAUDI_HOLIDAYS_2026 = [
  { title: 'Founding Day', date: '2026-02-22', endDate: '2026-02-22', type: 'HOLIDAY' as const },
  { title: 'Eid Al-Fitr', date: '2026-03-20', endDate: '2026-03-23', type: 'HOLIDAY' as const },
  { title: 'Arafat Day', date: '2026-05-26', endDate: '2026-05-26', type: 'HOLIDAY' as const },
  { title: 'Eid Al-Adha', date: '2026-05-27', endDate: '2026-05-30', type: 'HOLIDAY' as const },
  { title: 'Saudi National Day', date: '2026-09-23', endDate: '2026-09-23', type: 'HOLIDAY' as const },
  { title: 'Ramadan Begins (6-hour workday)', date: '2026-02-28', endDate: '2026-02-28', type: 'RAMADAN' as const },
];

// ── CRUD ────────────────────────────────────────────────────────────────

export async function createEvent(
  db: Db, tenantId: string, data: any,
): Promise<{ id: string; eventId: string }> {
  const now = new Date();
  const id = uuidv4();
  const eventId = `EVT-${Date.now()}`;

  const doc = {
    id,
    tenantId,
    eventId,
    title: data.title,
    description: data.description || '',
    type: data.type || 'CUSTOM',
    startDate: data.startDate,
    endDate: data.endDate || data.startDate,
    allDay: data.allDay !== false,
    time: data.time || '',
    location: data.location || '',
    virtualLink: data.virtualLink || '',
    recurring: data.recurring || false,
    recurrenceRule: data.recurrenceRule || null,
    visibility: data.visibility || 'ALL',
    departments: data.departments || [],
    rsvpRequired: data.rsvpRequired || false,
    attendees: data.attendees || [],
    color: data.color || EVENT_TYPE_COLORS[data.type] || '#6b7280',
    createdBy: data.createdBy || '',
    createdAt: now,
    updatedAt: now,
  };

  await db.collection('cvision_calendar_events').insertOne(doc);
  return { id, eventId };
}

export async function updateEvent(
  db: Db, tenantId: string, eventId: string, data: any,
): Promise<{ success: boolean }> {
  const now = new Date();
  const set: any = { updatedAt: now };
  const fields = ['title', 'description', 'type', 'startDate', 'endDate', 'allDay', 'time',
    'location', 'virtualLink', 'recurring', 'recurrenceRule', 'visibility', 'departments',
    'rsvpRequired', 'color'];
  for (const f of fields) {
    if (data[f] !== undefined) set[f] = data[f];
  }

  await db.collection('cvision_calendar_events').updateOne(
    { tenantId, $or: [{ id: eventId }, { eventId }] },
    { $set: set },
  );
  return { success: true };
}

export async function deleteEvent(
  db: Db, tenantId: string, eventId: string,
): Promise<{ success: boolean }> {
  await db.collection('cvision_calendar_events').deleteOne({
    tenantId, $or: [{ id: eventId }, { eventId }],
  });
  return { success: true };
}

export async function rsvpEvent(
  db: Db, tenantId: string, eventId: string, employeeId: string, employeeName: string, rsvp: string,
): Promise<{ success: boolean }> {
  const now = new Date();
  const event = await db.collection('cvision_calendar_events').findOne({
    tenantId, $or: [{ id: eventId }, { eventId }],
  });
  if (!event) return { success: false };

  const attendees = (event.attendees || []) as Record<string, unknown>[];
  const idx = attendees.findIndex((a: any) => a.employeeId === employeeId);
  if (idx >= 0) {
    attendees[idx].rsvp = rsvp;
  } else {
    attendees.push({ employeeId, employeeName, rsvp });
  }

  await db.collection('cvision_calendar_events').updateOne(
    { tenantId, _id: event._id },
    { $set: { attendees, updatedAt: now } },
  );
  return { success: true };
}

export async function importHolidays(
  db: Db, tenantId: string, createdBy: string,
): Promise<{ imported: number }> {
  const now = new Date();
  let imported = 0;

  for (const h of SAUDI_HOLIDAYS_2026) {
    const exists = await db.collection('cvision_calendar_events').findOne({
      tenantId, title: h.title, startDate: h.date,
    });
    if (!exists) {
      await db.collection('cvision_calendar_events').insertOne({
        id: uuidv4(),
        tenantId,
        eventId: `HOL-${Date.now()}-${imported}`,
        title: h.title,
        description: '',
        type: h.type,
        startDate: h.date,
        endDate: h.endDate,
        allDay: true,
        recurring: h.type === 'HOLIDAY',
        recurrenceRule: h.type === 'HOLIDAY' ? 'YEARLY' : null,
        visibility: 'ALL',
        departments: [],
        rsvpRequired: false,
        attendees: [],
        color: EVENT_TYPE_COLORS[h.type] || '#ef4444',
        createdBy,
        createdAt: now,
        updatedAt: now,
      });
      imported++;
    }
  }

  return { imported };
}

// ── Queries ─────────────────────────────────────────────────────────────

export async function getEvents(
  db: Db, tenantId: string, filters: { start?: string; end?: string; type?: string } = {},
): Promise<any[]> {
  const query: any = { tenantId };
  if (filters.type) query.type = filters.type;
  if (filters.start && filters.end) {
    query.$or = [
      { startDate: { $gte: filters.start, $lte: filters.end } },
      { endDate: { $gte: filters.start, $lte: filters.end } },
      { startDate: { $lte: filters.start }, endDate: { $gte: filters.end } },
    ];
  } else if (filters.start) {
    query.startDate = { $gte: filters.start };
  }

  return db.collection('cvision_calendar_events').find(query).sort({ startDate: 1 }).limit(1000).toArray();
}

export async function getBirthdaysThisMonth(db: Db, tenantId: string): Promise<any[]> {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');

  const employees = await db.collection('cvision_employees')
    .find({ tenantId, status: { $in: ['ACTIVE', 'Active', 'PROBATION'] } })
    .toArray();

  return employees
    .filter((e: any) => {
      const dob = e.dateOfBirth || e.birthDate;
      if (!dob) return false;
      const d = new Date(dob);
      return String(d.getMonth() + 1).padStart(2, '0') === month;
    })
    .map((e: any) => ({
      employeeId: e.employeeId || e.id,
      name: e.fullName || e.name || `${e.firstName || ''} ${e.lastName || ''}`.trim(),
      date: e.dateOfBirth || e.birthDate,
      department: e.department || e.departmentName || '',
    }));
}

export async function getUpcomingEvents(db: Db, tenantId: string, days: number = 30): Promise<any[]> {
  const now = new Date();
  const start = now.toISOString().split('T')[0];
  const end = new Date(now.getTime() + days * 86400000).toISOString().split('T')[0];
  return getEvents(db, tenantId, { start, end });
}
