import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { validateBody } from '@/lib/validation/helpers';
import { createAuditLog } from '@/lib/utils/audit';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const sendReminderSchema = z.object({
  bookingId: z.string().min(1, 'bookingId is required'),
  channel: z.enum(['SMS', 'EMAIL', 'PUSH']).default('SMS'),
  message: z.string().optional(),
  messageAr: z.string().optional(),
});

const bulkReminderSchema = z.object({
  date: z.string().min(1, 'date is required'),
  hoursBeforeAppointment: z.number().min(1).max(72).default(24),
  channel: z.enum(['SMS', 'EMAIL', 'PUSH']).default('SMS'),
});

/**
 * POST /api/scheduling/reminders
 * Send reminder for an upcoming appointment.
 * Supports single booking reminder or bulk reminders for a date.
 */
export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }) => {
    const body = await req.json().catch(() => ({}));

    // Check if this is a bulk reminder request
    if (body.date && !body.bookingId) {
      const bv = validateBody(body, bulkReminderSchema);
      if ('error' in bv) return bv.error;
      const { date, hoursBeforeAppointment, channel } = bv.data;

      // Find all active bookings for the given date
      const bookings = await prisma.opdBooking.findMany({
        where: {
          tenantId,
          date,
          status: 'ACTIVE',
          reminderSentAt: null,
        },
        take: 200,
      });

      if (bookings.length === 0) {
        return NextResponse.json({
          success: true,
          message: 'No pending reminders for this date',
          messageAr: 'لا توجد تذكيرات معلقة لهذا التاريخ',
          sent: 0,
        });
      }

      const results: Array<{ bookingId: string; status: string; error?: string }> = [];

      for (const booking of bookings) {
        try {
          if (!booking.patientMasterId) {
            results.push({ bookingId: booking.id, status: 'SKIPPED', error: 'No patient linked' });
            continue;
          }

          // Mark reminder as queued
          await prisma.opdBooking.update({
            where: { id: booking.id },
            data: { reminderSentAt: new Date() },
          });

          results.push({ bookingId: booking.id, status: 'QUEUED' });
        } catch (err) {
          logger.warn('Failed to queue reminder', {
            category: 'api',
            tenantId,
            bookingId: booking.id,
            error: err instanceof Error ? err.message : 'Unknown error',
          });
          results.push({ bookingId: booking.id, status: 'FAILED', error: 'Queue failed' });
        }
      }

      await createAuditLog(
        'scheduling_reminder',
        date,
        'BULK_REMINDERS_SENT',
        userId || 'system',
        user?.email,
        { date, channel, total: bookings.length, queued: results.filter((r) => r.status === 'QUEUED').length },
        tenantId
      );

      return NextResponse.json({
        success: true,
        date,
        channel,
        total: bookings.length,
        results,
      });
    }

    // Single booking reminder
    const v = validateBody(body, sendReminderSchema);
    if ('error' in v) return v.error;
    const { bookingId, channel, message, messageAr } = v.data;

    const booking = await prisma.opdBooking.findFirst({
      where: { tenantId, id: bookingId },
    });
    if (!booking) {
      return NextResponse.json(
        { error: 'Booking not found', errorAr: 'الحجز غير موجود' },
        { status: 404 }
      );
    }
    if (booking.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'Booking is not active', errorAr: 'الحجز غير نشط' },
        { status: 409 }
      );
    }
    if (!booking.patientMasterId) {
      return NextResponse.json(
        { error: 'No patient linked to this booking', errorAr: 'لا يوجد مريض مرتبط بهذا الحجز' },
        { status: 400 }
      );
    }

    // Fetch patient for contact info
    const patient = await prisma.patientMaster.findFirst({
      where: { tenantId, id: booking.patientMasterId },
    });
    if (!patient) {
      return NextResponse.json(
        { error: 'Patient not found', errorAr: 'المريض غير موجود' },
        { status: 404 }
      );
    }

    // Fetch doctor/resource name
    let doctorName = '';
    if (booking.resourceId) {
      try {
        const resource = await prisma.schedulingResource.findFirst({
          where: { tenantId, id: booking.resourceId },
        });
        doctorName = String(resource?.displayName || '').trim();
      } catch { /* best effort */ }
    }

    // Fetch clinic name
    let clinicName = '';
    if (booking.clinicId) {
      try {
        const clinic = await prisma.clinicalInfraClinic.findFirst({
          where: { tenantId, id: booking.clinicId },
        });
        clinicName = String(clinic?.name || '').trim();
      } catch { /* best effort */ }
    }

    const startAt = booking.startAt ? new Date(booking.startAt) : null;
    const dateStr = startAt
      ? startAt.toLocaleDateString('en-GB', { timeZone: 'Asia/Riyadh' })
      : booking.date || '';
    const timeStr = startAt
      ? startAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Riyadh' })
      : '';

    // Mark reminder as sent
    await prisma.opdBooking.update({
      where: { id: bookingId },
      data: { reminderSentAt: new Date() },
    });

    await createAuditLog(
      'scheduling_reminder',
      bookingId,
      'REMINDER_SENT',
      userId || 'system',
      user?.email,
      { bookingId, channel, patientId: patient.id, date: dateStr, time: timeStr },
      tenantId
    );

    logger.info('Appointment reminder sent', {
      category: 'api',
      tenantId,
      userId,
      route: '/api/scheduling/reminders',
      bookingId,
      channel,
    });

    return NextResponse.json({
      success: true,
      bookingId,
      channel,
      appointment: {
        date: dateStr,
        time: timeStr,
        doctor: doctorName,
        clinic: clinicName,
      },
    });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'opd.booking.create' }
);

