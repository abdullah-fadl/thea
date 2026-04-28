/**
 * Admin EHR Notes API
 * POST /api/admin/ehr/notes
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { Note } from '@/lib/ehr/models';
import { getISOTimestamp, createAuditLog } from '@/lib/ehr/utils/audit';
import { validateRequired, formatValidationErrors } from '@/lib/ehr/utils/validation';
import { emitAutoTriggerEvent } from '@/lib/integrations/auto-trigger';
import { canAutoTrigger } from '@/lib/integrations/check-entitlements';
import { isAutoTriggerEnabled } from '@/lib/integrations/settings';
import { validateBody } from '@/lib/validation/helpers';
import { logger } from '@/lib/monitoring/logger';
import { tenantWhere } from '@/lib/db/tenantLookup';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ehrNoteSchema = z.object({
  patientId: z.string().min(1),
  mrn: z.string().min(1),
  noteType: z.enum(['PROGRESS', 'ADMISSION', 'DISCHARGE', 'CONSULTATION', 'PROCEDURE', 'SOAP', 'OTHER']),
  content: z.string().min(1),
  authoredBy: z.string().min(1),
}).passthrough();

export const POST = withAuthTenant(async (req, { user, tenantId }) => {
  try {
    const body = await req.json();
    const v = validateBody(body, ehrNoteSchema);
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

    // Verify patient exists - with tenant isolation
    const patient = await prisma.ehrPatient.findFirst({
      where: { tenantId: tenant.id, id: body.patientId, mrn: body.mrn },
    });

    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
    }

    // Create note - with tenant isolation
    const now = getISOTimestamp();
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

    // Auto-trigger policy check (fire-and-forget, non-blocking)
    const token = req.cookies.get('auth-token')?.value;
    if (token) {
      const hasEntitlements = await canAutoTrigger(token);
      const autoTriggerEnabled = await isAutoTriggerEnabled(tenantId);
      if (hasEntitlements && autoTriggerEnabled) {
        const noteText = note.content || note.title || '';

        emitAutoTriggerEvent({
          tenantId,
          userId: user.id,
          type: 'NOTE',
          source: 'note_save',
          subject: body.mrn,
          payload: {
            text: noteText,
            metadata: {
              noteId: note.id,
              noteType: note.noteType,
            },
          },
        }).catch((error) => {
          logger.error('Failed to emit auto-trigger note event', { category: 'api', error });
        });
      }
    }

    return NextResponse.json(
      { success: true, note },
      { status: 201 }
    );
  } catch (error: any) {
    logger.error('Create note error', { category: 'api', route: 'POST /api/admin/ehr/notes', error });
    // [SEC-03]
    return NextResponse.json(
      { error: 'Failed to create note' },
      { status: 500 }
    );
  }
}, { permissionKey: 'admin.ehr.notes' });
