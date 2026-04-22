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

    // Get or create sample departments (tenantId in DB is UUID)
    let cardioDept = await prisma.department.findFirst({
      where: { tenantId: tenantUuid, code: 'CARDIO' },
    });
    if (!cardioDept) {
      cardioDept = await prisma.department.create({
        data: {
          tenantId: tenantUuid,
          name: 'Cardiology',
          code: 'CARDIO',
          type: 'OPD',
          isActive: true,
          createdBy: 'system',
          updatedBy: 'system',
        },
      });
    }

    let orthoDept = await prisma.department.findFirst({
      where: { tenantId: tenantUuid, code: 'ORTHO' },
    });
    if (!orthoDept) {
      orthoDept = await prisma.department.create({
        data: {
          tenantId: tenantUuid,
          name: 'Orthopedics',
          code: 'ORTHO',
          type: 'BOTH',
          isActive: true,
          createdBy: 'system',
          updatedBy: 'system',
        },
      });
    }

    // Get or create sample providers (doctors)
    const doctorsToCreate = [
      { staffId: 'DOC001', name: 'Dr. Ahmed Ali', dept: cardioDept.id, clinic: 'CLINIC1', type: 'Full-Time', days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday'] },
      { staffId: 'DOC002', name: 'Dr. Sarah Mohammed', dept: cardioDept.id, clinic: 'CLINIC2', type: 'Full-Time', days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday'] },
      { staffId: 'DOC003', name: 'Dr. Omar Hassan', dept: cardioDept.id, clinic: 'CLINIC1', type: 'Full-Time', days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday'] },
      { staffId: 'DOC004', name: 'Dr. Fatima Ibrahim', dept: cardioDept.id, clinic: 'CLINIC2', type: 'Full-Time', days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday'] },
      { staffId: 'DOC005', name: 'Dr. Khalid Abdullah', dept: cardioDept.id, clinic: 'CLINIC1', type: 'Full-Time', days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday'] },
      { staffId: 'DOC006', name: 'Dr. Mohammed Saleh', dept: orthoDept.id, clinic: 'CLINIC3', type: 'Full-Time', days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] },
      { staffId: 'DOC007', name: 'Dr. Aisha Nasser', dept: orthoDept.id, clinic: 'CLINIC3', type: 'Full-Time', days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] },
      { staffId: 'DOC008', name: 'Dr. Youssef Al-Mansouri', dept: orthoDept.id, clinic: 'CLINIC3', type: 'Full-Time', days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] },
      { staffId: 'DOC009', name: 'Dr. Layla Al-Zahra', dept: orthoDept.id, clinic: 'CLINIC3', type: 'Full-Time', days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] },
      { staffId: 'DOC010', name: 'Dr. Hamad Al-Rashid', dept: orthoDept.id, clinic: 'CLINIC3', type: 'Full-Time', days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] },
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
            isArchived: false,
          },
        });
      }
      createdDoctors.push({ ...provider, weeklyScheduleDays: docData.days, clinicId: docData.clinic });
    }

    // Create sample census data for 2 weeks: December 6-19, 2025
    const startDate = new Date('2025-12-06');
    const endDate = new Date('2025-12-19');
    const cardioClinics = ['CLINIC1', 'CLINIC2', 'CLINIC1', 'CLINIC2', 'CLINIC1'];

    // Check if data already exists
    const existingData = await prisma.opdCensus.findFirst({
      where: {
        tenantId: tenantUuid,
        date: { gte: new Date('2025-12-06'), lte: new Date('2025-12-19T23:59:59.999Z') },
      },
    });

    let recordsCreated = 0;
    if (!existingData) {
      const sampleRecords: any[] = [];

      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const date = new Date(d);
        date.setHours(8, 0, 0, 0);
        const dayOfWeek = date.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) continue;

        const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek];

        // Cardiology doctors (first 5)
        for (let i = 0; i < 5; i++) {
          const doctor = createdDoctors[i];
          if (doctor.weeklyScheduleDays.includes(dayName)) {
            sampleRecords.push({
              tenantId: tenantUuid,
              date,
              clinicId: cardioClinics[i],
              departmentId: cardioDept.id,
              doctorId: doctor.id,
              patientCount: 20 + Math.floor(Math.random() * 15),
              newPatients: 8 + Math.floor(Math.random() * 7),
              followUpPatients: 12 + Math.floor(Math.random() * 8),
              booked: 10 + Math.floor(Math.random() * 8),
              waiting: 6 + Math.floor(Math.random() * 5),
              procedures: 4 + Math.floor(Math.random() * 4),
              utilizationRate: 65 + Math.floor(Math.random() * 25),
              createdBy: 'system',
              updatedBy: 'system',
            });
          }
        }

        // Orthopedics doctors (last 5)
        for (let i = 5; i < 10; i++) {
          const doctor = createdDoctors[i];
          if (doctor.weeklyScheduleDays.includes(dayName)) {
            sampleRecords.push({
              tenantId: tenantUuid,
              date,
              clinicId: 'CLINIC3',
              departmentId: orthoDept.id,
              doctorId: doctor.id,
              patientCount: 25 + Math.floor(Math.random() * 15),
              newPatients: 12 + Math.floor(Math.random() * 8),
              followUpPatients: 13 + Math.floor(Math.random() * 7),
              booked: 15 + Math.floor(Math.random() * 8),
              waiting: 8 + Math.floor(Math.random() * 5),
              procedures: 6 + Math.floor(Math.random() * 5),
              utilizationRate: 70 + Math.floor(Math.random() * 25),
              createdBy: 'system',
              updatedBy: 'system',
            });
          }
        }
      }

      if (sampleRecords.length > 0) {
        await prisma.opdCensus.createMany({ data: sampleRecords });
        recordsCreated = sampleRecords.length;
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Sample data created successfully',
      recordsCreated,
      dateRange: 'December 6-19, 2025',
      departments: [cardioDept.name, orthoDept.name],
      doctors: createdDoctors.map((d: any) => d.displayName),
      totalDoctors: createdDoctors.length,
    });
  } catch (error) {
    logger.error('Sample data creation error', { category: 'opd', error });
    return NextResponse.json(
      // [SEC-10]
      { error: 'Failed to create sample data' },
      { status: 500 }
    );
  }
}),
  { tenantScoped: true, platformKey: 'thea_health' }
);
