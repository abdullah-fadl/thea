/**
 * SCM BC7 Asset Management — Single Maintenance Order
 *
 * GET    /api/imdad/assets/maintenance/:id — Get maintenance order detail
 * PUT    /api/imdad/assets/maintenance/:id — Update maintenance order (optimistic locking)
 * PATCH  /api/imdad/assets/maintenance/:id — Status transition (SCHEDULED->IN_PROGRESS->COMPLETED)
 * DELETE /api/imdad/assets/maintenance/:id — Soft delete (only SCHEDULED orders)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET — Single maintenance order detail
// ---------------------------------------------------------------------------

export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    try {
      const id = req.nextUrl.pathname.split('/').pop()!;

      const order = await prisma.imdadMaintenanceOrder.findFirst({
        where: { id, tenantId, isDeleted: false },
      });

      if (!order) {
        return NextResponse.json({ error: 'Maintenance order not found' }, { status: 404 });
      }

      return NextResponse.json({ data: order });
    } catch (error) {
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.assets.maintenance.view' }
);

// ---------------------------------------------------------------------------
// PUT — Update maintenance order with optimistic locking
// ---------------------------------------------------------------------------

const updateMaintenanceSchema = z.object({
  version: z.number().int(),
  maintenanceType: z.string().optional(),
  priority: z.string().optional(),
  scheduledDate: z.string().optional(),
  description: z.string().optional(),
  descriptionAr: z.string().optional(),
  assignedTo: z.string().uuid().optional(),
  assignedTeam: z.string().optional(),
  externalVendorId: z.string().uuid().optional(),
  externalVendorName: z.string().optional(),
  followUpRequired: z.boolean().optional(),
  followUpNotes: z.string().optional(),
  notes: z.string().optional(),
});

export const PUT = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const id = req.nextUrl.pathname.split('/').pop()!;
      const body = await req.json();
      const parsed = updateMaintenanceSchema.parse(body);

      const { version, scheduledDate, ...updates } = parsed;

      const existing = await prisma.imdadMaintenanceOrder.findFirst({
        where: { id, tenantId, isDeleted: false },
      });

      if (!existing) {
        return NextResponse.json({ error: 'Maintenance order not found' }, { status: 404 });
      }

      if (existing.version !== version) {
        return NextResponse.json(
          { error: 'Conflict — maintenance order was modified by another user. Please refresh and try again.' },
          { status: 409 }
        );
      }

      const order = await prisma.imdadMaintenanceOrder.update({
        where: { id },
        data: {
          ...updates,
          scheduledDate: scheduledDate ? new Date(scheduledDate) : undefined,
          version: { increment: 1 },
          updatedBy: userId,
        } as any,
      });

      await imdadAudit.log({
        tenantId,
        organizationId: existing.organizationId || undefined,
        actorUserId: userId,
        actorRole: role,
        action: 'UPDATE',
        resourceType: 'MAINTENANCE_ORDER',
        resourceId: id,
        boundedContext: 'BC7_ASSETS',
        previousData: existing as any,
        newData: order as any,
        request: req,
      });

      return NextResponse.json({ data: order });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.assets.maintenance.update' }
);

// ---------------------------------------------------------------------------
// PATCH — Status transition
// Allowed flows: SCHEDULED -> IN_PROGRESS -> COMPLETED
// On completion: update parent asset maintenance/calibration dates
// ---------------------------------------------------------------------------

const statusTransitionSchema = z.object({
  version: z.number().int(),
  status: z.enum(['IN_PROGRESS', 'COMPLETED']),
  resultStatus: z.string().optional(),
  completedAt: z.string().optional(),
  laborCost: z.string().optional(),
  partsCost: z.string().optional(),
  externalCost: z.string().optional(),
  totalCost: z.string().optional(),
  laborHours: z.string().optional(),
  downtimeHours: z.string().optional(),
  findings: z.string().optional(),
  workPerformed: z.string().optional(),
  notes: z.string().optional(),
  nextMaintenanceDate: z.string().optional(),
  nextCalibrationDate: z.string().optional(),
});

const VALID_TRANSITIONS: Record<string, string[]> = {
  SCHEDULED: ['IN_PROGRESS'],
  IN_PROGRESS: ['COMPLETED'],
};

export const PATCH = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const id = req.nextUrl.pathname.split('/').pop()!;
      const body = await req.json();
      const parsed = statusTransitionSchema.parse(body);

      const existing = await prisma.imdadMaintenanceOrder.findFirst({
        where: { id, tenantId, isDeleted: false },
      });

      if (!existing) {
        return NextResponse.json({ error: 'Maintenance order not found' }, { status: 404 });
      }

      if (existing.version !== parsed.version) {
        return NextResponse.json(
          { error: 'Conflict — maintenance order was modified by another user. Please refresh and try again.' },
          { status: 409 }
        );
      }

      const allowed = VALID_TRANSITIONS[existing.status] || [];
      if (!allowed.includes(parsed.status)) {
        return NextResponse.json(
          { error: `Cannot transition from ${existing.status} to ${parsed.status}` },
          { status: 400 }
        );
      }

      const updateData: any = {
        status: parsed.status,
        version: { increment: 1 },
        updatedBy: userId,
      };

      if (parsed.resultStatus) updateData.resultStatus = parsed.resultStatus;
      if (parsed.findings) updateData.findings = parsed.findings;
      if (parsed.workPerformed) updateData.workPerformed = parsed.workPerformed;
      if (parsed.notes) updateData.notes = parsed.notes;

      if (parsed.status === 'IN_PROGRESS') {
        updateData.startedAt = new Date();
      }

      if (parsed.status === 'COMPLETED') {
        updateData.completedAt = parsed.completedAt ? new Date(parsed.completedAt) : new Date();
        if (parsed.laborCost) updateData.laborCost = parsed.laborCost;
        if (parsed.partsCost) updateData.partsCost = parsed.partsCost;
        if (parsed.externalCost) updateData.externalCost = parsed.externalCost;
        if (parsed.totalCost) updateData.totalCost = parsed.totalCost;
        if (parsed.laborHours) updateData.laborHours = parsed.laborHours;
        if (parsed.downtimeHours) updateData.downtimeHours = parsed.downtimeHours;
      }

      const order = await prisma.$transaction(async (tx) => {
        const updated = await tx.imdadMaintenanceOrder.update({
          where: { id },
          data: updateData as any,
        });

        // On completion: update the parent asset's maintenance/calibration dates
        if (parsed.status === 'COMPLETED' && existing.assetId) {
          const assetUpdate: any = {
            updatedBy: userId,
            version: { increment: 1 },
          };

          if (existing.maintenanceType === 'CALIBRATION') {
            assetUpdate.lastCalibrationDate = updated.completedAt || new Date();
            if (parsed.nextCalibrationDate) {
              assetUpdate.nextCalibrationDate = new Date(parsed.nextCalibrationDate);
            }
          } else {
            assetUpdate.lastMaintenanceDate = updated.completedAt || new Date();
            if (parsed.nextMaintenanceDate) {
              assetUpdate.nextMaintenanceDate = new Date(parsed.nextMaintenanceDate);
            }
          }

          await tx.imdadAsset.update({
            where: { id: existing.assetId },
            data: assetUpdate,
          });
        }

        return updated;
      });

      await imdadAudit.log({
        tenantId,
        organizationId: existing.organizationId || undefined,
        actorUserId: userId,
        actorRole: role,
        action: 'UPDATE',
        resourceType: 'MAINTENANCE_ORDER',
        resourceId: id,
        boundedContext: 'BC7_ASSETS',
        previousData: { status: existing.status },
        newData: { status: parsed.status, resultStatus: parsed.resultStatus },
        request: req,
      });

      return NextResponse.json({ data: order });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.assets.maintenance.update' }
);

// ---------------------------------------------------------------------------
// DELETE — Soft-delete maintenance order (only allowed for SCHEDULED orders)
// ---------------------------------------------------------------------------

const deleteMaintenanceSchema = z.object({
  version: z.number().int(),
});

export const DELETE = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const id = req.nextUrl.pathname.split('/').pop()!;
      const body = await req.json();
      const parsed = deleteMaintenanceSchema.parse(body);

      const existing = await prisma.imdadMaintenanceOrder.findFirst({
        where: { id, tenantId, isDeleted: false },
      });

      if (!existing) {
        return NextResponse.json({ error: 'Maintenance order not found' }, { status: 404 });
      }

      if (existing.status !== 'SCHEDULED') {
        return NextResponse.json(
          { error: 'Only scheduled maintenance orders can be deleted' },
          { status: 400 }
        );
      }

      if (existing.version !== parsed.version) {
        return NextResponse.json(
          { error: 'Conflict — maintenance order was modified by another user. Please refresh and try again.' },
          { status: 409 }
        );
      }

      await prisma.imdadMaintenanceOrder.update({
        where: { id },
        data: {
          isDeleted: true,
          version: { increment: 1 },
          updatedBy: userId,
        },
      });

      await imdadAudit.log({
        tenantId,
        organizationId: existing.organizationId || undefined,
        actorUserId: userId,
        actorRole: role,
        action: 'DELETE',
        resourceType: 'MAINTENANCE_ORDER',
        resourceId: id,
        boundedContext: 'BC7_ASSETS',
        previousData: existing as any,
        request: req,
      });

      return NextResponse.json({ data: { id, deleted: true } });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.assets.maintenance.update' }
);
