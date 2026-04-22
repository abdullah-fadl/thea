import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { tenantWhere } from '@/lib/db/tenantLookup';
import { hashPassword } from '@/lib/auth';
import { getDefaultPermissionsForRole } from '@/lib/permissions';
import { validateBody } from '@/lib/validation/helpers';
import { logger } from '@/lib/monitoring/logger';
import { createAuditLog } from '@/lib/utils/audit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const doctorSchema = z.object({
  displayName: z.string().min(1),
  email: z.string().email(),
  staffId: z.string().min(1),
  licenseNumber: z.string().min(1),
  nationalId: z.string().optional().default(''),
  mobile: z.string().optional().default(''),
  specialties: z.array(z.string()).optional().default([]),
  consultationServiceCode: z.string().optional().default(''),
  level: z.enum(['CONSULTANT', 'SPECIALIST', 'RESIDENT']).optional().default('CONSULTANT'),
  employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONSULTANT']).default('FULL_TIME'),
  primaryUnit: z.string().min(1),
  clinics: z.array(z.string()).min(1),
  roomIds: z.array(z.string()).optional().default([]),
  canPrescribe: z.boolean().default(true),
  canRequestImaging: z.boolean().default(true),
  canPerformProcedures: z.boolean().default(false),
  workingDays: z.array(z.number().int().min(0).max(6)).min(1),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  appointmentDuration: z.number().int().min(5),
  breakStart: z.string().optional().default(''),
  breakEnd: z.string().optional().default(''),
  password: z.string().min(12),
  role: z.string().min(1).default('opd-doctor'),
  sendWelcomeEmail: z.boolean().default(true),
});

function zeroPad(value: number, length: number) {
  return String(value).padStart(length, '0');
}

function dateRange(from: Date, days: number) {
  const list: Date[] = [];
  for (let i = 0; i < days; i += 1) {
    const d = new Date(from);
    d.setDate(from.getDate() + i);
    list.push(d);
  }
  return list;
}

function timeToMinutes(time: string) {
  const [h, m] = time.split(':').map((n) => Number(n));
  return h * 60 + m;
}

function buildISO(date: Date, minutes: number) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
  d.setUTCMinutes(minutes);
  return d.toISOString();
}

