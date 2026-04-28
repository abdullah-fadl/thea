/**
 * Manager Appointment Booking Engine
 *
 * Handles manager availability configuration, slot generation,
 * appointment lifecycle (book → confirm → complete), and stats.
 *
 * Saudi weekend (Fri/Sat) is automatically blocked.
 *
 * Collections:
 *   cvision_manager_availability — per-manager weekly slots & blocked dates
 *   cvision_appointments         — booked appointments
 */

import { v4 as uuidv4 } from 'uuid';
import { getCVisionDb } from '@/lib/cvision/db';
import { CVISION_COLLECTIONS } from '@/lib/cvision/constants';

const AVAIL_COL = 'cvision_manager_availability';
const APT_COL = 'cvision_appointments';

async function availCol(tenantId: string) {
  const db = await getCVisionDb(tenantId);
  return db.collection(AVAIL_COL);
}
async function aptCol(tenantId: string) {
  const db = await getCVisionDb(tenantId);
  return db.collection(APT_COL);
}
async function empCol(tenantId: string) {
  const db = await getCVisionDb(tenantId);
  return db.collection(CVISION_COLLECTIONS.employees);
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface WeeklySlot {
  day: number;           // 0=Sun … 4=Thu
  startTime: string;     // "09:00"
  endTime: string;       // "10:00"
  slotDuration: number;  // minutes
  maxBookings: number;
}

export interface BlockedDate {
  date: string;          // YYYY-MM-DD
  reason?: string;
}

export interface ManagerAvailability {
  id: string;
  tenantId: string;
  managerId: string;
  managerName: string;
  department: string;
  weeklySlots: WeeklySlot[];
  blockedDates: BlockedDate[];
  autoApprove: boolean;
  bufferMinutes: number;
  maxAdvanceDays: number;
  isActive: boolean;
  updatedAt: Date;
}

export type AppointmentPurpose =
  | 'ONE_ON_ONE' | 'PERFORMANCE_REVIEW' | 'CAREER_DISCUSSION'
  | 'CONCERN' | 'LEAVE_DISCUSSION' | 'SALARY_REVIEW'
  | 'DISCIPLINARY' | 'OTHER';

export type AppointmentStatus =
  | 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED'
  | 'NO_SHOW' | 'RESCHEDULED';

export const PURPOSE_LABELS: Record<AppointmentPurpose, string> = {
  ONE_ON_ONE: 'One-on-One',
  PERFORMANCE_REVIEW: 'Performance Review',
  CAREER_DISCUSSION: 'Career Discussion',
  CONCERN: 'Raise a Concern',
  LEAVE_DISCUSSION: 'Leave Discussion',
  SALARY_REVIEW: 'Salary Review',
  DISCIPLINARY: 'Disciplinary',
  OTHER: 'Other',
};

export interface Appointment {
  id: string;
  tenantId: string;
  appointmentId: string;
  managerId: string;
  managerName: string;
  employeeId: string;
  employeeName: string;
  department: string;
  date: string;
  startTime: string;
  endTime: string;
  duration: number;
  purpose: AppointmentPurpose;
  purposeLabel: string;
  notes?: string;
  location?: string;
  isVirtual: boolean;
  meetingLink?: string;
  status: AppointmentStatus;
  meetingNotes?: string;
  followUpActions?: string[];
  nextAppointment?: string;
  requestedBy: string;
  requestedAt: Date;
  confirmedAt?: Date;
  cancelledAt?: Date;
  cancelledBy?: string;
  cancelReason?: string;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ─── ID helpers ─────────────────────────────────────────────────────────────

async function nextAptId(tenantId: string): Promise<string> {
  const c = await aptCol(tenantId);
  const count = await c.countDocuments({ tenantId });
  return `APT-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function isSaudiWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 5 || day === 6; // Fri=5, Sat=6
}

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function fromMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function generateTimeSlots(
  startTime: string,
  endTime: string,
  duration: number,
  buffer: number
): { startTime: string; endTime: string }[] {
  const slots: { startTime: string; endTime: string }[] = [];
  let cursor = toMinutes(startTime);
  const end = toMinutes(endTime);

  while (cursor + duration <= end) {
    slots.push({
      startTime: fromMinutes(cursor),
      endTime: fromMinutes(cursor + duration),
    });
    cursor += duration + buffer;
  }
  return slots;
}

// ═══════════════════════════════════════════════════════════════════════════
// AVAILABILITY
// ═══════════════════════════════════════════════════════════════════════════

export async function setAvailability(
  tenantId: string,
  managerId: string,
  data: Partial<ManagerAvailability>
): Promise<ManagerAvailability> {
  const c = await availCol(tenantId);
  const existing = await c.findOne({ tenantId, managerId }) as unknown as ManagerAvailability | null;

  if (existing) {
    const update: Record<string, any> = { updatedAt: new Date() };
    if (data.weeklySlots !== undefined) update.weeklySlots = data.weeklySlots;
    if (data.blockedDates !== undefined) update.blockedDates = data.blockedDates;
    if (data.autoApprove !== undefined) update.autoApprove = data.autoApprove;
    if (data.bufferMinutes !== undefined) update.bufferMinutes = data.bufferMinutes;
    if (data.maxAdvanceDays !== undefined) update.maxAdvanceDays = data.maxAdvanceDays;
    if (data.isActive !== undefined) update.isActive = data.isActive;
    if (data.managerName) update.managerName = data.managerName;
    if (data.department) update.department = data.department;

    await c.updateOne({ tenantId, managerId }, { $set: update });
    return (await c.findOne({ tenantId, managerId })) as unknown as ManagerAvailability;
  }

  const avail: ManagerAvailability = {
    id: uuidv4(),
    tenantId,
    managerId,
    managerName: data.managerName || '',
    department: data.department || '',
    weeklySlots: data.weeklySlots || [
      { day: 0, startTime: '09:00', endTime: '11:00', slotDuration: 30, maxBookings: 1 },
      { day: 1, startTime: '09:00', endTime: '11:00', slotDuration: 30, maxBookings: 1 },
      { day: 2, startTime: '09:00', endTime: '11:00', slotDuration: 30, maxBookings: 1 },
      { day: 3, startTime: '09:00', endTime: '11:00', slotDuration: 30, maxBookings: 1 },
    ],
    blockedDates: data.blockedDates || [],
    autoApprove: data.autoApprove ?? true,
    bufferMinutes: data.bufferMinutes ?? 15,
    maxAdvanceDays: data.maxAdvanceDays ?? 14,
    isActive: true,
    updatedAt: new Date(),
  };

  await c.insertOne(avail as unknown as Record<string, unknown>);
  return avail;
}

export async function getAvailability(
  tenantId: string,
  managerId: string
): Promise<ManagerAvailability | null> {
  const c = await availCol(tenantId);
  return (await c.findOne({ tenantId, managerId })) as unknown as ManagerAvailability | null;
}

export async function blockDate(
  tenantId: string,
  managerId: string,
  date: string,
  reason?: string
): Promise<void> {
  const c = await availCol(tenantId);
  await c.updateOne(
    { tenantId, managerId },
    {
      $push: { blockedDates: { date, reason } },
      $set: { updatedAt: new Date() },
    }
  );
}

export async function unblockDate(
  tenantId: string,
  managerId: string,
  date: string
): Promise<void> {
  const c = await availCol(tenantId);
  await c.updateOne(
    { tenantId, managerId },
    {
      $pull: { blockedDates: { date } },
      $set: { updatedAt: new Date() },
    }
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SLOT QUERIES
// ═══════════════════════════════════════════════════════════════════════════

export async function getAvailableSlots(
  tenantId: string,
  managerId: string,
  date: string
): Promise<{ date: string; slots: { startTime: string; endTime: string; available: boolean }[] }> {
  const avail = await getAvailability(tenantId, managerId);
  if (!avail || !avail.isActive) return { date, slots: [] };

  const d = new Date(date + 'T00:00:00');
  if (isSaudiWeekend(d)) return { date, slots: [] };

  const isBlocked = avail.blockedDates.some(b => b.date === date);
  if (isBlocked) return { date, slots: [] };

  const dayOfWeek = d.getDay();
  const daySlots = avail.weeklySlots.filter(s => s.day === dayOfWeek);
  if (!daySlots.length) return { date, slots: [] };

  // Existing bookings on this date
  const c = await aptCol(tenantId);
  const booked = (await c.find({
    tenantId, managerId, date,
    status: { $in: ['PENDING', 'CONFIRMED'] },
  }).toArray()) as unknown as Appointment[];

  const allSlots: { startTime: string; endTime: string; available: boolean }[] = [];

  for (const ds of daySlots) {
    const generated = generateTimeSlots(ds.startTime, ds.endTime, ds.slotDuration, avail.bufferMinutes);
    for (const slot of generated) {
      const bookingsInSlot = booked.filter(b => b.startTime === slot.startTime);
      allSlots.push({
        ...slot,
        available: bookingsInSlot.length < ds.maxBookings,
      });
    }
  }

  // Filter past slots if date is today
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  if (date === todayStr) {
    const currentMins = now.getHours() * 60 + now.getMinutes();
    for (const s of allSlots) {
      if (toMinutes(s.startTime) <= currentMins) s.available = false;
    }
  }

  return { date, slots: allSlots };
}

export async function getAvailableDates(
  tenantId: string,
  managerId: string,
  days?: number
): Promise<{ date: string; dayName: string; slotsAvailable: number; isBlocked: boolean }[]> {
  const avail = await getAvailability(tenantId, managerId);
  const maxDays = days || avail?.maxAdvanceDays || 14;
  const results: { date: string; dayName: string; slotsAvailable: number; isBlocked: boolean }[] = [];

  for (let i = 0; i < maxDays; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);

    if (isSaudiWeekend(d)) continue;

    const blocked = avail?.blockedDates.some(b => b.date === dateStr) ?? false;
    if (blocked) {
      results.push({ date: dateStr, dayName: DAY_NAMES[d.getDay()], slotsAvailable: 0, isBlocked: true });
      continue;
    }

    const { slots } = await getAvailableSlots(tenantId, managerId, dateStr);
    const available = slots.filter(s => s.available).length;
    results.push({ date: dateStr, dayName: DAY_NAMES[d.getDay()], slotsAvailable: available, isBlocked: false });
  }

  return results;
}

// ═══════════════════════════════════════════════════════════════════════════
// LIST MANAGERS WITH AVAILABILITY
// ═══════════════════════════════════════════════════════════════════════════

export async function getBookableManagers(
  tenantId: string
): Promise<{ managerId: string; managerName: string; department: string; nextAvailable: string | null; totalSlotsThisWeek: number }[]> {
  const c = await availCol(tenantId);
  const avails = (await c.find({ tenantId, isActive: true }).toArray()) as unknown as ManagerAvailability[];
  const results: { managerId: string; managerName: string; department: string; nextAvailable: string | null; totalSlotsThisWeek: number }[] = [];

  for (const a of avails) {
    const dates = await getAvailableDates(tenantId, a.managerId, 7);
    const firstOpen = dates.find(d => d.slotsAvailable > 0);
    const total = dates.reduce((s, d) => s + d.slotsAvailable, 0);
    results.push({
      managerId: a.managerId,
      managerName: a.managerName,
      department: a.department,
      nextAvailable: firstOpen?.date || null,
      totalSlotsThisWeek: total,
    });
  }

  return results;
}

// ═══════════════════════════════════════════════════════════════════════════
// APPOINTMENTS
// ═══════════════════════════════════════════════════════════════════════════

export async function bookAppointment(
  tenantId: string,
  data: {
    managerId: string;
    managerName: string;
    employeeId: string;
    employeeName: string;
    department: string;
    date: string;
    startTime: string;
    endTime: string;
    duration: number;
    purpose: AppointmentPurpose;
    notes?: string;
    location?: string;
    isVirtual?: boolean;
    meetingLink?: string;
    requestedBy: string;
  }
): Promise<Appointment> {
  const c = await aptCol(tenantId);
  const now = new Date();

  const avail = await getAvailability(tenantId, data.managerId);
  const autoApprove = avail?.autoApprove ?? true;

  const apt: Appointment = {
    id: uuidv4(),
    tenantId,
    appointmentId: await nextAptId(tenantId),
    managerId: data.managerId,
    managerName: data.managerName,
    employeeId: data.employeeId,
    employeeName: data.employeeName,
    department: data.department,
    date: data.date,
    startTime: data.startTime,
    endTime: data.endTime,
    duration: data.duration,
    purpose: data.purpose,
    purposeLabel: PURPOSE_LABELS[data.purpose] || data.purpose,
    notes: data.notes,
    location: data.location,
    isVirtual: data.isVirtual ?? false,
    meetingLink: data.meetingLink,
    status: autoApprove ? 'CONFIRMED' : 'PENDING',
    requestedBy: data.requestedBy,
    requestedAt: now,
    confirmedAt: autoApprove ? now : undefined,
    createdAt: now,
    updatedAt: now,
  };

  await c.insertOne(apt as unknown as Record<string, unknown>);
  return apt;
}

export async function confirmAppointment(
  tenantId: string,
  appointmentId: string
): Promise<Appointment> {
  const c = await aptCol(tenantId);
  const now = new Date();
  await c.updateOne(
    { tenantId, $or: [{ appointmentId }, { id: appointmentId }] },
    { $set: { status: 'CONFIRMED', confirmedAt: now, updatedAt: now } }
  );
  return (await c.findOne({ tenantId, $or: [{ appointmentId }, { id: appointmentId }] })) as unknown as Appointment;
}

export async function cancelAppointment(
  tenantId: string,
  appointmentId: string,
  cancelledBy: string,
  reason: string
): Promise<Appointment> {
  const c = await aptCol(tenantId);
  const now = new Date();
  await c.updateOne(
    { tenantId, $or: [{ appointmentId }, { id: appointmentId }] },
    { $set: { status: 'CANCELLED', cancelledAt: now, cancelledBy, cancelReason: reason, updatedAt: now } }
  );
  return (await c.findOne({ tenantId, $or: [{ appointmentId }, { id: appointmentId }] })) as unknown as Appointment;
}

export async function rescheduleAppointment(
  tenantId: string,
  appointmentId: string,
  newDate: string,
  newTime: string,
  newEndTime: string
): Promise<Appointment> {
  const c = await aptCol(tenantId);
  const now = new Date();
  await c.updateOne(
    { tenantId, $or: [{ appointmentId }, { id: appointmentId }] },
    {
      $set: {
        date: newDate,
        startTime: newTime,
        endTime: newEndTime,
        status: 'CONFIRMED',
        updatedAt: now,
      },
    }
  );
  return (await c.findOne({ tenantId, $or: [{ appointmentId }, { id: appointmentId }] })) as unknown as Appointment;
}

export async function completeAppointment(
  tenantId: string,
  appointmentId: string,
  meetingNotes: string,
  followUpActions?: string[],
  nextAppointment?: string
): Promise<Appointment> {
  const c = await aptCol(tenantId);
  const now = new Date();
  await c.updateOne(
    { tenantId, $or: [{ appointmentId }, { id: appointmentId }] },
    {
      $set: {
        status: 'COMPLETED',
        completedAt: now,
        meetingNotes,
        followUpActions: followUpActions || [],
        nextAppointment,
        updatedAt: now,
      },
    }
  );
  return (await c.findOne({ tenantId, $or: [{ appointmentId }, { id: appointmentId }] })) as unknown as Appointment;
}

export async function markNoShow(
  tenantId: string,
  appointmentId: string
): Promise<Appointment> {
  const c = await aptCol(tenantId);
  await c.updateOne(
    { tenantId, $or: [{ appointmentId }, { id: appointmentId }] },
    { $set: { status: 'NO_SHOW', updatedAt: new Date() } }
  );
  return (await c.findOne({ tenantId, $or: [{ appointmentId }, { id: appointmentId }] })) as unknown as Appointment;
}

// ─── Queries ────────────────────────────────────────────────────────────────

export async function getAppointmentDetail(
  tenantId: string,
  appointmentId: string
): Promise<Appointment | null> {
  const c = await aptCol(tenantId);
  return (await c.findOne({ tenantId, $or: [{ appointmentId }, { id: appointmentId }] })) as unknown as Appointment | null;
}

export async function getUpcomingAppointments(
  tenantId: string,
  userId: string,
  role: 'MANAGER' | 'EMPLOYEE' | 'BOTH'
): Promise<Appointment[]> {
  const c = await aptCol(tenantId);
  const today = new Date().toISOString().slice(0, 10);

  let query: Record<string, any>;
  if (role === 'MANAGER') {
    query = { tenantId, managerId: userId, date: { $gte: today }, status: { $in: ['PENDING', 'CONFIRMED'] } };
  } else if (role === 'EMPLOYEE') {
    query = { tenantId, employeeId: userId, date: { $gte: today }, status: { $in: ['PENDING', 'CONFIRMED'] } };
  } else {
    query = { tenantId, $or: [{ managerId: userId }, { employeeId: userId }], date: { $gte: today }, status: { $in: ['PENDING', 'CONFIRMED'] } };
  }

  return (await c.find(query).sort({ date: 1, startTime: 1 }).toArray()) as unknown as Appointment[];
}

export async function getPastAppointments(
  tenantId: string,
  userId: string,
  limit = 20
): Promise<Appointment[]> {
  const c = await aptCol(tenantId);
  return (await c.find({
    tenantId,
    $or: [{ managerId: userId }, { employeeId: userId }],
    status: { $in: ['COMPLETED', 'NO_SHOW', 'CANCELLED'] },
  }).sort({ date: -1 }).limit(limit).toArray()) as unknown as Appointment[];
}

export async function getManagerAppointments(
  tenantId: string,
  managerId: string,
  filters?: { status?: string; date?: string }
): Promise<Appointment[]> {
  const c = await aptCol(tenantId);
  const query: Record<string, any> = { tenantId, managerId };
  if (filters?.status) query.status = filters.status;
  if (filters?.date) query.date = filters.date;
  return (await c.find(query).sort({ date: 1, startTime: 1 }).toArray()) as unknown as Appointment[];
}

// ─── Stats ──────────────────────────────────────────────────────────────────

export async function getBookingStats(
  tenantId: string,
  managerId?: string
): Promise<{
  totalThisMonth: number;
  completed: number;
  noShows: number;
  cancelled: number;
  avgDuration: number;
  topPurposes: { purpose: string; count: number }[];
  busiestDay: string;
}> {
  const c = await aptCol(tenantId);
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const query: Record<string, any> = { tenantId, date: { $gte: monthStart } };
  if (managerId) query.managerId = managerId;

  const all = (await c.find(query).toArray()) as unknown as Appointment[];

  const completed = all.filter(a => a.status === 'COMPLETED');
  const noShows = all.filter(a => a.status === 'NO_SHOW');
  const cancelled = all.filter(a => a.status === 'CANCELLED');

  const avgDuration = completed.length > 0
    ? Math.round(completed.reduce((s, a) => s + (a.duration || 30), 0) / completed.length)
    : 30;

  const purposeMap = new Map<string, number>();
  for (const a of all) {
    purposeMap.set(a.purposeLabel || a.purpose, (purposeMap.get(a.purposeLabel || a.purpose) || 0) + 1);
  }
  const topPurposes = [...purposeMap.entries()]
    .map(([purpose, count]) => ({ purpose, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const dayMap = new Map<string, number>();
  for (const a of all) {
    const d = new Date(a.date + 'T00:00:00');
    const name = DAY_NAMES[d.getDay()];
    dayMap.set(name, (dayMap.get(name) || 0) + 1);
  }
  let busiestDay = 'N/A';
  let maxDay = 0;
  for (const [name, cnt] of dayMap) {
    if (cnt > maxDay) { maxDay = cnt; busiestDay = name; }
  }

  return {
    totalThisMonth: all.length,
    completed: completed.length,
    noShows: noShows.length,
    cancelled: cancelled.length,
    avgDuration,
    topPurposes,
    busiestDay,
  };
}