/**
 * GET /api/scheduling/reminders?date=YYYY-MM-DD
 * List pending reminders (bookings without reminderSentAt for a given date).
 */
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const { searchParams } = new URL(req.url);
    const date = String(searchParams.get('date') || '').trim();
    if (!date) {
      return NextResponse.json(
        { error: 'date parameter is required (YYYY-MM-DD)', errorAr: 'معامل التاريخ مطلوب' },
        { status: 400 }
      );
    }

    const status = String(searchParams.get('status') || 'pending').trim().toLowerCase();

    const where: any = {
      tenantId,
      date,
      status: 'ACTIVE',
      patientMasterId: { not: null },
    };

    if (status === 'pending') {
      where.reminderSentAt = null;
    } else if (status === 'sent') {
      where.reminderSentAt = { not: null };
    }
    // 'all' = no filter on reminderSentAt

    const bookings = await prisma.opdBooking.findMany({
      where,
      orderBy: { startAt: 'asc' },
      take: 200,
    });

    // Fetch patient names
    const patientIds = Array.from(
      new Set(bookings.map((b) => String(b.patientMasterId || '')).filter(Boolean))
    );
    const patients = patientIds.length
      ? await prisma.patientMaster.findMany({
          where: { tenantId, id: { in: patientIds } },
          select: { id: true, fullName: true, firstName: true, lastName: true, mrn: true },
        })
      : [];
    const patientById = patients.reduce<Record<string, (typeof patients)[0]>>((acc, p) => {
      acc[p.id] = p;
      return acc;
    }, {});

    const items = bookings.map((b) => {
      const patient = patientById[String(b.patientMasterId || '')] || null;
      return {
        bookingId: b.id,
        date: b.date,
        startAt: b.startAt,
        clinicId: b.clinicId,
        reminderSentAt: b.reminderSentAt,
        patient: patient
          ? {
              id: patient.id,
              fullName: patient.fullName || `${patient.firstName || ''} ${patient.lastName || ''}`.trim(),
              mrn: patient.mrn || null,
            }
          : null,
      };
    });

    return NextResponse.json({
      date,
      status,
      total: items.length,
      items,
    });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'opd.booking.view' }
);
