import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { resolveTenantIdToUuid } from '@/lib/opd/data-aggregator';
import { withErrorHandler } from '@/lib/core/errors';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(
  withErrorHandler(async (req, { tenantId, userId, role }) => {
  try {
    const tenantUuid = await resolveTenantIdToUuid(tenantId);
    if (!tenantUuid) {
      return NextResponse.json({ error: 'Invalid tenant.' }, { status: 400 });
    }
    // Authorization check - admin only for seed routes
    if (!['admin'].includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get or create Ophthalmology specialty (Clinical Infra) — needed for scheduling/resources
    let ophthSpecialty = await prisma.clinicalInfraSpecialty.findFirst({
      where: {
        tenantId: tenantUuid,
        isArchived: false,
        OR: [
          { code: { equals: 'Ophthalmology', mode: 'insensitive' } },
          { code: { equals: 'Ophtha', mode: 'insensitive' } },
          { code: { equals: 'OPHTH', mode: 'insensitive' } },
          { name: { equals: 'Ophthalmology', mode: 'insensitive' } },
        ],
      },
    });
    if (!ophthSpecialty) {
      ophthSpecialty = await prisma.clinicalInfraSpecialty.create({
        data: {
          tenantId: tenantUuid,
          name: 'Ophthalmology',
          code: 'Ophthalmology',
          shortCode: 'OPHTH',
          isArchived: false,
        },
      });
    }

    // Get or create Ophthalmology department (tenantId in DB is UUID)
    let ophthDept = await prisma.department.findFirst({
      where: { tenantId: tenantUuid, code: 'OPHTH' },
    });
    if (!ophthDept) {
      ophthDept = await prisma.department.create({
        data: {
          tenantId: tenantUuid,
          name: 'Ophthalmology',
          code: 'OPHTH',
          type: 'OPD',
          isActive: true,
          createdBy: 'system',
          updatedBy: 'system',
        },
      });
    }

    // Create 9 clinics for Ophthalmology (with specialtyId for filtering)
    const clinicIds: string[] = [];
    for (let i = 0; i < 9; i++) {
      const clinicCode = `OPHTH_CLINIC_${i + 1}`;
      let clinic = await prisma.clinicalInfraClinic.findFirst({
        where: { tenantId: tenantUuid, shortCode: clinicCode },
      });
      if (!clinic) {
        clinic = await prisma.clinicalInfraClinic.create({
          data: {
            tenantId: tenantUuid,
            name: `Ophthalmology Clinic ${i + 1}`,
            shortCode: clinicCode,
            specialtyId: ophthSpecialty.id,
            isArchived: false,
          },
        });
      } else if (!clinic.specialtyId) {
        clinic = await prisma.clinicalInfraClinic.update({
          where: { id: clinic.id },
          data: { specialtyId: ophthSpecialty.id },
        });
      }
      clinicIds.push(clinic.id);
    }

    // Create 20 doctors: 2 full-time, 18 part-time
    const doctorsToCreate = [
      { staffId: 'OPHTH001', name: 'Dr. Mohammed Al-Otaibi', type: 'Full-Time' },
      { staffId: 'OPHTH002', name: 'Dr. Fatima Al-Shehri', type: 'Full-Time' },
      { staffId: 'OPHTH003', name: 'Dr. Ahmed Al-Ghamdi', type: 'Part-Time' },
      { staffId: 'OPHTH004', name: 'Dr. Sarah Al-Mutairi', type: 'Part-Time' },
      { staffId: 'OPHTH005', name: 'Dr. Omar Al-Harbi', type: 'Part-Time' },
      { staffId: 'OPHTH006', name: 'Dr. Layla Al-Zahrani', type: 'Part-Time' },
      { staffId: 'OPHTH007', name: 'Dr. Khalid Al-Qahtani', type: 'Part-Time' },
      { staffId: 'OPHTH008', name: 'Dr. Aisha Al-Dosari', type: 'Part-Time' },
      { staffId: 'OPHTH009', name: 'Dr. Youssef Al-Mansouri', type: 'Part-Time' },
      { staffId: 'OPHTH010', name: 'Dr. Noura Al-Saud', type: 'Part-Time' },
      { staffId: 'OPHTH011', name: 'Dr. Faisal Al-Rashid', type: 'Part-Time' },
      { staffId: 'OPHTH012', name: 'Dr. Hala Al-Mazrouei', type: 'Part-Time' },
      { staffId: 'OPHTH013', name: 'Dr. Majed Al-Shammari', type: 'Part-Time' },
      { staffId: 'OPHTH014', name: 'Dr. Reem Al-Fahad', type: 'Part-Time' },
      { staffId: 'OPHTH015', name: 'Dr. Tariq Al-Mutlaq', type: 'Part-Time' },
      { staffId: 'OPHTH016', name: 'Dr. Lina Al-Harbi', type: 'Part-Time' },
      { staffId: 'OPHTH017', name: 'Dr. Zaid Al-Qasimi', type: 'Part-Time' },
      { staffId: 'OPHTH018', name: 'Dr. Rana Al-Sulaimani', type: 'Part-Time' },
      { staffId: 'OPHTH019', name: 'Dr. Badr Al-Tamimi', type: 'Part-Time' },
      { staffId: 'OPHTH020', name: 'Dr. Dana Al-Khateeb', type: 'Part-Time' },
    ];

    const createdDoctors: any[] = [];
    for (const docData of doctorsToCreate) {
      let provider = await prisma.clinicalInfraProvider.findFirst({
        where: { tenantId: tenantUuid, staffId: docData.staffId },
      });
      if (!provider) {
        provider = await prisma.clinicalInfraProvider.create({
          data: {
            tenantId: tenantUuid,
            displayName: docData.name,
            staffId: docData.staffId,
            employmentType: docData.type,
            specialtyCode: 'Ophthalmology',
            isArchived: false,
          },
        });
      } else if (!provider.specialtyCode) {
        provider = await prisma.clinicalInfraProvider.update({
          where: { id: provider.id },
          data: { specialtyCode: 'Ophthalmology' },
        });
      }

      // Ensure provider profile exists with Ophthalmology specialty (for scheduling filter)
      let profile = await prisma.clinicalInfraProviderProfile.findFirst({
        where: { tenantId: tenantUuid, providerId: provider.id },
      });
      if (!profile) {
        await prisma.clinicalInfraProviderProfile.create({
          data: {
            tenantId: tenantUuid,
            providerId: provider.id,
            specialtyIds: [ophthSpecialty.id],
          },
        });
      } else if (!profile.specialtyIds.includes(ophthSpecialty.id)) {
        await prisma.clinicalInfraProviderProfile.update({
          where: { id: profile.id },
          data: { specialtyIds: [...profile.specialtyIds, ophthSpecialty.id] },
        });
      }

      createdDoctors.push(provider);
    }

    // Create sample census data for 2 weeks: December 6-19, 2025
    const startDate = new Date('2025-12-06');
    const endDate = new Date('2025-12-19');

    // Check if data already exists
    const existingData = await prisma.opdCensus.findFirst({
      where: {
        tenantId: tenantUuid,
        departmentId: ophthDept.id,
        date: { gte: new Date('2025-12-06'), lte: new Date('2025-12-19T23:59:59.999Z') },
      },
    });

    let recordsCreated = 0;
    if (!existingData) {
      const sampleRecords: any[] = [];

      // Assign schedule days per doctor
      const allDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
      const doctorSchedules = createdDoctors.map((doc, idx) => {
        if (idx < 2) return allDays; // full-time
        // part-time: 2-3 days
        const numDays = 2 + (idx % 2);
        return allDays.filter((_, i) => i % (5 - numDays) === idx % (5 - numDays) || i < numDays);
      });

      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const date = new Date(d);
        date.setHours(8, 0, 0, 0);
        const dayOfWeek = date.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) continue;

        const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek];

        createdDoctors.forEach((doctor, index) => {
          const schedule = doctorSchedules[index];
          if (schedule.includes(dayName)) {
            const randomClinic = clinicIds[Math.floor(Math.random() * clinicIds.length)];
            sampleRecords.push({
              tenantId: tenantUuid,
              date,
              clinicId: randomClinic,
              departmentId: ophthDept.id,
              doctorId: doctor.id,
              patientCount: 15 + Math.floor(Math.random() * 20),
              newPatients: 5 + Math.floor(Math.random() * 10),
              followUpPatients: 10 + Math.floor(Math.random() * 10),
              booked: 8 + Math.floor(Math.random() * 12),
              waiting: 3 + Math.floor(Math.random() * 8),
              procedures: 2 + Math.floor(Math.random() * 6),
              utilizationRate: 60 + Math.floor(Math.random() * 30),
              createdBy: 'system',
              updatedBy: 'system',
            });
          }
        });
      }

      if (sampleRecords.length > 0) {
        await prisma.opdCensus.createMany({ data: sampleRecords });
        recordsCreated = sampleRecords.length;
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Ophthalmology data created successfully',
      recordsCreated,
      dateRange: 'December 6-19, 2025',
      department: ophthDept.name,
      totalClinics: clinicIds.length,
      totalDoctors: createdDoctors.length,
      fullTimeDoctors: createdDoctors.filter((_, i) => i < 2).length,
      partTimeDoctors: createdDoctors.filter((_, i) => i >= 2).length,
      technicians: 4,
    });
  } catch (error) {
    logger.error('Ophthalmology data creation error', { category: 'opd', error });
    return NextResponse.json(
      // [SEC-10]
      { error: 'Failed to create ophthalmology data' },
      { status: 500 }
    );
  }
}),
  { tenantScoped: true, platformKey: 'thea_health' }
);
