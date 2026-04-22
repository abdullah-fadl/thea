import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { v4 as uuidv4 } from 'uuid';
import { validateBody } from '@/lib/validation/helpers';
import { createProblemSchema } from '@/lib/validation/patient.schema';
import { createAuditLog } from '@/lib/utils/audit';
import { withAccessAudit } from '@/lib/audit/accessLogger';

export const GET = withAuthTenant(
  withAccessAudit(withErrorHandler(async (req: NextRequest, { tenantId }, params) => {
  const patientId = (params as { id: string } | undefined)?.id;

  const problems = await prisma.patientProblem.findMany({
    where: { tenantId, patientId },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: 100,
  });

  return NextResponse.json({ items: problems });
}), { resourceType: 'problem_list', extractPatientId: (req) => { const parts = req.nextUrl.pathname.split('/'); const idx = parts.indexOf('patients'); return idx >= 0 ? parts[idx + 1] || null : null; }, logResponseMeta: true }),
  { tenantScoped: true, permissionKeys: ['clinical.view', 'opd.doctor.encounter.view', 'opd.doctor.visit.view', 'opd.nursing.edit', 'opd.visit.view'] }
);

export const POST = withAuthTenant(
  withAccessAudit(withErrorHandler(async (req: NextRequest, { tenantId, userId }, params) => {
  const patientId = (params as { id: string } | undefined)?.id;
  const body = await req.json();

  const v = validateBody(body, createProblemSchema);
  if ('error' in v) return v.error;
  const { code, description, status, severity, onsetDate, resolvedDate, notes } = v.data;

  const problem = await prisma.patientProblem.create({
    data: {
      id: uuidv4(),
      tenantId,
      patientId: patientId!,
      problemName: description || code || '',
      code: code || null,
      description: description || null,
      icdCode: code || null,
      status: status || 'active',
      severity: severity || 'moderate',
      onsetDate: onsetDate ? new Date(onsetDate) : null,
      resolvedDate: resolvedDate ? new Date(resolvedDate) : null,
      notes: notes || null,
      createdAt: new Date(),
      createdBy: userId,
      updatedAt: new Date(),
      updatedBy: userId,
    },
  });

  await createAuditLog(
    'patient_problem',
    problem.id,
    'PROBLEM_CREATED',
    userId || 'system',
    undefined,
    { patientId, code, description },
    tenantId
  );

  return NextResponse.json({ success: true, problem });
}), { resourceType: 'problem_list', extractPatientId: (req) => { const parts = req.nextUrl.pathname.split('/'); const idx = parts.indexOf('patients'); return idx >= 0 ? parts[idx + 1] || null : null; }, action: 'data_create' }),
  { tenantScoped: true, permissionKey: 'clinical.edit' }
);
