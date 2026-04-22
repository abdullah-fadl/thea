/**
 * SCM BC9 Platform — Sequence Generator
 *
 * POST /api/imdad/platform/sequence — Get next sequence number
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';

// ---------------------------------------------------------------------------
// POST — Get next sequence number
// ---------------------------------------------------------------------------
const sequenceSchema = z.object({
  sequenceType: z.string().min(1),
  organizationId: z.string().uuid(),
  prefix: z.string().optional(),
  padLength: z.number().int().min(1).max(10).optional(),
});

export const POST = withAuthTenant(
  async (req, { tenantId }) => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = sequenceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation Error', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { sequenceType, organizationId, prefix, padLength } = parsed.data;
    const fiscalYear = new Date().getFullYear();
    const defaultPrefix = `${sequenceType}-`;
    const effectivePadLength = padLength ?? 6;

    try {
      const counter = await prisma.imdadSequenceCounter.upsert({
        where: {
          tenantId_organizationId_sequenceType_fiscalYear: {
            tenantId,
            organizationId,
            sequenceType,
            fiscalYear,
          },
        },
        create: {
          tenantId,
          organizationId,
          sequenceType,
          prefix: prefix || defaultPrefix,
          currentValue: 1,
          fiscalYear,
          padLength: effectivePadLength,
        } as any,
        update: { currentValue: { increment: 1 } },
      });

      const formattedNumber = `${counter.prefix}${fiscalYear}-${String(counter.currentValue).padStart(effectivePadLength, '0')}`;

      // Audit log the sequence generation
      await imdadAudit.log({
        tenantId,
        actorUserId: '',
        action: 'CREATE',
        resourceType: 'SEQUENCE_COUNTER',
        resourceId: counter.id,
        metadata: { sequenceType, formattedNumber },
      });

      return NextResponse.json({
        sequenceType,
        organizationId,
        fiscalYear,
        currentValue: counter.currentValue,
        formattedNumber,
      });
    } catch (error) {
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.admin.view' }
);
