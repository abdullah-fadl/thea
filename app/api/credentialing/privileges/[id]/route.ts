import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { revokePrivilege } from '@/lib/credentialing/engine';
import { createAuditLog } from '@/lib/utils/audit';
import { validateBody } from '@/lib/validation/helpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/credentialing/privileges/[id]
 * Get privilege detail
 */
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }, params) => {
    const resolved = params instanceof Promise ? await params : params;
    const id = resolved?.id as string;
    if (!id) {
      return NextResponse.json({ error: 'Missing privilege ID' }, { status: 400 });
    }

    const privilege = await prisma.clinicalPrivilege.findFirst({
      where: { id, tenantId },
    });

    if (!privilege) {
      return NextResponse.json({ error: 'Privilege not found' }, { status: 404 });
    }

    return NextResponse.json({ privilege });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'credentialing.view' },
);

/**
 * PATCH /api/credentialing/privileges/[id]
 * Update or revoke a privilege
 */
const updateSchema = z.object({
  action: z.enum(['update', 'revoke', 'suspend', 'reinstate']).optional(),
  reason: z.string().optional(),
  status: z.string().optional(),
  conditions: z.string().optional(),
  caseLogCompleted: z.number().optional(),
  expiresAt: z.string().optional(),
  notes: z.string().optional(),
  department: z.string().optional(),
  nextReviewDate: z.string().optional(),
  lastReviewDate: z.string().optional(),
}).passthrough();

export const PATCH = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId: actorId, user }, params) => {
    const resolved = params instanceof Promise ? await params : params;
    const id = resolved?.id as string;
    if (!id) {
      return NextResponse.json({ error: 'Missing privilege ID' }, { status: 400 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const result = validateBody(body, updateSchema);
    if ('error' in result) return result.error;
    const data = result.data;

    // Revoke action
    if (data.action === 'revoke') {
      const revokeResult = await revokePrivilege(
        id,
        data.reason || 'Revoked',
        actorId,
        tenantId,
        user?.email,
      );
      if ('error' in revokeResult) {
        return NextResponse.json({ error: revokeResult.error }, { status: 404 });
      }
      return NextResponse.json({ success: true, privilege: revokeResult.privilege });
    }

    // Suspend action
    if (data.action === 'suspend') {
      const existing = await prisma.clinicalPrivilege.findFirst({ where: { id, tenantId } });
      if (!existing) {
        return NextResponse.json({ error: 'Privilege not found' }, { status: 404 });
      }

      const updated = await prisma.clinicalPrivilege.update({
        where: { id },
        data: { status: 'suspended', notes: data.reason || existing.notes },
      });

      await createAuditLog(
        'clinical_privilege',
        id,
        'SUSPEND',
        actorId,
        user?.email,
        { before: { status: existing.status }, after: { status: 'suspended', reason: data.reason } },
        tenantId,
      );

      return NextResponse.json({ success: true, privilege: updated });
    }

    // Reinstate action
    if (data.action === 'reinstate') {
      const existing = await prisma.clinicalPrivilege.findFirst({ where: { id, tenantId } });
      if (!existing) {
        return NextResponse.json({ error: 'Privilege not found' }, { status: 404 });
      }

      const updated = await prisma.clinicalPrivilege.update({
        where: { id },
        data: { status: 'active', notes: data.notes || existing.notes },
      });

      await createAuditLog(
        'clinical_privilege',
        id,
        'REINSTATE',
        actorId,
        user?.email,
        { before: { status: existing.status }, after: { status: 'active' } },
        tenantId,
      );

      return NextResponse.json({ success: true, privilege: updated });
    }

    // Regular update
    const existing = await prisma.clinicalPrivilege.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return NextResponse.json({ error: 'Privilege not found' }, { status: 404 });
    }

    const updateData: Record<string, any> = {};
    if (data.status !== undefined) updateData.status = data.status;
    if (data.conditions !== undefined) updateData.conditions = data.conditions;
    if (data.caseLogCompleted !== undefined) updateData.caseLogCompleted = data.caseLogCompleted;
    if (data.expiresAt !== undefined) updateData.expiresAt = new Date(data.expiresAt);
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.department !== undefined) updateData.department = data.department;
    if (data.nextReviewDate !== undefined) updateData.nextReviewDate = new Date(data.nextReviewDate);
    if (data.lastReviewDate !== undefined) updateData.lastReviewDate = new Date(data.lastReviewDate);

    const updated = await prisma.clinicalPrivilege.update({
      where: { id },
      data: updateData,
    });

    await createAuditLog(
      'clinical_privilege',
      id,
      'UPDATE',
      actorId,
      user?.email,
      { before: existing, after: updated },
      tenantId,
    );

    return NextResponse.json({ success: true, privilege: updated });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'credentialing.manage' },
);
