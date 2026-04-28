/**
 * Admin EHR Tasks API
 * POST /api/admin/ehr/tasks
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { Task } from '@/lib/ehr/models';
import { getISOTimestamp, createAuditLog } from '@/lib/ehr/utils/audit';
import { validateRequired, validateISOTimestamp, formatValidationErrors } from '@/lib/ehr/utils/validation';
import { validateBody } from '@/lib/validation/helpers';
import { logger } from '@/lib/monitoring/logger';
import { tenantWhere } from '@/lib/db/tenantLookup';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ehrTaskSchema = z.object({
  title: z.string().min(1),
  taskType: z.enum(['CLINICAL', 'ADMINISTRATIVE', 'FOLLOW_UP', 'REVIEW', 'OTHER']),
  assignedTo: z.string().min(1),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']),
}).passthrough();

export const POST = withAuthTenant(async (req, { user, tenantId }) => {
  try {
    const body = await req.json();
    const v = validateBody(body, ehrTaskSchema);
    if ('error' in v) return v.error;

    // Validation
    const requiredFields = ['title', 'taskType', 'assignedTo', 'priority'];
    const validationErrors = validateRequired(body, requiredFields);

    if (!['CLINICAL', 'ADMINISTRATIVE', 'FOLLOW_UP', 'REVIEW', 'OTHER'].includes(body.taskType)) {
      validationErrors.push({ field: 'taskType', message: 'Invalid task type' });
    }

    if (!['LOW', 'NORMAL', 'HIGH', 'URGENT'].includes(body.priority)) {
      validationErrors.push({ field: 'priority', message: 'Invalid priority' });
    }

    if (body.dueDate && !validateISOTimestamp(body.dueDate)) {
      validationErrors.push({ field: 'dueDate', message: 'Invalid timestamp format. Use ISO 8601' });
    }

    if (validationErrors.length > 0) {
      return NextResponse.json(formatValidationErrors(validationErrors), { status: 400 });
    }

    // Resolve tenant UUID
    const tenant = await prisma.tenant.findFirst({ where: tenantWhere(tenantId), select: { id: true } });
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    // Verify patient exists if patientId is provided
    if (body.patientId) {
      const patient = await prisma.ehrPatient.findFirst({
        where: { tenantId: tenant.id, id: body.patientId },
      });

      if (!patient) {
        return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
      }
    }

    // Create task
    const task = await prisma.ehrTask.create({
      data: {
        tenantId: tenant.id,
        patientId: body.patientId || null,
        encounterId: body.encounterId || null,
        title: body.title,
        description: body.description || null,
        taskType: body.taskType,
        assignedTo: body.assignedTo,
        status: body.status || 'PENDING',
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        priority: body.priority,
        notes: body.notes || null,
        createdBy: user.id,
      },
    });

    // Audit log - with tenant isolation
    await createAuditLog({
      action: 'CREATE_TASK',
      resourceType: 'task',
      resourceId: task.id,
      userId: user.id,
      userName: `${user.firstName} ${user.lastName}`,
      tenantId,
      patientId: task.patientId || undefined,
      mrn: body.mrn,
      success: true,
      ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
      userAgent: req.headers.get('user-agent') || undefined,
    });

    return NextResponse.json(
      { success: true, task },
      { status: 201 }
    );
  } catch (error: any) {
    logger.error('Create task error', { category: 'api', route: 'POST /api/admin/ehr/tasks', error });

    try {
      await createAuditLog({
        action: 'CREATE_TASK',
        resourceType: 'task',
        userId: user.id,
        tenantId,
        success: false,
        errorMessage: error.message,
      });
    } catch {}

    // [SEC-03]
    return NextResponse.json(
      { error: 'Failed to create task' },
      { status: 500 }
    );
  }
}, { tenantScoped: true, permissionKey: 'admin.ehr.tasks.access' });
