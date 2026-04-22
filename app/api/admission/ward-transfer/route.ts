import { logger } from '@/lib/monitoring/logger';
import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { createWardTransferSchema } from '@/lib/validation/admission.schema';
import { emitNotificationToRole } from '@/lib/notifications/emit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Prisma delegate for models not yet in schema
const db = prisma as unknown as Record<string, {
  findMany: (args?: unknown) => Promise<any[]>;
  findFirst: (args?: unknown) => Promise<any | null>;
  create: (args?: unknown) => Promise<any>;
  count: (args?: unknown) => Promise<number>;
}>;

// ─── GET /api/admission/ward-transfer ────────────────────────────────────────
export const GET = withAuthTenant(
  async (req: NextRequest, { tenantId }: { tenantId: string }) => {
    try {
      const url = req.nextUrl;
      const status = url.searchParams.get('status');
      const episodeId = url.searchParams.get('episodeId');
      const ward = url.searchParams.get('ward');
      const transferType = url.searchParams.get('transferType');
      const urgency = url.searchParams.get('urgency');
      const targetUnitType = url.searchParams.get('targetUnitType');

      const where: Record<string, unknown> = { tenantId };
      if (status && status !== 'ALL') where.status = status;
      if (episodeId) where.episodeId = episodeId;
      if (transferType && transferType !== 'ALL') where.transferType = transferType;
      if (urgency && urgency !== 'ALL') where.urgency = urgency;
      if (targetUnitType) where.targetUnitType = targetUnitType;
      if (ward) {
        where.OR = [{ fromWard: ward }, { toWard: ward }];
      }

      const items = await db.wardTransferRequest.findMany({
        where,
        orderBy: [{ urgency: 'desc' }, { requestedAt: 'desc' }],
        take: 100,
      });

      const total = await db.wardTransferRequest.count({ where });

      return NextResponse.json({ items, total });
    } catch (err) {
      logger.error('[admission/ward-transfer] GET error:', err);
      return NextResponse.json({ error: 'Failed to fetch transfers' }, { status: 500 });
    }
  },
  { permissionKey: 'admission.view' }
);

// ─── POST /api/admission/ward-transfer ───────────────────────────────────────
export const POST = withAuthTenant(
  async (req: NextRequest, { tenantId, userId, user }: any) => {
    try {
      const body = await req.json();
      const parsed = createWardTransferSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
          { status: 400 }
        );
      }

      const data = parsed.data;

      // 1. Fetch episode to get current location and patient info
      const episode = await db.ipdEpisode.findFirst({
        where: { tenantId, id: data.episodeId },
      });
      if (!episode) {
        return NextResponse.json({ error: 'IPD episode not found' }, { status: 404 });
      }
      if (episode.status !== 'ACTIVE') {
        return NextResponse.json(
          { error: 'Cannot transfer: episode is not active' },
          { status: 409 }
        );
      }

      // Extract current location
      const location = episode.location as Record<string, unknown> || {};
      const patient = episode.patient as Record<string, unknown> || {};

      // 2. Check no existing pending transfer for this episode
      const existingTransfer = await db.wardTransferRequest.findFirst({
        where: {
          tenantId,
          episodeId: data.episodeId,
          status: { in: ['REQUESTED', 'APPROVED', 'BED_ASSIGNED'] },
        },
      });
      if (existingTransfer) {
        return NextResponse.json(
          { error: 'An active transfer request already exists for this episode' },
          { status: 409 }
        );
      }

      // 3. Determine if approval is required
      const userRole = String(user?.role || '').toLowerCase();
      const isAdmin = userRole.includes('admin') || userRole.includes('chief') || userRole.includes('owner');
      const isEmergency = data.urgency === 'EMERGENCY';
      const needsApproval = !isAdmin && !isEmergency;

      // 4. Create transfer request
      const transfer = await db.wardTransferRequest.create({
        data: {
          tenantId,
          episodeId: data.episodeId,
          patientMasterId: String(patient.id || ''),
          patientName: patient.fullName || '',
          fromWard: location.ward || episode.serviceUnit || null,
          fromBed: location.bed || null,
          fromUnit: location.unit || null,
          toWard: data.toWard,
          toUnit: data.toUnit || null,
          toBedType: data.toBedType || null,
          reason: data.reason,
          clinicalJustification: data.clinicalJustification || null,
          requestedBy: userId,
          requestedAt: new Date(),
          // ── ICU/CCU Transfer Fields ──
          transferType: data.transferType || 'REGULAR',
          urgency: data.urgency || 'ROUTINE',
          targetUnitType: data.targetUnitType || null,
          requiresApproval: needsApproval,
          escalationCriteria: data.escalationCriteria || null,
          acuityData: data.acuityData || null,
          sbarData: data.sbarData || null,
          orderTemplateId: data.orderTemplateId || null,
          // Auto-approve if admin or emergency
          status: needsApproval ? 'REQUESTED' : 'APPROVED',
          approvedBy: needsApproval ? null : userId,
          approvedAt: needsApproval ? null : new Date(),
        },
      });

      // 5. Send notification for escalation transfers
      if (data.transferType === 'ESCALATION') {
        try {
          await emitNotificationToRole({
            tenantId,
            recipientRole: 'doctor',
            scope: 'IPD',
            kind: 'TRANSFER_ESCALATION',
            severity: data.urgency === 'EMERGENCY' ? 'CRITICAL' : 'WARN',
            title: `ICU Escalation: ${patient.fullName || transfer.patientName}`,
            message: `Transfer requested from ${location.ward || 'Ward'} to ${data.targetUnitType || 'ICU'}. Reason: ${data.reason}`,
            entity: {
              type: 'ward_transfer',
              id: String(transfer.id || ''),
              patientMasterId: String(patient.id || '') || null,
              link: '/admission-office?tab=transfers',
            },
            dedupeKey: `escalation-${transfer.id}`,
            actorUserId: userId,
          });
        } catch (notifErr) {
          logger.warn('[admission/ward-transfer] Notification error (non-fatal):', notifErr);
        }
      }

      return NextResponse.json({ success: true, transfer }, { status: 201 });
    } catch (err) {
      logger.error('[admission/ward-transfer] POST error:', err);
      return NextResponse.json({ error: 'Failed to create transfer request' }, { status: 500 });
    }
  },
  { permissionKey: 'admission.approve_transfer' }
);
