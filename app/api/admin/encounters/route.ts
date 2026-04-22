/**
 * Admin EHR Encounters API
 * POST /api/admin/encounters
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { tenantWhere } from '@/lib/db/tenantLookup';
import { getISOTimestamp, createAuditLog } from '@/lib/ehr/utils/audit';
import { validateRequired, validateISOTimestamp, formatValidationErrors } from '@/lib/ehr/utils/validation';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { validateBody } from '@/lib/validation/helpers';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const encounterSchema = z.object({
  patientId: z.string().min(1),
  mrn: z.string().min(1),
  encounterType: z.enum(['INPATIENT', 'OUTPATIENT', 'EMERGENCY', 'AMBULATORY', 'OTHER']),
  admissionDate: z.string().min(1),
}).passthrough();

export const POST = withAuthTenant(async (req, { user, tenantId }) => {
  try {
    const body = await req.json();
    const v = validateBody(body, encounterSchema);
    if ('error' in v) return v.error;

    // Validation
    const requiredFields = ['patientId', 'mrn', 'encounterType', 'admissionDate'];
    const validationErrors = validateRequired(body, requiredFields);

    if (body.admissionDate && !validateISOTimestamp(body.admissionDate)) {
      validationErrors.push({ field: 'admissionDate', message: 'Invalid timestamp format. Use ISO 8601' });
    }

    if (body.dischargeDate && !validateISOTimestamp(body.dischargeDate)) {
      validationErrors.push({ field: 'dischargeDate', message: 'Invalid timestamp format. Use ISO 8601' });
    }

    if (!['INPATIENT', 'OUTPATIENT', 'EMERGENCY', 'AMBULATORY', 'OTHER'].includes(body.encounterType)) {
      validationErrors.push({ field: 'encounterType', message: 'Invalid encounter type' });
    }

    if (validationErrors.length > 0) {
      return NextResponse.json(formatValidationErrors(validationErrors), { status: 400 });
    }

    // Resolve tenant UUID
    const tenant = await prisma.tenant.findFirst({ where: tenantWhere(tenantId), select: { id: true } });
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    // Verify patient exists (with tenant isolation)
    const patient = await prisma.ehrPatient.findFirst({
      where: { tenantId: tenant.id, id: body.patientId, mrn: body.mrn },
    });

    if (!patient) {
      return NextResponse.json(
        { error: 'Patient not found' },
        { status: 404 }
      );
    }

    // Generate encounter number
    const encounterNumber = `ENC-${Date.now()}-${crypto.randomUUID().substring(0, 8).toUpperCase()}`;

    // Create encounter
    const encounter = await prisma.ehrEncounter.create({
      data: {
        tenantId: tenant.id,
        patientId: body.patientId,
        mrn: body.mrn,
        encounterNumber,
        encounterType: body.encounterType,
        admissionDate: body.admissionDate ? new Date(body.admissionDate) : null,
        dischargeDate: body.dischargeDate ? new Date(body.dischargeDate) : null,
        status: body.status || 'IN_PROGRESS',
        department: body.department,
        service: body.service,
        location: body.location,
        attendingPhysicianId: body.attendingPhysicianId,
        chiefComplaint: body.chiefComplaint,
        primaryDiagnosis: body.primaryDiagnosis,
        diagnosisCodes: body.diagnosisCodes || [],
        createdBy: user.id,
      },
    });

    // Audit log - with tenant isolation
    await createAuditLog({
      action: 'CREATE_ENCOUNTER',
      resourceType: 'encounter',
      resourceId: encounter.id,
      userId: user.id,
      userName: `${user.firstName} ${user.lastName}`,
      tenantId,
      patientId: encounter.patientId,
      mrn: encounter.mrn || undefined,
      success: true,
      ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
      userAgent: req.headers.get('user-agent') || undefined,
    });

    return NextResponse.json(
      { success: true, encounter },
      { status: 201 }
    );
  } catch (error: any) {
    logger.error('Create encounter error', { category: 'api', route: 'POST /api/admin/encounters', error });

    // Audit log for failure
    try {
      await createAuditLog({
        action: 'CREATE_ENCOUNTER',
        resourceType: 'encounter',
        userId: user.id,
        tenantId,
        success: false,
        errorMessage: error.message,
      });
    } catch {}

    // [SEC-03]
    return NextResponse.json(
      { error: 'Failed to create encounter' },
      { status: 500 }
    );
  }
}, { tenantScoped: true, permissionKey: 'admin.ehr.encounters.access' });
