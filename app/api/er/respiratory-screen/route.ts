import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { writeErAuditLog } from '@/lib/er/audit';
import { v4 as uuidv4 } from 'uuid';
import { getFinalStatusBlock } from '@/lib/er/finalStatusGuard';
import { z } from 'zod';
import { validateBody } from '@/lib/validation/helpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const respiratoryBodySchema = z.object({
  tempIdentityId: z.string().optional(),
  encounterId: z.string().optional(),
  visitNumber: z.string().optional(),
  symptoms: z.array(z.string()).optional(),
  riskFactors: z.array(z.string()).optional(),
  spo2: z.union([z.number(), z.string(), z.null()]).optional(),
  overrideUnconscious: z.boolean().optional(),
  overrideUnstable: z.boolean().optional(),
  decision: z.string().optional(),
  answers: z.object({
    symptoms: z.array(z.string()).optional(),
    riskFactors: z.array(z.string()).optional(),
  }).optional(),
  override: z.object({
    unconscious: z.boolean().optional(),
    unstable: z.boolean().optional(),
  }).optional(),
}).passthrough();

const DEFAULT_DECISION_RULE = 'SYMPTOM_ISOLATE';
const SYMPTOMS = [
  'cough',
  'shortness_of_breath',
  'fever_chills',
  'sore_throat_runny_nose',
  'loss_smell_taste',
] as const;
const RISK_FACTORS = ['contact_case', 'recent_outbreak', 'healthcare_worker'] as const;

function normalizeList(input: unknown, allowed: readonly string[]) {
  if (!Array.isArray(input)) return [];
  const set = new Set(allowed);
  return Array.from(new Set(input.map((x) => String(x || '').trim()).filter((x) => set.has(x))));
}

