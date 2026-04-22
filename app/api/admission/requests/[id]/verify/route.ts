import { logger } from '@/lib/monitoring/logger';
import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { isValidTransition } from '@/lib/validation/admission.schema';
import type { ChecklistItem } from '@/lib/validation/admission.schema';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ─── POST /api/admission/requests/[id]/verify ────────────────────────────────
export const POST = withAuthTenant(
  async (req: NextRequest, { tenantId, userId }: { tenantId: string; userId: string }) => {
    try {
      const segments = req.nextUrl.pathname.split('/');
      const id = segments[segments.indexOf('requests') + 1] || '';

      // 1. Fetch request
      const request = await prisma.admissionRequest.findFirst({
        where: { tenantId, id },
      });
      if (!request) {
        return NextResponse.json({ error: 'Admission request not found' }, { status: 404 });
      }

      // 2. Validate transition
      const transition = isValidTransition(request.status, 'VERIFIED', request.urgency);
      if (!transition.valid) {
        return NextResponse.json(
          { error: transition.reason || 'Cannot verify from current status' },
          { status: 409 }
        );
      }

      // 3. Check checklist completeness
      const checklist = await prisma.admissionChecklist.findFirst({
        where: { tenantId, admissionRequestId: id },
      });

      if (checklist) {
        const items: ChecklistItem[] = Array.isArray(checklist.items) ? checklist.items as any : [];
        const incompleteRequired = items.filter(
          (item) => item.required && !item.completed
        );

        // Emergency: only require allergies_confirmed
        if (request.urgency === 'EMERGENCY') {
          const criticalMissing = incompleteRequired.filter(
            (item) => item.key === 'allergies_confirmed'
          );
          if (criticalMissing.length > 0) {
            return NextResponse.json({
              error: 'Critical checklist items incomplete',
              incompleteItems: criticalMissing.map((i) => ({
                key: i.key,
                labelEn: i.labelEn,
                labelAr: i.labelAr,
              })),
            }, { status: 400 });
          }
        } else {
          // Non-emergency: all required items must be complete
          if (incompleteRequired.length > 0) {
            return NextResponse.json({
              error: 'Required checklist items incomplete',
              incompleteItems: incompleteRequired.map((i) => ({
                key: i.key,
                labelEn: i.labelEn,
                labelAr: i.labelAr,
              })),
            }, { status: 400 });
          }
        }
      }

      // 4. Update status to VERIFIED
      const updated = await prisma.admissionRequest.update({
        where: { id },
        data: {
          status: 'VERIFIED',
          updatedByUserId: userId,
        },
      });

      return NextResponse.json({ success: true, request: updated });
    } catch (err) {
      logger.error('[admission/requests/[id]/verify] POST error:', err);
      return NextResponse.json({ error: 'Failed to verify admission request' }, { status: 500 });
    }
  },
  { permissionKey: 'admission.manage' }
);
