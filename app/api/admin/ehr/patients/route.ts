/**
 * Admin EHR Patients API
 * POST /api/admin/ehr/patients
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { Patient } from '@/lib/ehr/models';
import { getISOTimestamp, createAuditLog } from '@/lib/ehr/utils/audit';
import { validateRequired, validateEmail, validateISODate, formatValidationErrors } from '@/lib/ehr/utils/validation';
import { validateBody } from '@/lib/validation/helpers';
import { logger } from '@/lib/monitoring/logger';
import { tenantWhere } from '@/lib/db/tenantLookup';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ehrPatientSchema = z.object({
  mrn: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  dateOfBirth: z.string().min(1),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'UNKNOWN']),
}).passthrough();

export const POST = withAuthTenant(async (req, { user, tenantId }) => {
  try {
    const body = await req.json();
    const v = validateBody(body, ehrPatientSchema);
    if ('error' in v) return v.error;

    // Validation
    const requiredFields = ['mrn', 'firstName', 'lastName', 'dateOfBirth', 'gender'];
    const validationErrors = validateRequired(body, requiredFields);

    if (body.email && !validateEmail(body.email)) {
      validationErrors.push({ field: 'email', message: 'Invalid email format' });
    }

    if (body.dateOfBirth && !validateISODate(body.dateOfBirth)) {
      validationErrors.push({ field: 'dateOfBirth', message: 'Invalid date format. Use YYYY-MM-DD' });
    }

    if (body.deceasedDate && !validateISODate(body.deceasedDate)) {
      validationErrors.push({ field: 'deceasedDate', message: 'Invalid date format. Use YYYY-MM-DD' });
    }

    if (!['MALE', 'FEMALE', 'OTHER', 'UNKNOWN'].includes(body.gender)) {
      validationErrors.push({ field: 'gender', message: 'Gender must be one of: MALE, FEMALE, OTHER, UNKNOWN' });
    }

    if (validationErrors.length > 0) {
      return NextResponse.json(formatValidationErrors(validationErrors), { status: 400 });
    }

    // Resolve tenant UUID
    const tenant = await prisma.tenant.findFirst({ where: tenantWhere(tenantId), select: { id: true } });
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    // Check if MRN already exists - with tenant isolation
    const existingPatient = await prisma.ehrPatient.findFirst({
      where: { tenantId: tenant.id, mrn: body.mrn },
    });

    if (existingPatient) {
      return NextResponse.json(
        { error: 'Patient with this MRN already exists' },
        { status: 400 }
      );
    }

    // Create patient - with tenant isolation
    const now = getISOTimestamp();
    const patient = await prisma.ehrPatient.create({
      data: {
        tenantId: tenant.id,
        mrn: body.mrn,
        firstName: body.firstName,
        lastName: body.lastName,
        middleName: body.middleName || null,
        dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : null,
        gender: body.gender,
        email: body.email || null,
        phone: body.phone || null,
        address: body.address || (body.city || body.state || body.zipCode || body.country ? {
          street: body.address?.street,
          city: body.city,
          state: body.state,
          zipCode: body.zipCode,
          country: body.country,
        } : undefined),
        insuranceProvider: body.insuranceProvider || null,
        insuranceId: body.insuranceId || null,
        nationalId: body.nationalId || null,
        isActive: body.isActive !== undefined ? body.isActive : true,
        deceasedDate: body.deceasedDate ? new Date(body.deceasedDate) : null,
        createdBy: user.id,
      },
    });

    // Create audit log - with tenant isolation
    await createAuditLog({
      action: 'CREATE_PATIENT',
      resourceType: 'patient',
      resourceId: patient.id,
      userId: user.id,
      userName: `${user.firstName} ${user.lastName}`,
      tenantId,
      patientId: patient.id,
      mrn: patient.mrn || undefined,
      success: true,
      ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
      userAgent: req.headers.get('user-agent') || undefined,
    });

    return NextResponse.json({
      success: true,
      patient,
    }, { status: 201 });
  } catch (error: any) {
    logger.error('Create patient error', { category: 'api', route: 'POST /api/admin/ehr/patients', error });
    // [SEC-03]
    return NextResponse.json(
      { error: 'Failed to create patient' },
      { status: 500 }
    );
  }
}, { permissionKey: 'admin.ehr.patients' });
