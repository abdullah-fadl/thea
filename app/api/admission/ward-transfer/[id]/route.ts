import { logger } from '@/lib/monitoring/logger';
import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { updateWardTransferSchema } from '@/lib/validation/admission.schema';
import { emitNotification } from '@/lib/notifications/emit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** Template item shape from AdmissionOrderTemplate.items JSON */
interface OrderTemplateItem {
  kind?: string;
  orderName?: string;
  orderNameAr?: string;
  defaults?: { notes?: string };
}

// ─── PATCH /api/admission/ward-transfer/[id] ─────────────────────────────────
export const PATCH = withAuthTenant(
  async (req: NextRequest, { tenantId, userId }: { tenantId: string; userId: string }) => {
    try {
      const id = req.nextUrl.pathname.split('/').at(-1) || '';

      const body = await req.json();
      const parsed = updateWardTransferSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
          { status: 400 }
        );
      }

      const { action, toBedId, transferSummary, nursingHandoff, rejectionReason, orderTemplateId, applyOrderTemplate } = parsed.data;

      // 1. Fetch transfer
      const transfer = await prisma.wardTransferRequest.findFirst({
        where: { tenantId, id },
      });
      if (!transfer) {
        return NextResponse.json({ error: 'Transfer request not found' }, { status: 404 });
      }

      const now = new Date();
      let updates: any = {};

      switch (action) {
        // ── Approve ────────────────────────────────────────────────────────────
        case 'approve': {
          if (transfer.status !== 'REQUESTED') {
            return NextResponse.json(
              { error: `Cannot approve transfer with status '${transfer.status}'` },
              { status: 409 }
            );
          }
          updates = {
            status: 'APPROVED',
            approvedBy: userId,
            approvedAt: now,
          };

          // Notify requesting doctor that transfer was approved
          try {
            await emitNotification({
              tenantId,
              recipientUserId: transfer.requestedBy,
              scope: 'IPD',
              kind: 'TRANSFER_APPROVED',
              severity: 'INFO',
              title: `Transfer Approved: ${transfer.patientName}`,
              message: `${transfer.transferType === 'ESCALATION' ? 'ICU escalation' : 'Ward transfer'} request has been approved.`,
              entity: {
                type: 'ward_transfer',
                id: transfer.id,
                patientMasterId: transfer.patientMasterId,
                link: '/admission-office?tab=transfers',
              },
              dedupeKey: `transfer-approved-${transfer.id}`,
              actorUserId: userId,
            });
          } catch { /* non-fatal */ }
          break;
        }

        // ── Reject (NEW) ─────────────────────────────────────────────────────
        case 'reject': {
          if (transfer.status !== 'REQUESTED') {
            return NextResponse.json(
              { error: `Cannot reject transfer with status '${transfer.status}'` },
              { status: 409 }
            );
          }
          updates = {
            status: 'REJECTED',
            rejectedBy: userId,
            rejectedAt: now,
            rejectionReason: rejectionReason || null,
          };

          // Notify the requesting doctor
          try {
            await emitNotification({
              tenantId,
              recipientUserId: transfer.requestedBy,
              scope: 'IPD',
              kind: 'TRANSFER_REJECTED',
              severity: 'WARN',
              title: `Transfer Rejected: ${transfer.patientName}`,
              message: `${transfer.transferType === 'ESCALATION' ? 'ICU escalation' : 'Ward transfer'} request was rejected. ${rejectionReason ? `Reason: ${rejectionReason}` : ''}`,
              entity: {
                type: 'ward_transfer',
                id: transfer.id,
                patientMasterId: transfer.patientMasterId,
                link: '/admission-office?tab=transfers',
              },
              dedupeKey: `transfer-rejected-${transfer.id}`,
              actorUserId: userId,
            });
          } catch { /* non-fatal */ }
          break;
        }

        // ── Assign Bed ─────────────────────────────────────────────────────────
        case 'assign_bed': {
          if (transfer.status !== 'APPROVED' && transfer.status !== 'REQUESTED') {
            return NextResponse.json(
              { error: `Cannot assign bed for transfer with status '${transfer.status}'` },
              { status: 409 }
            );
          }
          if (!toBedId) {
            return NextResponse.json({ error: 'toBedId is required' }, { status: 400 });
          }

          // Validate bed is available
          const bed = await prisma.ipdBed.findFirst({
            where: { tenantId, id: toBedId, isActive: true },
          });
          if (!bed) {
            return NextResponse.json({ error: 'Target bed not found or inactive' }, { status: 404 });
          }

          const occupant = await prisma.ipdAdmission.findFirst({
            where: { tenantId, bedId: toBedId, isActive: true, releasedAt: null },
          });
          if (occupant) {
            return NextResponse.json({ error: 'Target bed is occupied' }, { status: 409 });
          }

          updates = {
            status: 'BED_ASSIGNED',
            toBedId,
            approvedBy: transfer.approvedBy || userId,
            approvedAt: transfer.approvedAt || now,
          };
          break;
        }

        // ── Complete ───────────────────────────────────────────────────────────
        case 'complete': {
          if (transfer.status !== 'BED_ASSIGNED' && transfer.status !== 'APPROVED') {
            return NextResponse.json(
              { error: `Cannot complete transfer with status '${transfer.status}'` },
              { status: 409 }
            );
          }

          const targetBedId = toBedId || transfer.toBedId;
          if (!targetBedId) {
            return NextResponse.json(
              { error: 'Target bed must be assigned before completing transfer' },
              { status: 400 }
            );
          }

          // Validate target bed
          const targetBed = await prisma.ipdBed.findFirst({
            where: { tenantId, id: targetBedId, isActive: true },
          });
          if (!targetBed) {
            return NextResponse.json({ error: 'Target bed not found or inactive' }, { status: 404 });
          }

          // Check target bed not occupied
          const targetOccupant = await prisma.ipdAdmission.findFirst({
            where: { tenantId, bedId: targetBedId, isActive: true, releasedAt: null },
          });
          if (targetOccupant) {
            return NextResponse.json({ error: 'Target bed is now occupied' }, { status: 409 });
          }

          // Release old bed
          const oldAdmission = await prisma.ipdAdmission.findFirst({
            where: { tenantId, episodeId: transfer.episodeId, isActive: true, releasedAt: null },
          });
          if (oldAdmission) {
            await prisma.ipdAdmission.update({
              where: { id: oldAdmission.id },
              data: {
                releasedAt: now,
                releasedByUserId: userId,
                isActive: false,
              },
            });
          }

          // Assign new bed
          const episode = await prisma.ipdEpisode.findFirst({
            where: { tenantId, id: transfer.episodeId },
          });

          await prisma.ipdAdmission.create({
            data: {
              tenantId,
              episodeId: transfer.episodeId,
              encounterId: episode?.encounterId || null,
              patientMasterId: transfer.patientMasterId,
              bedId: targetBedId,
              patientName: transfer.patientName,
              admissionDate: now,
              doctorName: null,
              diagnosis: null,
              assignedAt: now,
              assignedByUserId: userId,
              isActive: true,
            },
          });

          // Update episode location
          const newLocation = {
            ward: targetBed.ward || targetBed.departmentName || null,
            unit: targetBed.unit || null,
            room: targetBed.room || null,
            bed: targetBed.bedLabel || targetBed.label || null,
          };
          await prisma.ipdEpisode.update({
            where: { id: transfer.episodeId },
            data: {
              location: newLocation,
              serviceUnit: targetBed.ward || targetBed.departmentName || episode?.serviceUnit,
            },
          });

          // ── ICU Integration: Create IpdIcuEvent ──────────────────────────
          let icuEventId: string | null = null;
          if (transfer.transferType === 'ESCALATION') {
            try {
              const icuEvent = await prisma.ipdIcuEvent.create({
                data: {
                  tenantId,
                  episodeId: transfer.episodeId,
                  encounterCoreId: episode?.encounterId || null,
                  type: 'ADMIT',
                  destination: transfer.targetUnitType || 'ICU',
                  source: transfer.fromUnit || transfer.fromWard || 'IPD',
                  note: `Ward transfer escalation: ${transfer.reason}`,
                  createdByUserId: userId,
                  createdAt: now,
                },
              });
              icuEventId = icuEvent.id;
            } catch (icuErr) {
              logger.warn('[ward-transfer/complete] ICU event creation error (non-fatal):', icuErr);
            }
          } else if (transfer.transferType === 'STEP_DOWN') {
            try {
              const icuEvent = await prisma.ipdIcuEvent.create({
                data: {
                  tenantId,
                  episodeId: transfer.episodeId,
                  encounterCoreId: episode?.encounterId || null,
                  type: 'TRANSFER',
                  destination: 'WARD',
                  source: transfer.fromUnit || 'ICU',
                  note: `Step-down transfer: ${transfer.reason}`,
                  createdByUserId: userId,
                  createdAt: now,
                },
              });
              icuEventId = icuEvent.id;
            } catch (icuErr) {
              logger.warn('[ward-transfer/complete] ICU event creation error (non-fatal):', icuErr);
            }
          }

          // ── Apply Order Template (if requested) ──────────────────────────
          let ordersApplied: Array<{ orderId: string; title: string; kind: string }> = [];
          const templateId = applyOrderTemplate ? (orderTemplateId || transfer.orderTemplateId) : null;
          if (templateId) {
            try {
              const template = await prisma.admissionOrderTemplate.findFirst({
                where: { tenantId, id: templateId, isActive: true },
              });
              if (template) {
                const templateItems = Array.isArray(template.items) ? template.items as OrderTemplateItem[] : [];
                for (const item of templateItems) {
                  try {
                    const order = await prisma.ipdOrder.create({
                      data: {
                        tenantId,
                        episodeId: transfer.episodeId,
                        encounterId: episode?.encounterId || null,
                        kind: item.kind || 'LAB',
                        title: item.orderName || item.orderNameAr || '',
                        notes: item.defaults?.notes || null,
                        status: 'ORDERED',
                        createdByUserId: userId,
                      },
                    });
                    ordersApplied.push({ orderId: order.id, title: order.title, kind: order.kind });
                  } catch { /* continue with other orders */ }
                }
              }
            } catch (templateErr) {
              logger.warn('[ward-transfer/complete] Order template error (non-fatal):', templateErr);
            }
          }

          updates = {
            status: 'COMPLETED',
            toBedId: targetBedId,
            completedBy: userId,
            completedAt: now,
            transferSummary: transferSummary || null,
            nursingHandoff: nursingHandoff || null,
            icuEventId,
            orderTemplateId: templateId,
            ordersApplied: ordersApplied.length > 0 ? ordersApplied : null,
          };
          break;
        }

        // ── Cancel ─────────────────────────────────────────────────────────────
        case 'cancel': {
          if (transfer.status === 'COMPLETED' || transfer.status === 'CANCELLED' || transfer.status === 'REJECTED') {
            return NextResponse.json(
              { error: `Cannot cancel transfer with status '${transfer.status}'` },
              { status: 409 }
            );
          }
          updates = { status: 'CANCELLED' };
          break;
        }

        default:
          return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
      }

      const updated = await prisma.wardTransferRequest.update({
        where: { id },
        data: updates,
      });

      return NextResponse.json({ success: true, transfer: updated });
    } catch (err) {
      logger.error('[admission/ward-transfer/[id]] PATCH error:', err);
      return NextResponse.json({ error: 'Failed to update transfer' }, { status: 500 });
    }
  },
  { permissionKey: 'admission.approve_transfer' }
);
