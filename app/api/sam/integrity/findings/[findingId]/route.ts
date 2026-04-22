import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import { validateBody } from '@/lib/validation/helpers';
import crypto from 'crypto';
import { logger } from '@/lib/monitoring/logger';

const updateFindingSchema = z.object({
  status: z.enum(['OPEN', 'IN_REVIEW', 'RESOLVED', 'IGNORED']).optional(),
  ownerName: z.string().optional(),
  dueDate: z.string().nullable().optional(),
  slaDays: z.number().nullable().optional(),
}).passthrough();

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(
  async (req, { tenantId, userId }, params) => {
    try {
      const resolvedParams = params instanceof Promise ? await params : params;
      const findingId = String((resolvedParams as Record<string, string>)?.findingId || '').trim();
      if (!findingId) {
        return NextResponse.json({ error: 'findingId is required' }, { status: 400 });
      }

      const body = await req.json();
      const v = validateBody(body, updateFindingSchema);
      if ('error' in v) return v.error;
      const { status, ownerName, dueDate, slaDays } = v.data;

      // Fetch existing finding to preserve metadata fields
      const existing = await prisma.integrityFinding.findFirst({
        where: { tenantId, id: findingId },
        select: { metadata: true },
      });
      if (!existing) {
        return NextResponse.json({ error: 'Finding not found' }, { status: 404 });
      }

      const existingMeta = (typeof existing.metadata === 'object' && existing.metadata !== null ? existing.metadata : {}) as Record<string, unknown>;
      const updateFields: any = { updatedAt: new Date() };
      if (status) updateFields.status = status;

      // Spread existing metadata so we never overwrite recommendation, evidence, dedupeKey, etc.
      const metadataUpdates: Record<string, unknown> = {};
      if (ownerName !== undefined) metadataUpdates.ownerName = ownerName;
      if (dueDate !== undefined) metadataUpdates.dueDate = dueDate ? new Date(dueDate) : null;
      if (slaDays !== undefined) metadataUpdates.slaDays = slaDays;
      if (Object.keys(metadataUpdates).length > 0) {
        updateFields.metadata = { ...existingMeta, ...metadataUpdates };
      }

      const result = await prisma.integrityFinding.updateMany({
        where: { tenantId, id: findingId },
        data: updateFields,
      });

      if (result.count === 0) {
        return NextResponse.json({ error: 'Finding not found' }, { status: 404 });
      }

      const activityMessageParts = [];
      if (status) activityMessageParts.push(`status=${status}`);
      if (ownerName !== undefined) activityMessageParts.push(`owner=${ownerName || 'Unassigned'}`);
      if (dueDate !== undefined) activityMessageParts.push(`due=${dueDate || 'none'}`);
      if (slaDays !== undefined) activityMessageParts.push(`sla=${slaDays || 'none'}`);

      await prisma.integrityActivity.create({
        data: {
          tenantId,
          type: 'STATUS_CHANGE',
          message: activityMessageParts.length > 0 ? `Updated ${activityMessageParts.join(', ')}` : 'Finding updated',
          userId,
          metadata: { findingId } as Prisma.InputJsonValue,
          createdAt: new Date(),
        },
      });

      return NextResponse.json({ success: true });
    } catch (error: any) {
      logger.error('Integrity finding update error:', { error: error });
      // [SEC-06]
      return NextResponse.json(
        { error: 'Failed to update integrity finding' },
        { status: 500 }
      );
    }
  },
  { platformKey: 'sam', tenantScoped: true, permissionKey: 'sam.integrity.resolve' }
);
