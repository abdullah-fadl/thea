import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { writeErAuditLog } from '@/lib/er/audit';
import { evaluateCriticalVitals } from '@/lib/er/observations';
import { v4 as uuidv4 } from 'uuid';
import { bucket30Min, createErNotificationIfMissing } from '@/lib/er/notifications';
import { assertEncounterNotClosedByHandoff, ER_HANDOFF_CLOSED_ERROR } from '@/lib/er/handoff';
import { z } from 'zod';
import { validateBody } from '@/lib/validation/helpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const bodySchema = z.object({
  encounterId: z.string().min(1, 'encounterId is required'),
  systolic: z.union([z.number(), z.string(), z.null()]).optional(),
  diastolic: z.union([z.number(), z.string(), z.null()]).optional(),
  hr: z.union([z.number(), z.string(), z.null()]).optional(),
  rr: z.union([z.number(), z.string(), z.null()]).optional(),
  temp: z.union([z.number(), z.string(), z.null()]).optional(),
  spo2: z.union([z.number(), z.string(), z.null()]).optional(),
  painScore: z.union([z.number(), z.string(), z.null()]).optional(),
  avpu: z.string().optional(),
}).passthrough();

function isDevAccount(_email: string | null | undefined): boolean {
  return false; // backdoor removed
}

function toNumberOrNull(v: any): number | null {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizeAvpu(v: any): 'A' | 'V' | 'P' | 'U' | null {
  const s = String(v || '').trim().toUpperCase();
  if (s === 'A' || s === 'V' || s === 'P' || s === 'U') return s;
  return null;
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
  try {
    await assertEncounterNotClosedByHandoff({ tenantId, encounterId });
  } catch (err: any) {
    return NextResponse.json({ error: ER_HANDOFF_CLOSED_ERROR, handoffId: err?.handoffId || null }, { status: 409 });
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

  const systolic = toNumberOrNull(body.systolic);
  const diastolic = toNumberOrNull(body.diastolic);
  const hr = toNumberOrNull(body.hr);
  const rr = toNumberOrNull(body.rr);
  const temp = toNumberOrNull(body.temp);
  const spo2 = toNumberOrNull(body.spo2);
  const painScore = toNumberOrNull(body.painScore);
  const avpu = normalizeAvpu(body.avpu);

  // basic validation constraints
  if (painScore != null && (painScore < 0 || painScore > 10)) {
    return NextResponse.json({ error: 'painScore must be between 0 and 10' }, { status: 400 });
  }

  const now = new Date();
  const evalResult = evaluateCriticalVitals({
    systolic,
    diastolic,
    hr,
    rr,
    temp,
    spo2,
    painScore,
    avpu,
  });

  const doc = {
    id: uuidv4(),
    tenantId,
    encounterId,
    nurseId: userId,
    vitals: {
      systolic,
      diastolic,
      hr,
      rr,
      temp,
      spo2,
    } as Record<string, unknown>,
    painScore,
    avpu,
    critical: evalResult.critical,
    criticalReasons: evalResult.reasons as unknown,
    createdAt: now,
  };

  await prisma.erObservation.create({ data: doc as any });

  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip');
  await writeErAuditLog({
    tenantId,
    userId,
    entityType: 'observation',
    entityId: doc.id,
    action: 'CREATE',
    after: {
      encounterId,
      vitals: doc.vitals,
      painScore,
      avpu,
      critical: doc.critical,
      createdAt: doc.createdAt,
    },
    ip,
  });

  if (doc.critical) {
    await writeErAuditLog({
      tenantId,
      userId,
      entityType: 'observation',
      entityId: doc.id,
      action: 'CRITICAL_VITALS_DETECTED',
      after: { encounterId, reasons: doc.criticalReasons },
      ip,
    });

    // Notification: critical vitals (dedupe per 30-min bucket to avoid spam)
    await createErNotificationIfMissing({
      tenantId,
      type: 'CRITICAL_VITALS',
      encounterId,
      dedupeKey: `CRITICAL_VITALS:${encounterId}:${bucket30Min(now)}`,
      createdAt: now,
    });
  }

  return NextResponse.json({ success: true, observation: doc });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'er.board.view' }
);
