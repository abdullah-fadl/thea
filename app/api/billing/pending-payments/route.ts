import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { canAccessBilling } from '@/lib/billing/access';
import { withErrorHandler } from '@/lib/core/errors';

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user, role }) => {
  if (!canAccessBilling({ email: user?.email, tenantId, role })) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Find bookings for today that need payment
  // Note: The complex $or + nested conditions from MongoDB are simplified for Prisma
  const bookings = await prisma.opdBooking.findMany({
    where: {
      tenantId,
      bookingType: 'PATIENT',
      startAt: { gte: today, lt: tomorrow },
      status: { in: ['ACTIVE', 'PENDING_PAYMENT'] },
    },
    orderBy: [{ startAt: 'asc' }],
    take: 200,
  });

  // Filter in application for payment condition (payment not exists or payment.status !== 'PAID')
  const filteredBookings = bookings.filter((b) => {
    if (!b.payment) return true;
    return (b.payment as Record<string, unknown>)?.status !== 'PAID';
  });

  const patientIds = Array.from(
    new Set(filteredBookings.map((b) => String(b.patientMasterId || '')).filter(Boolean))
  );
  const patients = patientIds.length
    ? await prisma.patientMaster.findMany({
        where: { tenantId, id: { in: patientIds } },
      })
    : [];
  const patientMap = new Map(patients.map((p) => [String(p.id || ''), p]));

  const resourceIds = Array.from(
    new Set(filteredBookings.map((b) => String(b.resourceId || '')).filter(Boolean))
  );
  const resources = resourceIds.length
    ? await prisma.schedulingResource.findMany({
        where: { tenantId, id: { in: resourceIds } },
      })
    : [];
  const resourceMap = new Map(resources.map((r) => [String(r.id || ''), r]));

  const items = filteredBookings.map((b) => {
    const patient = patientMap.get(String(b.patientMasterId || ''));
    const resource = resourceMap.get(String(b.resourceId || ''));
    const isFirstVisit = Boolean(b.isFirstVisit);
    const identifiers = patient?.identifiers as Record<string, unknown> | null;
    return {
      id: b.id,
      patientId: b.patientMasterId,
      patientName: patient?.fullName || 'Unknown',
      mrn: patient?.mrn || null,
      nationalId: patient?.nationalId || identifiers?.nationalId || null,
      phone: patient?.mobile || null,
      insurancePolicyNumber: identifiers?.insurancePolicyNumber || null,
      insuranceCompanyId: identifiers?.insuranceCompanyId || null,
      insuranceCompanyName: patient?.insuranceCompanyName || null,
      providerId: b.resourceId,
      providerName: resource?.displayName || b.resourceId,
      specialtyCode: b.specialtyCode,
      appointmentTime: b.startAt ? new Date(b.startAt).toLocaleTimeString('ar-SA', {
        hour: '2-digit',
        minute: '2-digit',
      }) : null,
      visitId: null,
      encounterId: b.encounterCoreId,
      serviceType: isFirstVisit ? 'NEW' : 'FOLLOW_UP',
      isFirstVisit,
    };
  });

  return NextResponse.json({ items });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'billing.view' }
);
