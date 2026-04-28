import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { validateBody } from '@/lib/validation/helpers';
import { updateProblemSchema } from '@/lib/validation/patient.schema';
import { createAuditLog } from '@/lib/utils/audit';

export const PATCH = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }, params) => {
  const { id: patientId, problemId } = (params || {}) as { id: string; problemId: string };
  const updates = await req.json();

  const v = validateBody(updates, updateProblemSchema);
  if ('error' in v) return v.error;

  const allowedUpdates = ['code', 'description', 'status', 'severity', 'onsetDate', 'resolvedDate', 'notes'];
  const sanitizedUpdates: any = {
    updatedAt: new Date(),
    updatedBy: userId,
  };

  for (const key of allowedUpdates) {
    if (updates[key] !== undefined) {
      sanitizedUpdates[key] = updates[key];
    }
  }

  const existing = await prisma.patientProblem.findFirst({
    where: { id: problemId, patientId, tenantId },
  });

  if (!existing) {
    return NextResponse.json({ error: 'Problem not found' }, { status: 404 });
  }

  const result = await prisma.patientProblem.update({
    where: { id: problemId },
    data: sanitizedUpdates,
  });

  await createAuditLog(
    'patient_problem',
    problemId,
    'PROBLEM_UPDATED',
    userId || 'system',
    undefined,
    { patientId, changes: sanitizedUpdates },
    tenantId
  );

  return NextResponse.json({ success: true, problem: result });
}),
  { tenantScoped: true, permissionKey: 'clinical.edit' }
);

export const DELETE = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }, params) => {
  const { id: patientId, problemId } = (params || {}) as { id: string; problemId: string };

  const existing = await prisma.patientProblem.findFirst({
    where: { id: problemId, patientId, tenantId },
  });

  if (!existing) {
    return NextResponse.json({ error: 'Problem not found' }, { status: 404 });
  }

  await prisma.patientProblem.delete({
    where: { id: problemId },
  });

  await createAuditLog(
    'patient_problem',
    problemId,
    'PROBLEM_DELETED',
    'system',
    undefined,
    { patientId },
    tenantId
  );

  return NextResponse.json({ success: true });
}),
  { tenantScoped: true, permissionKey: 'clinical.delete' }
);
