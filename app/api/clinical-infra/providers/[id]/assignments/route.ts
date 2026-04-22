import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { requireClinicalInfraAdmin } from '@/lib/clinicalInfra/access';
import { withIdempotency } from '@/lib/clinicalInfra/idempotency';
import { startAudit, finishAudit } from '@/lib/clinicalInfra/audit';
import { prisma } from '@/lib/db/prisma';
import { validateBody } from '@/lib/validation/helpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function normalizeIds(input: any): string[] {
  if (!Array.isArray(input)) return [];
  return Array.from(new Set(input.map((x) => String(x || '').trim()).filter(Boolean)));
}

// Helper to find a record in a raw table (no Prisma model) by tenantId + providerId
async function findRawDoc(table: string, tenantId: string, providerId: string): Promise<any | null> {
  try {
    const rows: unknown[] = await (prisma as unknown as { $queryRawUnsafe: (...args: unknown[]) => Promise<unknown[]> }).$queryRawUnsafe(
      `SELECT * FROM "${table}" WHERE "tenantId" = $1::uuid AND "providerId" = $2::uuid LIMIT 1`,
      tenantId,
      providerId
    );
    return rows[0] || null;
  } catch {
    return null;
  }
}

// Helper to upsert a record in a raw table by tenantId + providerId
async function upsertRawDoc(table: string, tenantId: string, providerId: string, id: string, data: any): Promise<void> {
  const fields = Object.keys(data);
  const columns = ['id', '"tenantId"', '"providerId"', ...fields.map(f => `"${f}"`)];
  const placeholders = [`$1::uuid`, `$2::uuid`, `$3::uuid`, ...fields.map((_, i) => `$${i + 4}`)];
  const updates = fields.map(f => `"${f}" = EXCLUDED."${f}"`).join(', ');
  const values = [id, tenantId, providerId, ...fields.map(f => data[f])];

  const sql = `INSERT INTO "${table}" (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) ON CONFLICT ("tenantId", "providerId") DO UPDATE SET ${updates}`;
  await (prisma as unknown as { $executeRawUnsafe: (...args: unknown[]) => Promise<unknown> }).$executeRawUnsafe(sql, ...values);
}

export const GET = withAuthTenant(async (req: NextRequest, { tenantId, userId, user }, params) => {
  const admin = await requireClinicalInfraAdmin(req, { tenantId, userId, user });
  if (admin instanceof NextResponse) return admin;
  const providerId = String((params as Record<string, string>)?.id || '').trim();
  if (!providerId) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const [rooms, scopes, profile, assignments] = await Promise.all([
    findRawDoc('clinical_infra_provider_room_assignments', tenantId, providerId),
    findRawDoc('clinical_infra_provider_unit_scopes', tenantId, providerId),
    prisma.clinicalInfraProviderProfile.findFirst({ where: { tenantId, providerId } }),
    prisma.clinicalInfraProviderAssignment.findFirst({ where: { tenantId, providerId } }),
  ]);

  return NextResponse.json({ roomAssignments: rooms, unitScopes: scopes, profile, providerAssignments: assignments });
}, { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'clinical_infra.view' });

