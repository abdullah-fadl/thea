/**
 * SCM BC3 Procurement — Single Contract
 *
 * GET   /api/imdad/procurement/contracts/:id — Get contract with lines & amendments
 * PUT   /api/imdad/procurement/contracts/:id — Update contract (DRAFT only)
 * PATCH /api/imdad/procurement/contracts/:id — Status transitions (activate/suspend/terminate)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET — Single contract with lines and amendments
// ---------------------------------------------------------------------------

export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    try {
      const id = req.nextUrl.pathname.split('/').pop()!;

      const contract = await prisma.imdadContract.findFirst({
        where: { id, tenantId, isDeleted: false },
        include: {
          lines: true,
          amendments: { orderBy: { createdAt: 'desc' } },
          vendor: { select: { id: true, name: true, code: true } },
        } as any,
      });

      if (!contract) {
        return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
      }

      return NextResponse.json({ data: contract });
    } catch (error) {
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.procurement.view' }
);

// ---------------------------------------------------------------------------
// PUT — Update contract (DRAFT only, optimistic locking)
// ---------------------------------------------------------------------------

const contractLineSchema = z.object({
  id: z.string().uuid().optional(),
  itemId: z.string().uuid(),
  itemCode: z.string().optional(),
  itemName: z.string().min(1),
  quantity: z.number().positive(),
  unitOfMeasure: z.string().min(1),
  unitPrice: z.number().nonnegative(),
  notes: z.string().optional(),
});

const updateContractSchema = z.object({
  version: z.number().int(),
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  contractType: z.string().optional(),
  vendorId: z.string().uuid().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  currency: z.string().optional(),
  paymentTerms: z.string().optional(),
  autoRenew: z.boolean().optional(),
  renewalNoticeDays: z.number().int().nonnegative().optional(),
  notes: z.string().optional(),
  lines: z.array(contractLineSchema).optional(),
});

export const PUT = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const id = req.nextUrl.pathname.split('/').pop()!;
      const body = await req.json();
      const parsed = updateContractSchema.parse(body);

      const existing = await prisma.imdadContract.findFirst({
        where: { id, tenantId, isDeleted: false },
        include: { lines: true } as any,
      });

      if (!existing) {
        return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
      }

      if (existing.status !== 'DRAFT') {
        return NextResponse.json(
          { error: 'Only DRAFT contracts can be updated' },
          { status: 400 }
        );
      }

      if (existing.version !== parsed.version) {
        return NextResponse.json(
          { error: 'Conflict — contract was modified by another user. Please refresh and try again.' },
          { status: 409 }
        );
      }

      const { version, lines, startDate, endDate, ...updates } = parsed;

      const contract = await prisma.$transaction(async (tx) => {
        let totalValue: number | undefined;

        if (lines) {
          await tx.imdadContractLine.deleteMany({
            where: { contractId: id },
          });

          await tx.imdadContractLine.createMany({
            data: lines.map((line, idx) => ({
              tenantId,
              organizationId: existing.organizationId,
              contractId: id,
              lineNumber: idx + 1,
              itemId: line.itemId,
              unitPrice: line.unitPrice,
            })) as any,
          });

          totalValue = lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);
        }

        return tx.imdadContract.update({
          where: { id },
          data: {
            ...updates,
            ...(startDate ? { startDate: new Date(startDate) } : {}),
            ...(endDate ? { endDate: new Date(endDate) } : {}),
            ...(totalValue !== undefined ? { value: totalValue } : {}),
            version: { increment: 1 },
            updatedBy: userId,
          } as any,
          include: { lines: true } as any,
        });
      });

      await imdadAudit.log({
        tenantId,
        organizationId: existing.organizationId || undefined,
        actorUserId: userId,
        actorRole: role,
        action: 'UPDATE',
        resourceType: 'contract',
        resourceId: id,
        boundedContext: 'BC3_PROCUREMENT',
        previousData: existing as any,
        newData: contract as any,
        request: req,
      });

      return NextResponse.json({ data: contract });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.procurement.contract.edit' }
);

// ---------------------------------------------------------------------------
// PATCH — Status transitions (activate / suspend / terminate)
// ---------------------------------------------------------------------------

const patchSchema = z.object({
  action: z.enum(['activate', 'suspend', 'terminate']),
  version: z.number().int(),
  terminationReason: z.string().optional(),
});

const VALID_TRANSITIONS: Record<string, { from: string[]; to: string }> = {
  activate:  { from: ['DRAFT', 'APPROVED'], to: 'ACTIVE' },
  suspend:   { from: ['ACTIVE'], to: 'SUSPENDED' },
  terminate: { from: ['DRAFT', 'APPROVED', 'ACTIVE', 'SUSPENDED'], to: 'TERMINATED' },
};

export const PATCH = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const id = req.nextUrl.pathname.split('/').pop()!;
      const body = await req.json();
      const parsed = patchSchema.parse(body);

      const existing = await prisma.imdadContract.findFirst({
        where: { id, tenantId, isDeleted: false },
      });

      if (!existing) {
        return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
      }

      if (existing.version !== parsed.version) {
        return NextResponse.json(
          { error: 'Conflict', message: 'Record was modified by another user. Please refresh and try again.' },
          { status: 409 }
        );
      }

      const transition = VALID_TRANSITIONS[parsed.action];
      if (!transition.from.includes(existing.status)) {
        return NextResponse.json(
          { error: `Cannot ${parsed.action} — current status is ${existing.status}, expected one of: ${transition.from.join(', ')}` },
          { status: 400 }
        );
      }

      if (parsed.action === 'terminate' && !parsed.terminationReason) {
        return NextResponse.json(
          { error: 'terminationReason is required when terminating a contract' },
          { status: 400 }
        );
      }

      const updateData: any = {
        status: transition.to,
        version: { increment: 1 },
        updatedBy: userId,
      };

      if (parsed.action === 'activate') {
        updateData.activatedAt = new Date();
        updateData.activatedBy = userId;
      } else if (parsed.action === 'suspend') {
        updateData.suspendedAt = new Date();
        updateData.suspendedBy = userId;
      } else if (parsed.action === 'terminate') {
        updateData.terminatedAt = new Date();
        updateData.terminatedBy = userId;
        updateData.terminationReason = parsed.terminationReason;
      }

      const contract = await prisma.imdadContract.update({
        where: { id },
        data: updateData as any,
        include: { lines: true } as any,
      });

      const auditActionMap: Record<string, 'APPROVE' | 'UPDATE'> = {
        activate: 'APPROVE',
        suspend: 'UPDATE',
        terminate: 'UPDATE',
      };

      await imdadAudit.log({
        tenantId,
        organizationId: existing.organizationId || undefined,
        actorUserId: userId,
        actorRole: role,
        action: auditActionMap[parsed.action],
        resourceType: 'contract',
        resourceId: id,
        boundedContext: 'BC3_PROCUREMENT',
        previousData: { status: existing.status },
        newData: { status: contract.status, action: parsed.action },
        request: req,
      });

      return NextResponse.json({ data: contract });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.procurement.contract.manage' }
);
