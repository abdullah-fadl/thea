/**
 * Admin EHR Notes API
 * POST /api/admin/notes
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { tenantWhere } from '@/lib/db/tenantLookup';
import { getISOTimestamp, createAuditLog } from '@/lib/ehr/utils/audit';
import { validateRequired, formatValidationErrors } from '@/lib/ehr/utils/validation';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { validateBody } from '@/lib/validation/helpers';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const noteSchema = z.object({
  patientId: z.string().min(1),
  mrn: z.string().min(1),
  noteType: z.enum(['PROGRESS', 'ADMISSION', 'DISCHARGE', 'CONSULTATION', 'PROCEDURE', 'SOAP', 'OTHER']),
  content: z.string().min(1),
  authoredBy: z.string().min(1),
}).passthrough();

export const POST = withAuthTenant(async (req, { user, tenantId }) => {
  try {
    const body = await req.json();
    const v = validateBody(body, noteSchema);
    if ('error' in v) return v.error;

    // Validation
    const requiredFields = ['patientId', 'mrn', 'noteType', 'content', 'authoredBy'];
    const validationErrors = validateRequired(body, requiredFields);

    if (!['PROGRESS', 'ADMISSION', 'DISCHARGE', 'CONSULTATION', 'PROCEDURE', 'SOAP', 'OTHER'].includes(body.noteType)) {
      validationErrors.push({ field: 'noteType', message: 'Invalid note type' });
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

    // Create note
    const note = await prisma.ehrNote.create({
      data: {
        tenantId: tenant.id,
        patientId: body.patientId,
        encounterId: body.encounterId || null,
        noteType: body.noteType,
        title: body.title || null,
        content: body.content,
        authoredBy: body.authoredBy,
        authorName: body.authorName || null,
        status: body.status || 'DRAFT',
        authoredAt: body.authoredAt ? new Date(body.authoredAt) : new Date(),
        sections: body.sections || null,
        createdBy: user.id,
      },
    });

    // Audit log - with tenant isolation
    await createAuditLog({
      action: 'CREATE_NOTE',
      resourceType: 'note',
      resourceId: note.id,
      userId: user.id,
      userName: `${user.firstName} ${user.lastName}`,
      tenantId,
      patientId: note.patientId,
      mrn: body.mrn,
      success: true,
      ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
      userAgent: req.headers.get('user-agent') || undefined,
    });

    return NextResponse.json(
      { success: true, note },
      { status: 201 }
    );
  } catch (error: any) {
    logger.error('Create note error', { category: 'api', route: 'POST /api/admin/notes', error });

    // Audit log for failure
    try {
      await createAuditLog({
        action: 'CREATE_NOTE',
        resourceType: 'note',
        userId: user.id,
        tenantId,
        success: false,
        errorMessage: error.message,
      });
    } catch {}

    // [SEC-03]
    return NextResponse.json(
      { error: 'Failed to create note' },
      { status: 500 }
    );
  }
}, { tenantScoped: true, permissionKey: 'admin.ehr.notes.access' });
