/**
 * SCM Approval — Single Delegation
 *
 * PUT    /api/imdad/approval/delegations/:id — Update delegation
 * DELETE /api/imdad/approval/delegations/:id — Revoke (soft delete) delegation
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// PUT — Update delegation
// ---------------------------------------------------------------------------

const updateDelegationSchema = z.object({
  version: z.number().int(),
  reason: z.string().min(1).optional(),
  documentTypes: z.array(z.string()).optional(),
  expiresAt: z.string().datetime().optional().nullable(),
  isActive: z.boolean().optional(),
});

export const PUT = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const id = req.nextUrl.pathname.split('/').pop()!;
      const body = await req.json();
      const parsed = updateDelegationSchema.parse(body);

      const { version, ...updates } = parsed;

      const existing = await prisma.imdadApprovalDelegation.findFirst({
        where: { id, tenantId, isDeleted: false },
      });

      if (!existing) {
        return NextResponse.json({ error: 'Delegation not found' }, { status: 404 });
      }

      if (existing.version !== version) {
        return NextResponse.json(
          { error: 'Conflict — delegation was modified by another user. Please refresh and try again.' },
          { status: 409 }
        );
      }

      const updateData: any = {
        ...updates,
        version: { increment: 1 },
      };

      if (updates.expiresAt !== undefined) {
        updateData.validUntil = updates.expiresAt ? new Date(updates.expiresAt) : null;
        delete updateData.expiresAt;
      }

      const delegation = await prisma.imdadApprovalDelegation.update({
        where: { id },
        data: updateData,
      });

      await imdadAudit.log({
        tenantId,
        organizationId: existing.organizationId || undefined,
        actorUserId: userId,
        actorRole: role,
        action: 'UPDATE',
        resourceType: 'approval_delegation',
        resourceId: id,
        boundedContext: 'BC8_APPROVAL',
        previousData: existing as any,
        newData: delegation as any,
        request: req,
      });

      return NextResponse.json({ data: delegation });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.approval.delegations.manage' }
);

// ---------------------------------------------------------------------------
// DELETE — Revoke delegation (soft delete)
// ---------------------------------------------------------------------------

export const DELETE = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const id = req.nextUrl.pathname.split('/').pop()!;

      const existing = await prisma.imdadApprovalDelegation.findFirst({
        where: { id, tenantId, isDeleted: false },
      });

      if (!existing) {
        return NextResponse.json({ error: 'Delegation not found' }, { status: 404 });
      }

      await prisma.imdadApprovalDelegation.update({
        where: { id },
        data: {
          isDeleted: true,
          isActive: false,
          version: { increment: 1 },
        },
      });

      await imdadAudit.log({
        tenantId,
        organizationId: existing.organizationId || undefined,
        actorUserId: userId,
        actorRole: role,
        action: 'DELETE',
        resourceType: 'approval_delegation',
        resourceId: id,
        boundedContext: 'BC8_APPROVAL',
        previousData: existing as any,
        request: req,
      });

      return NextResponse.json({ success: true });
    } catch (error) {
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.approval.delegations.manage' }
);
