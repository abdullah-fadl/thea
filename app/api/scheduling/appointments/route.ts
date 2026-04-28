import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { withErrorHandler } from '@/lib/core/errors';

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
  const params = req.nextUrl.searchParams;
  const startDate = params.get('startDate');
  const endDate = params.get('endDate');
  const patientId = params.get('patientId');
  const resourceId = params.get('resourceId');
  const status = params.get('status');

  // scheduling_reservations has slotId, not startAt. Get slots in range first, then reservations for those slots.
  const slotsWhere: any = { tenantId };
  if (resourceId) slotsWhere.resourceId = resourceId;
  if (startDate && endDate) {
    if (startDate === endDate) {
      slotsWhere.date = startDate;
    } else {
      const dayStart = new Date(startDate + 'T00:00:00.000Z');
      const dayEnd = new Date(endDate + 'T00:00:00.000Z');
      dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
      slotsWhere.startAt = { gte: dayStart, lt: dayEnd };
    }
  }
  const slots = await prisma.schedulingSlot.findMany({
    where: slotsWhere,
    select: { id: true, startAt: true, endAt: true, resourceId: true },
    take: 500,
  });
  const slotIds = slots.map((s) => s.id);
  const slotMap = new Map(slots.map((s) => [s.id, s]));

  if (slotIds.length === 0) return NextResponse.json({ items: [] });

  const resWhere: any = { tenantId, slotId: { in: slotIds } };
  if (resourceId) resWhere.resourceId = resourceId;
  if (status) resWhere.status = status;
  if (patientId) {
    resWhere.subjectType = 'PATIENT_MASTER';
    resWhere.subjectId = patientId;
  }
  const reservations = await prisma.schedulingReservation.findMany({
    where: resWhere,
    take: 200,
  });

  const appointments = reservations
    .map((r) => {
      const slot = slotMap.get(r.slotId);
      if (!slot) return null;
      return { ...r, startAt: slot.startAt, endAt: slot.endAt };
    })
    .filter(Boolean)
    .sort((a: any, b: any) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

  const patientIds = [
    ...new Set(
      appointments
        .map((a: any) => (a.subjectType === 'PATIENT_MASTER' ? a.subjectId : a.patientId))
        .filter(Boolean)
    ),
  ];
  const resourceIds = [...new Set(appointments.map((a: any) => a.resourceId).filter(Boolean))];

  const [patients, resources] = await Promise.all([
    patientIds.length
      ? prisma.patientMaster.findMany({ where: { id: { in: patientIds } } })
      : Promise.resolve([]),
    resourceIds.length
      ? prisma.schedulingResource.findMany({ where: { id: { in: resourceIds } } })
      : Promise.resolve([]),
  ]);

  const patientMap = new Map(patients.map((p) => [p.id, p]));
  const resourceMap = new Map(resources.map((r) => [r.id, r]));

  const items = appointments.map((apt: any) => {
    const pid = apt.subjectType === 'PATIENT_MASTER' ? apt.subjectId : apt.patientId;
    const resource = resourceMap.get(apt.resourceId);
    const patient = patientMap.get(pid);
    return {
      ...apt,
      patientId: pid,
      patientName: patient?.fullName || pid,
      patientPhone: patient?.mobile,
      resourceName: resource?.displayName || resource?.nameEn || apt.resourceId,
      resourceId: apt.resourceId,
      specialtyCode: resource?.specialtyCode || apt.specialtyCode || null,
      clinicId: resource?.clinicId || apt.clinicId || null,
      slotStart: apt.startAt,
      slotEnd: apt.endAt,
    };
  });

  return NextResponse.json({ items });
}),
  { tenantScoped: true, permissionKey: 'scheduling.view' }
);
