/**
 * SCM Approval — Delegations
 *
 * GET  /api/imdad/approval/delegations — List delegation records
 * POST /api/imdad/approval/delegations — Create a delegation
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET — List delegations
// ---------------------------------------------------------------------------

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  fromUserId: z.string().uuid().optional(),
  toUserId: z.string().uuid().optional(),
  isActive: z.coerce.boolean().optional(),
});

export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    try {
      const url = new URL(req.url);
      const params: Record<string, string> = {};
      url.searchParams.forEach((v, k) => { params[k] = v; });

      const parsed = listQuerySchema.parse(params);
      const { page, limit, fromUserId, toUserId, isActive } = parsed;

      const where: any = { tenantId, isDeleted: false };
      if (fromUserId) where.delegatorUserId = fromUserId;
      if (toUserId) where.delegateUserId = toUserId;
      if (isActive !== undefined) where.isActive = isActive;

      const [data, total] = await Promise.all([
        prisma.imdadApprovalDelegation.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.imdadApprovalDelegation.count({ where }),
      ]);

      return NextResponse.json({ data, total, page, limit, totalPages: Math.ceil(total / limit) });
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
// POST — Create delegation
// ---------------------------------------------------------------------------

const createDelegationSchema = z.object({
  fromUserId: z.string().uuid(),
  toUserId: z.string().uuid(),
  reason: z.string().min(1),
  documentTypes: z.array(z.string()).optional(),
  organizationId: z.string().uuid().optional(),
  expiresAt: z.string().datetime().optional(),
});

export const POST = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const body = await req.json();
      const parsed = createDelegationSchema.parse(body);

      if (parsed.fromUserId === parsed.toUserId) {
        return NextResponse.json(
          { error: 'Cannot delegate to yourself' },
          { status: 400 }
        );
      }

      // Check for existing active delegation
      const existing = await prisma.imdadApprovalDelegation.findFirst({
        where: {
          tenantId,
          delegatorUserId: parsed.fromUserId,
          delegateUserId: parsed.toUserId,
          isActive: true,
          isDeleted: false,
        },
      });

      if (existing) {
        return NextResponse.json(
          { error: 'An active delegation already exists between these users' },
          { status: 409 }
        );
      }

      const delegation = await prisma.imdadApprovalDelegation.create({
        data: {
          tenantId,
          delegatorUserId: parsed.fromUserId,
          delegateUserId: parsed.toUserId,
          reason: parsed.reason,
          documentTypes: parsed.documentTypes || [],
          organizationId: parsed.organizationId,
          validUntil: parsed.expiresAt ? new Date(parsed.expiresAt) : null,
          isActive: true,
          createdBy: userId,
        } as any,
      });

      await imdadAudit.log({
        tenantId,
        organizationId: parsed.organizationId,
        actorUserId: userId,
        actorRole: role,
        action: 'CREATE',
        resourceType: 'approval_delegation',
        resourceId: delegation.id,
        boundedContext: 'BC8_APPROVAL',
        metadata: {
          fromUserId: parsed.fromUserId,
          toUserId: parsed.toUserId,
          reason: parsed.reason,
        },
        request: req,
      });

      return NextResponse.json({ data: delegation }, { status: 201 });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.approval.delegations.manage' }
);
