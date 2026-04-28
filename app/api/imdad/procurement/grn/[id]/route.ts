/**
 * SCM BC3 Procurement — Single Goods Receiving Note
 *
 * GET   /api/imdad/procurement/grn/:id — Get GRN with lines & discrepancies
 * PATCH /api/imdad/procurement/grn/:id — Status transitions (receive/verify/complete)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';
import { stockMutate } from '@/lib/imdad/stockMutate';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET — Single GRN with lines and discrepancies
// ---------------------------------------------------------------------------

export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    try {
      const id = req.nextUrl.pathname.split('/').pop()!;

      const grn = await prisma.imdadGoodsReceivingNote.findFirst({
        where: { id, tenantId, isDeleted: false },
        include: {
          lines: true,
          discrepancies: true,
          purchaseOrder: { select: { id: true, poNumber: true, vendorId: true } },
        } as any,
      });

      if (!grn) {
        return NextResponse.json({ error: 'GRN not found' }, { status: 404 });
      }

      return NextResponse.json({ data: grn });
    } catch (error) {
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.procurement.view' }
);

// ---------------------------------------------------------------------------
// PATCH — Status transitions (receive / verify / complete)
// ---------------------------------------------------------------------------

const receivedLineSchema = z.object({
  lineId: z.string().uuid(),
  receivedQuantity: z.number().nonnegative(),
  acceptedQuantity: z.number().nonnegative().optional(),
  rejectedQuantity: z.number().nonnegative().optional(),
  rejectionReason: z.string().optional(),
  batchNumber: z.string().optional(),
  expiryDate: z.string().optional(),
});

const patchSchema = z.object({
  action: z.enum(['receive', 'verify', 'complete']),
  version: z.number().int(),
  lines: z.array(receivedLineSchema).optional(),
  notes: z.string().optional(),
});

export const PATCH = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const id = req.nextUrl.pathname.split('/').pop()!;
      const body = await req.json();
      const parsed = patchSchema.parse(body);

      const existing = await prisma.imdadGoodsReceivingNote.findFirst({
        where: { id, tenantId, isDeleted: false },
        include: { lines: true } as any,
      });

      if (!existing) {
        return NextResponse.json({ error: 'GRN not found' }, { status: 404 });
      }

      if (existing.version !== parsed.version) {
        return NextResponse.json(
          { error: 'Conflict', message: 'Record was modified by another user. Please refresh and try again.' },
          { status: 409 }
        );
      }

      // --- RECEIVE: DRAFT → RECEIVED ---
      if (parsed.action === 'receive') {
        if (existing.status !== 'DRAFT') {
          return NextResponse.json(
            { error: `Cannot receive — current status is ${existing.status}, expected DRAFT` },
            { status: 400 }
          );
        }

        if (!parsed.lines || parsed.lines.length === 0) {
          return NextResponse.json(
            { error: 'lines with received quantities are required for receive action' },
            { status: 400 }
          );
        }

        const grn = await prisma.$transaction(async (tx) => {
          // Update each line with received quantities
          for (const line of parsed.lines!) {
            await tx.imdadGoodsReceivingNoteLine.update({
              where: { id: line.lineId },
              data: {
                receivedQty: line.receivedQuantity as any,
                acceptedQty: line.acceptedQuantity,
                rejectedQty: line.rejectedQuantity,
                batchNumber: line.batchNumber,
                expiryDate: line.expiryDate ? new Date(line.expiryDate) : undefined,
              } as any,
            });
          }

          return tx.imdadGoodsReceivingNote.update({
            where: { id },
            data: {
              status: 'PENDING_QC' as any,
              receivedAt: new Date(),
              receivedBy: userId,
              notes: parsed.notes || existing.notes,
              version: { increment: 1 },
            } as any,
            include: { lines: true } as any,
          });
        });

        await imdadAudit.log({
          tenantId,
          organizationId: existing.organizationId || undefined,
          actorUserId: userId,
          actorRole: role,
          action: 'RECEIVE',
          resourceType: 'goods_receiving_note',
          resourceId: id,
          boundedContext: 'BC3_PROCUREMENT',
          previousData: { status: existing.status },
          newData: { status: 'RECEIVED', receivedBy: userId },
          request: req,
        });

        // Auto-create quality inspection for received GRN
        try {
          const inspectionCounter = await prisma.imdadSequenceCounter.upsert({
            where: {
              tenantId_organizationId_sequenceType_fiscalYear: {
                tenantId,
                organizationId: existing.organizationId!,
                sequenceType: 'QI',
                fiscalYear: new Date().getFullYear(),
              },
            },
            create: {
              tenantId,
              organizationId: existing.organizationId!,
              sequenceType: 'QI',
              prefix: 'QI-',
              currentValue: 1,
              fiscalYear: new Date().getFullYear(),
            } as any,
            update: { currentValue: { increment: 1 } },
          });

          const inspectionNumber = `${inspectionCounter.prefix}${new Date().getFullYear()}-${String(inspectionCounter.currentValue).padStart(6, '0')}`;

          await prisma.imdadQualityInspection.create({
            data: {
              tenantId,
              organizationId: existing.organizationId!,
              inspectionNumber,
              inspectionType: 'RECEIVING' as any,
              referenceType: 'goods_receiving_note',
              referenceId: id,
              status: 'SCHEDULED' as any,
              notes: `Auto-created from GRN ${existing.grnNumber} receive`,
              createdBy: userId,
              updatedBy: userId,
            } as any,
          });
        } catch {
          // Non-critical — inspection creation failure should not block GRN receive
        }

        return NextResponse.json({ data: grn });
      }

      // --- VERIFY: RECEIVED → VERIFIED (four-eyes principle) ---
      if (parsed.action === 'verify') {
        if (existing.status !== 'PENDING_QC' && (existing.status as string) !== 'RECEIVED') {
          return NextResponse.json(
            { error: `Cannot verify — current status is ${existing.status}, expected PENDING_QC` },
            { status: 400 }
          );
        }

        // Four-eyes principle: verifier must differ from receiver
        if (existing.receivedBy === userId) {
          return NextResponse.json(
            { error: 'Four-eyes principle violation — verifier must be a different user than the receiver' },
            { status: 403 }
          );
        }

        const grn = await prisma.imdadGoodsReceivingNote.update({
          where: { id },
          data: {
            status: 'ACCEPTED' as any,
            verifiedAt: new Date(),
            verifiedBy: userId,
            notes: parsed.notes || existing.notes,
            version: { increment: 1 },
          } as any,
          include: { lines: true } as any,
        });

        await imdadAudit.log({
          tenantId,
          organizationId: existing.organizationId || undefined,
          actorUserId: userId,
          actorRole: role,
          action: 'APPROVE',
          resourceType: 'goods_receiving_note',
          resourceId: id,
          boundedContext: 'BC3_PROCUREMENT',
          previousData: { status: existing.status },
          newData: { status: 'VERIFIED', verifiedBy: userId },
          request: req,
        });

        return NextResponse.json({ data: grn });
      }

      // --- COMPLETE: VERIFIED → COMPLETED (trigger stock update) ---
      if (parsed.action === 'complete') {
        if (existing.status !== 'ACCEPTED' && (existing.status as string) !== 'VERIFIED') {
          return NextResponse.json(
            { error: `Cannot complete — current status is ${existing.status}, expected ACCEPTED` },
            { status: 400 }
          );
        }

        // Process stock updates for each accepted line
        const stockErrors: string[] = [];
        for (const line of (existing as any).lines) {
          const qty = (line as any).acceptedQuantity ?? (line as any).receivedQuantity ?? 0;
          if (qty <= 0) continue;

          const locationId = (line as any).locationId || (existing as any).receivingLocationId;
          if (!locationId) {
            stockErrors.push(`Line ${(line as any).lineNumber}: no locationId for stock update`);
            continue;
          }

          const result = await stockMutate({
            tenantId,
            organizationId: existing.organizationId!,
            itemId: (line as any).itemId,
            locationId,
            delta: Math.round(qty),
            reason: `GRN ${existing.grnNumber} completed`,
            userId,
            referenceType: 'goods_receiving_note',
            referenceId: id,
            batchNumber: (line as any).batchNumber || undefined,
            expiryDate: (line as any).expiryDate || undefined,
          });

          if (!result.success) {
            stockErrors.push(`Line ${(line as any).lineNumber}: ${result.error}`);
          }
        }

        if (stockErrors.length > 0) {
          return NextResponse.json(
            { error: 'Stock update failed for some lines', details: stockErrors },
            { status: 400 }
          );
        }

        const grn = await prisma.imdadGoodsReceivingNote.update({
          where: { id },
          data: {
            status: 'COMPLETED' as any,
            completedAt: new Date(),
            completedBy: userId,
            notes: parsed.notes || existing.notes,
            version: { increment: 1 },
          } as any,
          include: { lines: true } as any,
        });

        await imdadAudit.log({
          tenantId,
          organizationId: existing.organizationId || undefined,
          actorUserId: userId,
          actorRole: role,
          action: 'COMPLETE',
          resourceType: 'goods_receiving_note',
          resourceId: id,
          boundedContext: 'BC3_PROCUREMENT',
          previousData: { status: existing.status },
          newData: { status: 'COMPLETED', completedBy: userId },
          request: req,
        });

        return NextResponse.json({ data: grn });
      }

      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.procurement.grn.receive' }
);
