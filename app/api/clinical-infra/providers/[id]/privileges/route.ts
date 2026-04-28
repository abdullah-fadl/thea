import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { requireClinicalInfraAdmin } from '@/lib/clinicalInfra/access';
import { withIdempotency } from '@/lib/clinicalInfra/idempotency';
import { startAudit, finishAudit } from '@/lib/clinicalInfra/audit';
import { prisma } from '@/lib/db/prisma';
import { v4 as uuidv4 } from 'uuid';
import { validateBody } from '@/lib/validation/helpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function normalizeCategories(input: any): string[] {
  if (Array.isArray(input)) {
    return Array.from(new Set(input.map((x) => String(x || '').trim()).filter(Boolean)));
  }
  if (typeof input === 'string') {
    return Array.from(
      new Set(
        input
          .split(',')
          .map((x) => String(x || '').trim())
          .filter(Boolean)
      )
    );
  }
  return [];
}

async function findPrivileges(tenantId: string, providerId: string): Promise<any | null> {
  try {
    const rows: any[] = await prisma.$queryRaw`
      SELECT * FROM clinical_infra_provider_privileges
      WHERE "tenantId" = ${tenantId}::uuid AND "providerId" = ${providerId}::uuid
      LIMIT 1
    `;
    return rows[0] || null;
  } catch {
    return null;
  }
}

async function upsertPrivileges(tenantId: string, providerId: string, data: any): Promise<any | null> {
  try {
    await prisma.$executeRaw`
      INSERT INTO clinical_infra_provider_privileges (
        id, "tenantId", "providerId",
        "canPrescribe", "canOrderNarcotics", "canRequestImaging",
        "canPerformProcedures", "procedureCategories",
        "createdAt", "updatedAt", "isArchived", "archivedAt"
      ) VALUES (
        ${data.id}::uuid, ${tenantId}::uuid, ${providerId}::uuid,
        ${data.canPrescribe}, ${data.canOrderNarcotics}, ${data.canRequestImaging},
        ${data.canPerformProcedures}, ${data.procedureCategories},
        ${data.createdAt}, ${data.updatedAt}, false, NULL
      )
      ON CONFLICT ("tenantId", "providerId")
      DO UPDATE SET
        "canPrescribe" = EXCLUDED."canPrescribe",
        "canOrderNarcotics" = EXCLUDED."canOrderNarcotics",
        "canRequestImaging" = EXCLUDED."canRequestImaging",
        "canPerformProcedures" = EXCLUDED."canPerformProcedures",
        "procedureCategories" = EXCLUDED."procedureCategories",
        "updatedAt" = EXCLUDED."updatedAt"
    `;
    return findPrivileges(tenantId, providerId);
  } catch {
    return null;
  }
}

export const GET = withAuthTenant(async (req: NextRequest, { tenantId, userId, user }, params) => {
  const admin = await requireClinicalInfraAdmin(req, { tenantId, userId, user });
  if (admin instanceof NextResponse) return admin;
  const providerId = String((params as Record<string, string>)?.id || '').trim();
  if (!providerId) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const item = await findPrivileges(tenantId, providerId);

  return NextResponse.json({ item });
}, { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'clinical_infra.view' });

export const PUT = withAuthTenant(async (req: NextRequest, { tenantId, userId, user }, params) => {
  const admin = await requireClinicalInfraAdmin(req, { tenantId, userId, user });
  if (admin instanceof NextResponse) return admin;
  const providerId = String((params as Record<string, string>)?.id || '').trim();
  if (!providerId) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const putSchema = z.object({
    canPrescribe: z.boolean().optional(),
    canOrderNarcotics: z.boolean().optional(),
    canRequestImaging: z.boolean().optional(),
    canPerformProcedures: z.boolean().optional(),
    procedureCategories: z.unknown().optional(),
    clientRequestId: z.string().optional(),
  }).passthrough();
  const v = validateBody(body, putSchema);
  if ('error' in v) return v.error;

  const clientRequestId = String(body.clientRequestId || '').trim() || null;

  return withIdempotency({
    tenantId,
    method: 'PUT',
    pathname: `/api/clinical-infra/providers/${providerId}/privileges`,
    clientRequestId,
    handler: async () => {
      const before = await findPrivileges(tenantId, providerId);
      const now = new Date();
      const recordId = before?.id || uuidv4();
      const after = {
        ...(before || {}),
        id: recordId,
        tenantId,
        providerId,
        canPrescribe: Boolean(body.canPrescribe),
        canOrderNarcotics: Boolean(body.canOrderNarcotics),
        canRequestImaging: Boolean(body.canRequestImaging),
        canPerformProcedures: Boolean(body.canPerformProcedures),
        procedureCategories: normalizeCategories(body.procedureCategories),
        createdAt: before?.createdAt || now,
        updatedAt: now,
        isArchived: false,
        archivedAt: null,
      };

      const { auditId } = await startAudit({
        tenantId,
        userId,
        entityType: 'clinical_infra_provider_privileges',
        entityId: providerId,
        action: 'UPDATE',
        before: before || null,
        after,
        ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
        path: req.nextUrl.pathname,
      });

      try {
        const stored = await upsertPrivileges(tenantId, providerId, after);
        await finishAudit({ tenantId, auditId, ok: true });
        return NextResponse.json({ item: stored });
      } catch (e: any) {
        await finishAudit({ tenantId, auditId, ok: false, error: String(e?.message || e) });
        return NextResponse.json({ error: 'Failed to update privileges' }, { status: 500 });
      }
    },
  });
}, { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'clinical_infra.manage' });
