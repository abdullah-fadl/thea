import { prisma } from '@/lib/db/prisma';
import { sendAppointmentReminder } from './smsService';

export async function runSmsReminders() {
  // Get all active tenants
  const tenants = await prisma.tenant.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, tenantId: true },
  });

  const now = new Date();
  const startWindow = new Date(now.getTime() + 23.5 * 60 * 60 * 1000);
  const endWindow = new Date(now.getTime() + 24.5 * 60 * 60 * 1000);

  let scanned = 0;
  let sent = 0;
  const errors: string[] = [];

  for (const tenant of tenants) {
    const tenantUuid = tenant.id;

    // Find active bookings in the reminder window that haven't been reminded
    // Using the Prisma OpdBooking model (from opd.prisma)
    const bookings = await prisma.opdBooking.findMany({
      where: {
        tenantId: tenantUuid,
        bookingType: 'PATIENT',
        status: 'ACTIVE',
        startAt: { gte: startWindow, lte: endWindow },
        reminderSentAt: null as any,
      } as any,
    });

    scanned += bookings.length;

    for (const booking of bookings) {
      try {
        // Look up the patient with mobile number
        const patient = booking.patientMasterId
          ? await prisma.patientMaster.findFirst({
              where: { tenantId: tenantUuid, id: booking.patientMasterId },
              select: { id: true, fullName: true, mobile: true },
            })
          : null;

        const mobile = patient?.mobile || null;
        if (!mobile) {
          continue;
        }

        const smsResult = await sendAppointmentReminder(
          mobile,
          patient?.fullName || 'Patient',
          (booking as any).providerName || 'Doctor',
          new Date(booking.startAt!).toLocaleString('en-SA'),
          (booking as any).clinicName || 'Clinic'
        );

        if (smsResult.success) {
          await prisma.opdBooking.update({
            where: { id: booking.id },
            data: { reminderSentAt: new Date() } as any,
          });
          sent += 1;
        } else {
          errors.push(`Failed to send to ${mobile}: ${smsResult.error}`);
        }
      } catch (error: any) {
        errors.push(String(error?.message || error));
      }
    }
  }

  return { scanned, sent, errors };
}