export const PUT = withAuthTenant(async (req: NextRequest, { tenantId, userId, user }, params) => {
  const admin = await requireClinicalInfraAdmin(req, { tenantId, userId, user });
  if (admin instanceof NextResponse) return admin;
  const providerId = String((params as Record<string, string>)?.id || '').trim();
  if (!providerId) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const putSchema = z.object({ clientRequestId: z.string().optional() }).passthrough();
  const v = validateBody(body, putSchema);
  if ('error' in v) return v.error;

  const clientRequestId = String(body.clientRequestId || '').trim() || null;

  return withIdempotency({
    tenantId,
    method: 'PUT',
    pathname: `/api/clinical-infra/providers/${providerId}/assignments`,
    clientRequestId,
    handler: async () => {
      const now = new Date();
      const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip');

      // Provider profile (license + specialties + units)
      const profileBefore = await prisma.clinicalInfraProviderProfile.findFirst({ where: { tenantId, providerId } });
      const profileId = profileBefore?.id || uuidv4();
      const profileData = {
        licenseNumber: String(body.licenseNumber || '').trim() || null,
        unitIds: normalizeIds(body.unitIds),
        specialtyIds: normalizeIds(body.specialtyIds),
        consultationServiceCode: String(body.consultationServiceCode || '').trim() || null,
        level: String(body.level || '').trim().toUpperCase() || null,
        updatedAt: now,
      };

      // Room assignments (raw table — schema is a document store, not junction)
      const roomsBefore = await findRawDoc('clinical_infra_provider_room_assignments', tenantId, providerId);
      const roomsId = roomsBefore?.id || uuidv4();
      const roomsData = {
        roomIds: normalizeIds(body.roomIds),
        createdAt: roomsBefore?.createdAt || now,
        updatedAt: now,
        isArchived: false,
      };

      // Unit scopes (raw table)
      const scopesBefore = await findRawDoc('clinical_infra_provider_unit_scopes', tenantId, providerId);
      const scopesId = scopesBefore?.id || uuidv4();
      const scopesData = {
        unitIds: normalizeIds(body.scopeUnitIds ?? body.unitScopeUnitIds ?? body.unitIds),
        createdAt: scopesBefore?.createdAt || now,
        updatedAt: now,
        isArchived: false,
      };

      // Provider clinic assignments
      const assignmentsBefore = await prisma.clinicalInfraProviderAssignment.findFirst({ where: { tenantId, providerId } });
      const assignmentsId = assignmentsBefore?.id || uuidv4();
      const assignmentsData = {
        primaryClinicId: String(body.primaryClinicId || '').trim() || null,
        parallelClinicIds: normalizeIds(body.parallelClinicIds),
        updatedAt: now,
      };

      const beforeSnapshot = {
        profile: profileBefore || null,
        roomAssignments: roomsBefore || null,
        unitScopes: scopesBefore || null,
        providerAssignments: assignmentsBefore || null,
      };
      const afterSnapshot = {
        profile: { ...profileData, id: profileId },
        roomAssignments: { ...roomsData, id: roomsId },
        unitScopes: { ...scopesData, id: scopesId },
        providerAssignments: { ...assignmentsData, id: assignmentsId },
      };

      const { auditId } = await startAudit({
        tenantId,
        userId,
        entityType: 'clinical_infra_provider_assignments',
        entityId: providerId,
        action: 'UPDATE',
        before: beforeSnapshot,
        after: afterSnapshot,
        ip,
        path: req.nextUrl.pathname,
      });

      try {
        // Upsert profile via Prisma
        try {
          await prisma.clinicalInfraProviderProfile.upsert({
            where: { tenantId_providerId: { tenantId, providerId } },
            create: {
              id: profileId,
              tenantId,
              providerId,
              ...profileData,
              createdAt: profileBefore?.createdAt || now,
            },
            update: profileData,
          });
        } catch (e: any) {
          await finishAudit({ tenantId, auditId, ok: false, error: String(e?.message || e) });
          // [SEC-10]
          return NextResponse.json({ error: 'Failed to update assignments', step: 'profile' }, { status: 500 });
        }

        // Upsert room assignments (raw)
        try {
          await upsertRawDoc('clinical_infra_provider_room_assignments', tenantId, providerId, roomsId, roomsData);
        } catch (e: any) {
          await finishAudit({ tenantId, auditId, ok: false, error: String(e?.message || e) });
          // [SEC-10]
          return NextResponse.json({ error: 'Failed to update assignments', step: 'rooms' }, { status: 500 });
        }

        // Upsert unit scopes (raw)
        try {
          await upsertRawDoc('clinical_infra_provider_unit_scopes', tenantId, providerId, scopesId, scopesData);
        } catch (e: any) {
          await finishAudit({ tenantId, auditId, ok: false, error: String(e?.message || e) });
          // [SEC-10]
          return NextResponse.json({ error: 'Failed to update assignments', step: 'scopes' }, { status: 500 });
        }

        // Upsert provider assignments via Prisma
        try {
          await prisma.clinicalInfraProviderAssignment.upsert({
            where: { tenantId_providerId: { tenantId, providerId } },
            create: {
              id: assignmentsId,
              tenantId,
              providerId,
              ...assignmentsData,
              createdAt: assignmentsBefore?.createdAt || now,
            },
            update: assignmentsData,
          });
        } catch (e: any) {
          await finishAudit({ tenantId, auditId, ok: false, error: String(e?.message || e) });
          // [SEC-10]
          return NextResponse.json({ error: 'Failed to update assignments', step: 'clinics' }, { status: 500 });
        }

        // Update scheduling resources if relevant fields changed
        const resourcePatch: any = {};
        if (body.consultationServiceCode !== undefined) {
          resourcePatch.consultationServiceCode = String(body.consultationServiceCode || '').trim() || null;
        }
        if (body.level !== undefined) {
          resourcePatch.level = String(body.level || '').trim().toUpperCase() || null;
        }
        if (Object.keys(resourcePatch).length) {
          try {
            await prisma.$executeRaw`
              UPDATE scheduling_resources
              SET "consultationServiceCode" = ${resourcePatch.consultationServiceCode},
                  "level" = ${resourcePatch.level}
              WHERE "tenantId" = ${tenantId}::uuid
                AND "resourceType" = 'PROVIDER'
                AND "resourceRef"->>'providerId' = ${providerId}
            `;
          } catch {
            // best-effort — scheduling resources may not exist
          }
        }

        await finishAudit({ tenantId, auditId, ok: true });

        const [profileResult, roomsResult, scopesResult, assignmentsResult] = await Promise.all([
          prisma.clinicalInfraProviderProfile.findFirst({ where: { tenantId, providerId } }),
          findRawDoc('clinical_infra_provider_room_assignments', tenantId, providerId),
          findRawDoc('clinical_infra_provider_unit_scopes', tenantId, providerId),
          prisma.clinicalInfraProviderAssignment.findFirst({ where: { tenantId, providerId } }),
        ]);

        return NextResponse.json({
          profile: profileResult,
          roomAssignments: roomsResult,
          unitScopes: scopesResult,
          providerAssignments: assignmentsResult,
        });
      } catch (e: any) {
        await finishAudit({ tenantId, auditId, ok: false, error: String(e?.message || e) });
        // [SEC-10]
        return NextResponse.json({ error: 'Failed to update assignments' }, { status: 500 });
      }
    },
  });
}, { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'clinical_infra.manage' });