function computeDecision(args: {
  symptoms: string[];
  riskFactors: string[];
  overrideUnconscious: boolean;
  overrideUnstable: boolean;
}) {
  if (args.overrideUnconscious || args.overrideUnstable) return 'PRECAUTIONS';
  if (args.symptoms.length > 0) return 'ISOLATE';
  if (args.riskFactors.length > 0) return 'PRECAUTIONS';
  return 'NO';
}

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
  const url = new URL(req.url);
  const encounterId = String(url.searchParams.get('encounterId') || '').trim();
  const visitNumber = String(url.searchParams.get('visitNumber') || '').trim();
  const tempIdentityId = String(url.searchParams.get('tempIdentityId') || '').trim();
  let resolvedEncounterId = encounterId;
  if (!resolvedEncounterId && visitNumber) {
    const resolved = await prisma.erEncounter.findFirst({
      where: { tenantId },
      select: { id: true },
    });
    resolvedEncounterId = resolved?.id ? String(resolved.id) : '';
  }
  if (!resolvedEncounterId && !tempIdentityId) {
    return NextResponse.json({ error: 'visitNumber or tempIdentityId required' }, { status: 400 });
  }

  const filter: any = { tenantId };
  if (resolvedEncounterId) filter.encounterId = resolvedEncounterId;
  if (tempIdentityId) filter.tempIdentityId = tempIdentityId;

  const item = await prisma.respiratoryScreening.findFirst({
    where: filter,
    orderBy: { screenedAt: 'desc' },
  });

  return NextResponse.json({ item: item || null });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'er.board.view' }
);

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }) => {
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const v = validateBody(body, respiratoryBodySchema);
  if ('error' in v) return v.error;

  const tempIdentityId = String(body.tempIdentityId || '').trim();
  const encounterId = String(body.encounterId || '').trim();
  const visitNumber = String(body.visitNumber || '').trim();
  if (!tempIdentityId && !encounterId && !visitNumber) {
    return NextResponse.json({ error: 'tempIdentityId or visitNumber is required' }, { status: 400 });
  }

  const includeLossSmell = process.env.RESP_SCREEN_LOSS_SMELL !== '0';
  const includeOutbreak = process.env.RESP_SCREEN_OUTBREAK !== '0';

  const symptomsAllowed = includeLossSmell ? SYMPTOMS : SYMPTOMS.filter((s) => s !== 'loss_smell_taste');
  const risksAllowed = includeOutbreak ? RISK_FACTORS : RISK_FACTORS.filter((s) => s !== 'recent_outbreak');

  const answers = body.answers as Record<string, unknown> | undefined;
  const overrideObj = body.override as Record<string, unknown> | undefined;
  const symptoms = normalizeList(body.symptoms || answers?.symptoms, symptomsAllowed);
  const riskFactors = normalizeList(body.riskFactors || answers?.riskFactors, risksAllowed);
  const spo2 = body.spo2 !== undefined && body.spo2 !== null && body.spo2 !== '' ? Number(body.spo2) : null;
  const overrideUnconscious = Boolean(body.overrideUnconscious || overrideObj?.unconscious);
  const overrideUnstable = Boolean(body.overrideUnstable || overrideObj?.unstable);

  const decision = String(body.decision || '').trim().toUpperCase() || computeDecision({ symptoms, riskFactors, overrideUnconscious, overrideUnstable });
  if (!['ISOLATE', 'PRECAUTIONS', 'NO'].includes(decision)) {
    return NextResponse.json({ error: 'Invalid decision' }, { status: 400 });
  }

  let encounter: any | null = null;
  let resolvedEncounterId = encounterId;
  if (!resolvedEncounterId && visitNumber) {
    encounter = await prisma.erEncounter.findFirst({ where: { tenantId } });
    resolvedEncounterId = encounter?.id ? String(encounter.id) : '';
    if (visitNumber && !resolvedEncounterId) {
      return NextResponse.json({ error: 'Visit not found' }, { status: 404 });
    }
  }
  if (resolvedEncounterId) {
    encounter = encounter || (await prisma.erEncounter.findFirst({ where: { tenantId, id: resolvedEncounterId } }));
    if (encounter) {
      const finalBlock = getFinalStatusBlock(String(encounter.status || ''), 'respiratory.screen');
      if (finalBlock) {
        return NextResponse.json(finalBlock.body, { status: finalBlock.status });
      }
    }
  }

  const now = new Date();
  const doc = {
    id: uuidv4(),
    tenantId,
    encounterId: resolvedEncounterId || null,
    screeningData: {
      symptoms,
      riskFactors,
      spo2,
      override: {
        unconscious: overrideUnconscious,
        unstable: overrideUnstable,
      },
      tempIdentityId: tempIdentityId || null,
    },
    result: decision,
    riskLevel: decision === 'ISOLATE' ? 'high' : decision === 'PRECAUTIONS' ? 'moderate' : 'low',
    screenedBy: userId,
    screenedAt: now,
    createdAt: now,
  };

  await prisma.respiratoryScreening.create({ data: doc });

  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip');
  await writeErAuditLog({
    tenantId,
    userId,
    entityType: 'respiratory_screening',
    entityId: doc.id,
    action: 'CREATE',
    before: null,
    after: doc,
    ip,
  });

  if (resolvedEncounterId && encounter) {
    const respiratoryPrecautions = decision === 'ISOLATE' || decision === 'PRECAUTIONS';
    const encounterUpdate: any = {
      updatedAt: now,
    };
    await prisma.erEncounter.update({
      where: { id: resolvedEncounterId },
      data: encounterUpdate,
    });
    await writeErAuditLog({
      tenantId,
      userId,
      entityType: 'encounter',
      entityId: resolvedEncounterId,
      action: 'UPDATE',
      before: encounter,
      after: { ...encounter, ...encounterUpdate, respiratoryDecision: decision, respiratoryPrecautions },
      ip,
    });
  }

  return NextResponse.json({ item: doc });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'er.board.view' }
);
