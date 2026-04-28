import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { writeErAuditLog } from '@/lib/er/audit';
import { v4 as uuidv4 } from 'uuid';
import { assertEncounterNotClosedByHandoff, ER_HANDOFF_CLOSED_ERROR } from '@/lib/er/handoff';
import { z } from 'zod';
import { validateBody } from '@/lib/validation/helpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type HandoverType = 'END_OF_SHIFT' | 'NURSE_TO_NURSE';

const bodySchema = z.object({
  encounterId: z.string().min(1, 'encounterId is required'),
  type: z.enum(['END_OF_SHIFT', 'NURSE_TO_NURSE']),
  situation: z.string().optional(),
  background: z.string().optional(),
  assessment: z.string().optional(),
  recommendation: z.string().optional(),
}).passthrough();

function isDevAccount(_email: string | null | undefined): boolean {
  return false; // backdoor removed
}

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user, userId }) => {
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const v = validateBody(body, bodySchema);
  if ('error' in v) return v.error;

  const encounterId = String(v.data.encounterId).trim();
  const type = v.data.type as HandoverType;

  const situation = String(v.data.situation || '').trim();
  const background = String(v.data.background || '').trim();
  const assessment = String(v.data.assessment || '').trim();
  const recommendation = String(v.data.recommendation || '').trim();
  if (!situation && !background && !assessment && !recommendation) {
    return NextResponse.json({ error: 'At least one SBAR field is required' }, { status: 400 });
  }

  const dev = false;
  if (!dev) {
    const assignment = await prisma.erStaffAssignment.findFirst({
      where: {
        encounterId,
        role: 'PRIMARY_NURSE',
        unassignedAt: null,
        userId,
      },
    });
    if (!assignment) {
      return NextResponse.json(
        { error: 'Forbidden: encounter is not assigned to you as Primary Nurse' },
        { status: 403 }
      );
    }
  }
  try {
    await assertEncounterNotClosedByHandoff({ tenantId, encounterId });
  } catch (err: any) {
    return NextResponse.json({ error: ER_HANDOFF_CLOSED_ERROR, handoffId: err?.handoffId || null }, { status: 409 });
  }

  const now = new Date();
  const handover = {
    id: uuidv4(),
    tenantId,
    encounterId,
    fromNurseId: userId,
    type: type,
    sbar: { situation, background, assessment, recommendation } as Record<string, unknown>,
    createdAt: now,
  };

  await prisma.erNursingHandover.create({ data: handover as any });

  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip');
  await writeErAuditLog({
    tenantId,
    userId,
    entityType: 'nursing_handover',
    entityId: handover.id,
    action: 'CREATE',
    after: { encounterId, fromNurseId: userId, type, createdAt: now },
    ip,
  });

  return NextResponse.json({ success: true, handover });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'er.board.manage' }
);
