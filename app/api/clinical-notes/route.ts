import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { validateBody } from '@/lib/validation/helpers';
import { createAuditLog } from '@/lib/utils/audit';
import { ensureNotDeceasedFinalized } from '@/lib/core/guards/deathGuard';

const createClinicalNoteBodySchema = z.object({
  patientMasterId: z.string().min(1, 'patientMasterId is required'),
  encounterCoreId: z.string().min(1, 'encounterCoreId is required'),
  content: z.string().min(1, 'content is required'),
  title: z.string().optional(),
  context: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  area: z.string().optional(),
  role: z.string().optional(),
  noteType: z.string().optional(),
  idempotencyKey: z.string().optional(),
}).passthrough();

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const AREAS = new Set(['ER', 'OPD', 'IPD', 'ICU', 'OTHER']);
const NOTE_TYPES = new Set([
  'OPD_VISIT',
  'ER_PROGRESS',
  'IPD_DAILY',
  'NURSING_NOTE',
  'DISCHARGE_NOTE',
  'DAILY_PROGRESS',
  'NURSING_SHIFT_NOTE',
  'MED_RECON_ADMISSION',
  'MED_RECON_DISCHARGE',
  'NARCOTIC_COUNT',
]);
const ROLES = new Set(['doctor', 'nurse', 'allied']);

function deriveRole(role: string | null | undefined): 'doctor' | 'nurse' | 'allied' {
  const r = String(role || '').toLowerCase();
  if (r.includes('doctor') || r.includes('physician')) return 'doctor';
  if (r.includes('nurse') || r.includes('nursing')) return 'nurse';
  return 'allied';
}

function defaultNoteType(area: string): string {
  switch (area) {
    case 'ER':
      return 'ER_PROGRESS';
    case 'OPD':
      return 'OPD_VISIT';
    case 'IPD':
    case 'ICU':
      return 'IPD_DAILY';
    default:
      return 'OPD_VISIT';
  }
}

export const GET = withAuthTenant(async (req: NextRequest, { tenantId }) => {
  const { searchParams } = new URL(req.url);
  const encounterCoreId = String(searchParams.get('encounterCoreId') || '').trim();
  if (!encounterCoreId) {
    return NextResponse.json({ error: 'encounterCoreId is required' }, { status: 400 });
  }

  const items = await prisma.clinicalNote.findMany({
    where: { tenantId, encounterCoreId },
    orderBy: { createdAt: 'asc' },
  });

  const grouped = items.reduce<Record<string, typeof items>>((acc, note) => {
    const key = String(note.noteType || 'UNKNOWN');
    if (!acc[key]) acc[key] = [];
    acc[key].push(note);
    return acc;
  }, {});

  return NextResponse.json({ items, grouped });
}, { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'clinical.view' });

export const POST = withAuthTenant(async (req: NextRequest, { tenantId, userId, user, role }) => {
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const v = validateBody(body, createClinicalNoteBodySchema);
  if ('error' in v) return v.error;

  const missing: string[] = [];
  const invalid: string[] = [];

  const patientMasterId = String(v.data.patientMasterId || '').trim();
  const encounterCoreId = String(v.data.encounterCoreId || '').trim();
  const content = String(v.data.content || '').trim();
  const title = body.title ? String(body.title || '').trim() : null;
  const context = body.context ? String(body.context || '').trim() : null;
  const metadata = body.metadata && typeof body.metadata === 'object' ? body.metadata : null;
  const areaRaw = body.area ? String(body.area || '').trim().toUpperCase() : '';
  const roleRaw = body.role ? String(body.role || '').trim().toLowerCase() : '';
  const noteTypeRaw = body.noteType ? String(body.noteType || '').trim().toUpperCase() : '';
  const idempotencyKey = body.idempotencyKey ? String(body.idempotencyKey || '').trim() : null;

  if (!patientMasterId) missing.push('patientMasterId');
  if (!encounterCoreId) missing.push('encounterCoreId');
  if (!content) missing.push('content');

  const area = areaRaw && AREAS.has(areaRaw) ? areaRaw : '';
  if (areaRaw && !area) invalid.push('area');

  const noteType = noteTypeRaw && NOTE_TYPES.has(noteTypeRaw) ? noteTypeRaw : '';
  if (noteTypeRaw && !noteType) invalid.push('noteType');

  const authorRole = roleRaw && ROLES.has(roleRaw) ? roleRaw : deriveRole(role);
  if (authorRole === 'allied') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (missing.length || invalid.length) {
    return NextResponse.json({ error: 'Validation failed', missing, invalid }, { status: 400 });
  }

  const encounter = await prisma.encounterCore.findFirst({
    where: { tenantId, id: encounterCoreId },
  });
  if (!encounter) {
    return NextResponse.json({ error: 'Encounter not found' }, { status: 404 });
  }
  if (String(encounter.status || '').toUpperCase() !== 'ACTIVE') {
    return NextResponse.json({ error: 'Encounter is not active', code: 'ENCOUNTER_CLOSED' }, { status: 409 });
  }

  const deathGuard = await ensureNotDeceasedFinalized({ tenantId, encounterCoreId });
  if (deathGuard) return deathGuard;

  const discharge = await prisma.dischargeSummary.findFirst({
    where: { tenantId, encounterCoreId },
  });
  if (discharge) {
    return NextResponse.json(
      { error: 'Discharge already finalized', code: 'DISCHARGE_FINALIZED' },
      { status: 409 }
    );
  }

  if (idempotencyKey) {
    const existing = await prisma.clinicalNote.findFirst({
      where: { tenantId, idempotencyKey },
    });
    if (existing) {
      return NextResponse.json({ success: true, noOp: true, note: existing });
    }
  }

  const now = new Date();
  const note = await prisma.clinicalNote.create({
    data: {
      tenantId,
      patientMasterId,
      encounterCoreId,
      context,
      area: area || String(encounter.encounterType || 'OTHER').toUpperCase(),
      role: authorRole,
      noteType: noteType || defaultNoteType(area || String(encounter.encounterType || 'OTHER').toUpperCase()),
      title,
      content,
      metadata: metadata ?? undefined,
      author: {
        userId: userId || null,
        name: String(user?.displayName || user?.email || 'Unknown'),
        role: authorRole,
      },
      createdByUserId: userId || null,
      createdAt: now,
      idempotencyKey: idempotencyKey || null,
    },
  });

  await createAuditLog(
    'clinical_note',
    note.id,
    'CREATE',
    userId || 'system',
    user?.email,
    { after: note },
    tenantId
  );

  return NextResponse.json({ success: true, note });
}, { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'clinical.edit' });
