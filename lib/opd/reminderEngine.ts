// =============================================================================
// Appointment Reminder Engine — NEW FILE (no existing code modified)
// =============================================================================
// Generates and manages appointment reminders.
// Called by: API route (cron/manual trigger), NOT a background process.

import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import {
  renderTemplate,
  formatDate,
  formatTime,
  type ReminderVars,
} from './reminderTemplates';

/** OpdBooking may carry denormalized snapshot fields at runtime */
interface BookingRecord {
  id: string;
  patientId: string | null;
  patientName?: string | null;
  doctorName?: string | null;
  clinicName?: string | null;
  department?: string | null;
  time?: string | null;
  slotStart?: string | null;
  [key: string]: unknown;
}

interface GenerateRemindersResult {
  created: number;
  skipped: number;
  errors: string[];
}

/**
 * Generate reminders for upcoming appointments.
 * Safe to call multiple times — idempotent (checks for existing reminders).
 */
export async function generateReminders(
  prisma: PrismaClient,
  tenantId: string,
): Promise<GenerateRemindersResult> {
  const result: GenerateRemindersResult = { created: 0, skipped: 0, errors: [] };

  // 1. Check if reminders are enabled
  const settings = await prisma.reminderSettings.findUnique({
    where: { tenantId },
  });

  if (!settings?.enabled) {
    return { ...result, errors: ['Reminders not enabled'] };
  }

  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowDate = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;

  // 2. Find bookings for tomorrow that don't have reminders yet
  const bookings = await prisma.opdBooking.findMany({
    where: {
      tenantId,
      date: tomorrowDate,
      status: { in: ['booked', 'confirmed'] },
    },
    take: 500,
  });

  for (const booking of bookings as unknown as BookingRecord[]) {
    try {
      // Check if reminder already exists
      const existing = await prisma.appointmentReminder.findFirst({
        where: {
          tenantId,
          bookingId: booking.id,
          reminderType: 'BEFORE_24H',
        },
      });

      if (existing) {
        result.skipped++;
        continue;
      }

      // Get patient info
      const patient = booking.patientId
        ? await prisma.patientMaster.findUnique({
            where: { id: booking.patientId },
            select: { fullName: true, mobile: true, email: true },
          })
        : null;

      const responseToken = crypto.randomBytes(16).toString('hex');

      // Determine channels
      const channels: string[] = [];
      if (settings.portalEnabled) channels.push('PORTAL');
      if (settings.pushEnabled) channels.push('PUSH');
      if (settings.smsEnabled && patient?.mobile) channels.push('SMS');
      if (settings.emailEnabled && patient?.email) channels.push('EMAIL');

      if (channels.length === 0) channels.push('PORTAL');

      const vars: ReminderVars = {
        patientName: booking.patientName ?? patient?.fullName ?? 'Patient',
        doctorName: booking.doctorName ?? 'Doctor',
        clinicName: booking.clinicName ?? booking.department ?? '',
        appointmentDate: formatDate(new Date(tomorrowDate), 'en'),
        appointmentDateAr: formatDate(new Date(tomorrowDate), 'ar'),
        appointmentTime: booking.time ?? booking.slotStart ?? '08:00',
      };

      // Create one reminder per channel
      for (const channel of channels) {
        const templateKey = channel === 'SMS'
          ? 'SMS_BEFORE_24H_EN'
          : 'PUSH_BEFORE_24H_EN';

        const messageContent = renderTemplate(templateKey, vars);
        const messageContentAr = renderTemplate(
          channel === 'SMS' ? 'SMS_BEFORE_24H_AR' : 'PUSH_BEFORE_24H_AR',
          vars,
        );

        // Schedule: send at 18:00 the day before (or respect quiet hours)
        const scheduledAt = new Date(now);
        scheduledAt.setHours(18, 0, 0, 0);
        if (scheduledAt < now) {
          scheduledAt.setDate(scheduledAt.getDate() + 1);
        }

        await prisma.appointmentReminder.create({
          data: {
            tenantId,
            bookingId: booking.id,
            patientMasterId: booking.patientId ?? '',
            patientName: booking.patientName ?? patient?.fullName,
            patientMobile: patient?.mobile,
            patientEmail: patient?.email,
            doctorName: booking.doctorName,
            clinicName: booking.clinicName ?? booking.department,
            appointmentDate: tomorrowDate,
            appointmentTime: vars.appointmentTime,
            channel,
            reminderType: 'BEFORE_24H',
            scheduledAt,
            messageTemplate: templateKey,
            messageContent,
            messageContentAr,
            status: 'SCHEDULED',
            responseToken: `${responseToken}-${channel.toLowerCase()}`,
          },
        });
        result.created++;
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      result.errors.push(`Booking ${booking.id}: ${msg}`);
    }
  }

  return result;
}

/**
 * Process scheduled reminders that are due.
 * In production, this would call SMS/Email providers.
 * For now, it marks them as SENT and creates portal notifications.
 */
export async function processReminders(
  prisma: PrismaClient,
  tenantId: string,
): Promise<{ sent: number; failed: number }> {
  const now = new Date();

  const dueReminders = await prisma.appointmentReminder.findMany({
    where: {
      tenantId,
      status: 'SCHEDULED',
      scheduledAt: { lte: now },
    },
    take: 100,
  });

  let sent = 0;
  let failed = 0;

  for (const reminder of dueReminders) {
    try {
      if (reminder.channel === 'PORTAL' || reminder.channel === 'PUSH') {
        // Create in-app notification
        await prisma.notification.create({
          data: {
            tenantId,
            recipientType: 'patient',
            type: 'in-app',
            kind: 'REMINDER',
            severity: 'INFO',
            scope: 'OPD',
            title: `تذكير بموعد / Appointment Reminder`,
            body: reminder.messageContent,
            message: reminder.messageContentAr,
            metadata: {
              bookingId: reminder.bookingId,
              appointmentDate: reminder.appointmentDate,
              appointmentTime: reminder.appointmentTime,
              responseToken: reminder.responseToken,
            },
            status: 'OPEN',
          },
        });
      }

      // For SMS/Email, in production you'd call the provider here.
      // For now, just mark as SENT.

      await prisma.appointmentReminder.update({
        where: { id: reminder.id },
        data: {
          status: 'SENT',
          sentAt: now,
        },
      });
      sent++;
    } catch {
      await prisma.appointmentReminder.update({
        where: { id: reminder.id },
        data: {
          status: 'FAILED',
          failReason: 'Processing error',
          retryCount: { increment: 1 },
        },
      });
      failed++;
    }
  }

  return { sent, failed };
}

/**
 * Handle patient response (confirm/cancel via token)
 */
export async function handlePatientResponse(
  prisma: PrismaClient,
  token: string,
  response: 'CONFIRMED' | 'CANCELLED',
): Promise<{ success: boolean; bookingId?: string }> {
  const reminder = await prisma.appointmentReminder.findFirst({
    where: { responseToken: token },
  });

  if (!reminder) return { success: false };

  await prisma.appointmentReminder.update({
    where: { id: reminder.id },
    data: {
      responseType: response,
      respondedAt: new Date(),
    },
  });

  // If cancelled, update the booking status
  if (response === 'CANCELLED') {
    await prisma.opdBooking.update({
      where: { id: reminder.bookingId },
      data: { status: 'cancelled' },
    }).catch(() => {});
  }

  return { success: true, bookingId: reminder.bookingId };
}

/**
 * Get reminder stats for dashboard
 */
export async function getReminderStats(
  prisma: PrismaClient,
  tenantId: string,
  dateFrom?: Date,
  dateTo?: Date,
) {
  const dateFilter: Record<string, Date> = {};
  if (dateFrom) dateFilter.gte = dateFrom;
  if (dateTo) dateFilter.lte = dateTo;

  const where = {
    tenantId,
    ...(dateFrom || dateTo ? { appointmentDate: dateFilter } : {}),
  };

  const [total, sent, confirmed, cancelled, noResponse] = await Promise.all([
    prisma.appointmentReminder.count({ where }),
    prisma.appointmentReminder.count({ where: { ...where, status: 'SENT' } }),
    prisma.appointmentReminder.count({ where: { ...where, responseType: 'CONFIRMED' } }),
    prisma.appointmentReminder.count({ where: { ...where, responseType: 'CANCELLED' } }),
    prisma.appointmentReminder.count({
      where: { ...where, status: 'SENT', responseType: null },
    }),
  ]);

  return {
    total,
    sent,
    confirmed,
    cancelled,
    noResponse,
    confirmRate: sent > 0 ? Math.round((confirmed / sent) * 100) : 0,
    cancelRate: sent > 0 ? Math.round((cancelled / sent) * 100) : 0,
  };
}