export const POST = withAuthTenant(async (req: NextRequest, { tenantId, userId }) => {
  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const v = validateBody(body, doctorSchema);
  if ('error' in v) return v.error;
  const data = v.data;
  if ((data.breakStart && !data.breakEnd) || (!data.breakStart && data.breakEnd)) {
    return NextResponse.json({ error: 'Break start and end must be provided together.' }, { status: 400 });
  }

  // Resolve tenant UUID
  const tenant = await prisma.tenant.findFirst({
    where: tenantWhere(tenantId),
    select: { id: true, status: true },
  });
  if (!tenant || tenant.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'Tenant not found or inactive' }, { status: 404 });
  }

  try {
    // Use Prisma interactive transaction for atomicity
    const result = await prisma.$transaction(async (tx) => {
      // Check for existing user with this email
      const existingUser = await tx.user.findFirst({
        where: { tenantId: tenant.id, email: data.email.toLowerCase() },
      });
      if (existingUser) {
        throw new Error('User with this email already exists');
      }

      // Check for existing user with this staffId
      const existingStaffUser = await tx.user.findFirst({
        where: { tenantId: tenant.id, staffId: data.staffId },
      });
      if (existingStaffUser) {
        throw new Error('Staff ID already assigned to another user');
      }

      // Check for existing provider with this staffId
      const existingProvider = await tx.clinicalInfraProvider.findFirst({
        where: { tenantId: tenant.id, staffId: data.staffId, isArchived: false },
      });
      if (existingProvider) {
        throw new Error('Staff ID already exists in providers');
      }

      // Increment public ID counter for provider shortCode
      const counter = await tx.publicIdCounter.upsert({
        where: { tenantId_entityType: { tenantId: tenant.id, entityType: 'clinical_infra_provider' } },
        update: { seq: { increment: 1 } },
        create: { tenantId: tenant.id, entityType: 'clinical_infra_provider', seq: 1 },
      });
      const shortCode = `PRV-${zeroPad(counter.seq, 4)}`;

      // Create provider
      const provider = await tx.clinicalInfraProvider.create({
        data: {
          tenantId: tenant.id,
          shortCode,
          displayName: data.displayName,
          email: data.email.toLowerCase(),
          staffId: data.staffId,
          employmentType: data.employmentType,
          isArchived: false,
        },
      });

      // Create provider profile
      await tx.clinicalInfraProviderProfile.create({
        data: {
          tenantId: tenant.id,
          providerId: provider.id,
          licenseNumber: data.licenseNumber,
          unitIds: [data.primaryUnit],
          specialtyIds: data.specialties,
          consultationServiceCode: data.consultationServiceCode || null,
          level: data.level || 'CONSULTANT',
        },
      });

      // Create provider room assignments (individual rows per room)
      for (const roomId of data.roomIds) {
        await tx.clinicalInfraProviderRoomAssignment.create({
          data: {
            tenantId: tenant.id,
            providerId: provider.id,
            roomId,
          },
        });
      }

      // Create provider unit scope
      await tx.clinicalInfraProviderUnitScope.create({
        data: {
          tenantId: tenant.id,
          providerId: provider.id,
          unitId: data.primaryUnit,
        },
      });

      // Create provider assignment (clinic assignments)
      await tx.clinicalInfraProviderAssignment.create({
        data: {
          tenantId: tenant.id,
          providerId: provider.id,
          primaryClinicId: data.clinics[0],
          parallelClinicIds: data.clinics.slice(1),
        },
      });

      // Create scheduling resource
      const resource = await tx.schedulingResource.create({
        data: {
          tenantId: tenant.id,
          resourceType: 'PROVIDER',
          departmentKey: 'opd',
          displayName: data.displayName,
          status: 'ACTIVE',
          resourceRef: { kind: 'provider', providerId: provider.id },
          resourceRefProviderId: provider.id,
          resourceRefKind: 'provider',
          consultationServiceCode: data.consultationServiceCode || null,
          level: data.level || 'CONSULTANT',
        },
      });

      // Create scheduling template
      const effectiveFrom = new Date().toISOString().slice(0, 10);
      const template = await tx.schedulingTemplate.create({
        data: {
          tenantId: tenant.id,
          resourceId: resource.id,
          timezone: 'UTC',
          rrule: `FREQ=WEEKLY;BYDAY=${data.workingDays
            .map((d) => ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][d])
            .join(',')}`,
          daysOfWeek: data.workingDays,
          startTime: data.startTime,
          endTime: data.endTime,
          slotMinutes: data.appointmentDuration,
          effectiveFrom,
          effectiveTo: null,
          status: 'ACTIVE',
          createdByUserId: userId || null,
        },
      });

      // Generate scheduling slots for 30 days
      const slotsData: any[] = [];
      const startMinutes = timeToMinutes(data.startTime);
      const endMinutes = timeToMinutes(data.endTime);
      const breakStartMinutes = data.breakStart ? timeToMinutes(data.breakStart) : null;
      const breakEndMinutes = data.breakEnd ? timeToMinutes(data.breakEnd) : null;

      for (const day of dateRange(new Date(), 30)) {
        const dayOfWeek = day.getUTCDay();
        if (!data.workingDays.includes(dayOfWeek)) continue;
        for (let m = startMinutes; m + data.appointmentDuration <= endMinutes; m += data.appointmentDuration) {
          if (breakStartMinutes !== null && breakEndMinutes !== null) {
            if (m >= breakStartMinutes && m < breakEndMinutes) {
              m = breakEndMinutes - data.appointmentDuration;
              continue;
            }
          }
          const startAt = buildISO(day, m);
          const endAt = buildISO(day, m + data.appointmentDuration);
          const generationKey = `${resource.id}:${startAt.slice(0, 10)}:${startAt}`;
          slotsData.push({
            tenantId: tenant.id,
            resourceId: resource.id,
            date: startAt.slice(0, 10),
            startAt: new Date(startAt),
            endAt: new Date(endAt),
            status: 'OPEN',
            derivedFrom: { templateId: template.id, generationKey },
            templateId: template.id,
            generationKey,
          });
        }
      }

      if (slotsData.length) {
        await tx.schedulingSlot.createMany({ data: slotsData });
      }

      // Create user account
      const hashedPassword = await hashPassword(data.password);
      const permissions = getDefaultPermissionsForRole(data.role);
      const newUser = await tx.user.create({
        data: {
          email: data.email.toLowerCase(),
          password: hashedPassword,
          firstName: data.displayName.split(' ')[0] || data.displayName,
          lastName: data.displayName.split(' ').slice(1).join(' ') || data.displayName,
          role: data.role,
          staffId: data.staffId,
          isActive: true,
          tenantId: tenant.id,
          permissions,
          createdBy: userId,
          updatedBy: userId,
        },
      });

      if (data.sendWelcomeEmail) {
        logger.info('Welcome email queued', { category: 'api', route: 'POST /api/admin/doctors/onboard', email: data.email });
      }

      return {
        providerId: provider.id,
        resourceId: resource.id,
        templateId: template.id,
        userId: newUser.id,
        slotsGenerated: slotsData.length,
      };
    });

    await createAuditLog(
      'doctor_onboard',
      result.providerId,
      'DOCTOR_ONBOARDED',
      userId || 'system',
      undefined,
      {
        providerId: result.providerId,
        userId: result.userId,
        email: data.email,
        staffId: data.staffId,
        role: data.role,
      },
      tenantId
    );

    return NextResponse.json({
      success: true,
      created: result,
      credentials: {
        email: data.email,
        password: data.password,
        staffId: data.staffId,
      },
      message: 'Doctor account created successfully',
    });
  } catch (error: any) {
    logger.error('Doctor onboard failed', { category: 'api', route: 'POST /api/admin/doctors/onboard', error });
    return NextResponse.json(
      { error: error?.message || 'Failed to create doctor account' },
      { status: 500 }
    );
  }
}, { tenantScoped: true, permissionKey: 'admin.users.create' });
