import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { sendSMS } from '@/lib/notifications/smsService';
import { decryptField } from '@/lib/security/fieldEncryption';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }, params) => {
    const bookingId = String((params as { bookingId?: string } | undefined)?.bookingId || '').trim();
    if (!bookingId) {
      return NextResponse.json({ error: 'bookingId is required' }, { status: 400 });
    }

    const booking = await prisma.opdBooking.findFirst({
      where: { tenantId, id: bookingId },
    });
    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }
    if (booking.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Booking is not active' }, { status: 409 });
    }
    if (!booking.patientMasterId) {
      return NextResponse.json({ error: 'No patient linked to this booking' }, { status: 400 });
    }

    const patient = await prisma.patientMaster.findFirst({
      where: { tenantId, id: booking.patientMasterId },
    });
    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
    }

    const mobile = decryptField(patient.mobile);
    if (!mobile) {
      return NextResponse.json({ error: 'Patient has no mobile number' }, { status: 400 });
    }

    let doctorName = '';
    try {
      const resource = await prisma.schedulingResource.findFirst({
        where: { tenantId, id: booking.resourceId },
      });
      doctorName = String(resource?.displayName || '').trim();
    } catch { /* best effort */ }

    let clinicName = '';
    try {
      const clinic = await prisma.clinicalInfraClinic.findFirst({
        where: { tenantId, id: booking.clinicId },
      });
      clinicName = String(clinic?.name || '').trim();
    } catch { /* best effort */ }

    const startAt = booking.startAt ? new Date(booking.startAt) : null;
    const dateStr = startAt ? startAt.toLocaleDateString('en-GB', { timeZone: 'Asia/Riyadh' }) : booking.date || '';
    const timeStr = startAt ? startAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Riyadh' }) : '';

    // Trial account: MSEGAT only allows OTP-format messages on free accounts.
    // Format: "رمز التحقق: XXXX" using a 4-digit code derived from the booking date/time.
    const confirmCode = startAt
      ? String(startAt.getHours()).padStart(2, '0') + String(startAt.getMinutes()).padStart(2, '0')
      : String(Math.floor(1000 + Math.random() * 9000));
    const message = `رمز التحقق: ${confirmCode}`;

    const result = await sendSMS(mobile, message);
    if (!result.success) {
      logger.error('SMS confirmation failed', { category: 'opd', bookingId, error: result.error });
      return NextResponse.json({ error: result.error || 'SMS send failed' }, { status: 500 });
    }

    logger.info('Appointment confirmation SMS sent', { category: 'opd', bookingId, to: mobile });
    return NextResponse.json({ success: true, messageId: result.messageId });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'opd.booking.create' }
);
