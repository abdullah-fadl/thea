/**
 * Manager Appointment Booking API
 *
 * GET actions:
 *   available-slots       — Time slots for a manager on a specific date
 *   available-dates       — Dates with slot counts for next X days
 *   bookable-managers     — Managers with availability set up
 *   my-appointments       — Current user's upcoming appointments
 *   past-appointments     — Current user's past appointments
 *   manager-appointments  — All appointments for a specific manager
 *   appointment-detail    — Single appointment by ID
 *   stats                 — Booking statistics
 *   availability          — Manager's availability config
 *
 * POST actions:
 *   book                  — Book new appointment
 *   confirm               — Confirm a pending appointment
 *   cancel                — Cancel an appointment
 *   reschedule            — Reschedule an appointment
 *   complete              — Mark completed with notes
 *   no-show               — Mark as no-show
 *   set-availability      — Manager sets weekly slots & settings
 *   block-date            — Manager blocks a date
 *   unblock-date          — Manager unblocks a date
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import {
  getAvailableSlots,
  getAvailableDates,
  getBookableManagers,
  bookAppointment,
  confirmAppointment,
  cancelAppointment,
  rescheduleAppointment,
  completeAppointment,
  markNoShow,
  setAvailability,
  getAvailability,
  blockDate,
  unblockDate,
  getUpcomingAppointments,
  getPastAppointments,
  getManagerAppointments,
  getAppointmentDetail,
  getBookingStats,
} from '@/lib/cvision/booking/booking-engine';

// ─── GET ────────────────────────────────────────────────────────────────────

async function handleGet(req: NextRequest, { tenantId, userId }: { tenantId: string; userId: string }) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action') || 'my-appointments';

  switch (action) {
    case 'available-slots': {
      const managerId = searchParams.get('managerId');
      const date = searchParams.get('date');
      if (!managerId || !date) return NextResponse.json({ success: false, error: 'managerId and date required' }, { status: 400 });
      const data = await getAvailableSlots(tenantId, managerId, date);
      return NextResponse.json({ success: true, data });
    }

    case 'available-dates': {
      const managerId = searchParams.get('managerId');
      if (!managerId) return NextResponse.json({ success: false, error: 'managerId required' }, { status: 400 });
      const days = searchParams.get('days') ? parseInt(searchParams.get('days')!) : undefined;
      const data = await getAvailableDates(tenantId, managerId, days);
      return NextResponse.json({ success: true, data });
    }

    case 'bookable-managers': {
      const data = await getBookableManagers(tenantId);
      return NextResponse.json({ success: true, data });
    }

    case 'my-appointments': {
      const data = await getUpcomingAppointments(tenantId, userId, 'BOTH');
      return NextResponse.json({ success: true, data });
    }

    case 'past-appointments': {
      const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 20;
      const data = await getPastAppointments(tenantId, userId, limit);
      return NextResponse.json({ success: true, data });
    }

    case 'manager-appointments': {
      const managerId = searchParams.get('managerId') || userId;
      const status = searchParams.get('status') || undefined;
      const date = searchParams.get('date') || undefined;
      const data = await getManagerAppointments(tenantId, managerId, { status, date });
      return NextResponse.json({ success: true, data });
    }

    case 'appointment-detail': {
      const id = searchParams.get('id');
      if (!id) return NextResponse.json({ success: false, error: 'id required' }, { status: 400 });
      const data = await getAppointmentDetail(tenantId, id);
      if (!data) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
      return NextResponse.json({ success: true, data });
    }

    case 'stats': {
      const managerId = searchParams.get('managerId') || undefined;
      const data = await getBookingStats(tenantId, managerId);
      return NextResponse.json({ success: true, data });
    }

    case 'availability': {
      const managerId = searchParams.get('managerId') || userId;
      const data = await getAvailability(tenantId, managerId);
      return NextResponse.json({ success: true, data });
    }

    default:
      return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
  }
}

// ─── POST ───────────────────────────────────────────────────────────────────

async function handlePost(req: NextRequest, { tenantId, userId }: { tenantId: string; userId: string }) {
  const body = await req.json();
  const action = body.action as string;

  switch (action) {
    case 'book': {
      const required = ['managerId', 'managerName', 'employeeId', 'employeeName', 'date', 'startTime', 'endTime', 'purpose'];
      for (const key of required) {
        if (!body[key]) return NextResponse.json({ success: false, error: `${key} is required` }, { status: 400 });
      }
      const data = await bookAppointment(tenantId, {
        managerId: body.managerId,
        managerName: body.managerName,
        employeeId: body.employeeId,
        employeeName: body.employeeName,
        department: body.department || '',
        date: body.date,
        startTime: body.startTime,
        endTime: body.endTime,
        duration: body.duration || 30,
        purpose: body.purpose,
        notes: body.notes,
        location: body.location,
        isVirtual: body.isVirtual ?? false,
        meetingLink: body.meetingLink,
        requestedBy: userId,
      });
      return NextResponse.json({ success: true, data });
    }

    case 'confirm': {
      if (!body.appointmentId) return NextResponse.json({ success: false, error: 'appointmentId required' }, { status: 400 });
      const data = await confirmAppointment(tenantId, body.appointmentId);
      return NextResponse.json({ success: true, data });
    }

    case 'cancel': {
      if (!body.appointmentId) return NextResponse.json({ success: false, error: 'appointmentId required' }, { status: 400 });
      const data = await cancelAppointment(tenantId, body.appointmentId, userId, body.reason || 'No reason provided');
      return NextResponse.json({ success: true, data });
    }

    case 'reschedule': {
      if (!body.appointmentId || !body.newDate || !body.newTime || !body.newEndTime) {
        return NextResponse.json({ success: false, error: 'appointmentId, newDate, newTime, newEndTime required' }, { status: 400 });
      }
      const data = await rescheduleAppointment(tenantId, body.appointmentId, body.newDate, body.newTime, body.newEndTime);
      return NextResponse.json({ success: true, data });
    }

    case 'complete': {
      if (!body.appointmentId) return NextResponse.json({ success: false, error: 'appointmentId required' }, { status: 400 });
      const data = await completeAppointment(
        tenantId, body.appointmentId,
        body.meetingNotes || '',
        body.followUpActions,
        body.nextAppointment
      );
      return NextResponse.json({ success: true, data });
    }

    case 'no-show': {
      if (!body.appointmentId) return NextResponse.json({ success: false, error: 'appointmentId required' }, { status: 400 });
      const data = await markNoShow(tenantId, body.appointmentId);
      return NextResponse.json({ success: true, data });
    }

    case 'set-availability': {
      const data = await setAvailability(tenantId, userId, {
        managerName: body.managerName,
        department: body.department,
        weeklySlots: body.weeklySlots,
        blockedDates: body.blockedDates,
        autoApprove: body.autoApprove,
        bufferMinutes: body.bufferMinutes,
        maxAdvanceDays: body.maxAdvanceDays,
      });
      return NextResponse.json({ success: true, data });
    }

    case 'block-date': {
      if (!body.date) return NextResponse.json({ success: false, error: 'date required' }, { status: 400 });
      await blockDate(tenantId, userId, body.date, body.reason);
      return NextResponse.json({ success: true });
    }

    case 'unblock-date': {
      if (!body.date) return NextResponse.json({ success: false, error: 'date required' }, { status: 400 });
      await unblockDate(tenantId, userId, body.date);
      return NextResponse.json({ success: true });
    }

    default:
      return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
  }
}

// ─── Exports ────────────────────────────────────────────────────────────────

export const GET = withAuthTenant(handleGet);
export const POST = withAuthTenant(handlePost);
