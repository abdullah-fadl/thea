import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { grantPrivilege } from '@/lib/credentialing/engine';
import { validateBody } from '@/lib/validation/helpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/credentialing/privileges
 * List privileges, filterable by userId, status, type
 */
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const { searchParams } = req.nextUrl;
    const userId = searchParams.get('userId');
    const status = searchParams.get('status');
    const privilegeType = searchParams.get('type');
    const department = searchParams.get('department');

    const where: Record<string, any> = { tenantId };
    if (userId) where.userId = userId;
    if (status) where.status = status;
    if (privilegeType) where.privilegeType = privilegeType;
    if (department) where.department = department;

    const items = await prisma.clinicalPrivilege.findMany({
      where,
      orderBy: { grantedAt: 'desc' },
      take: 500,
    });

    return NextResponse.json({ items });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'credentialing.view' },
);

/**
 * POST /api/credentialing/privileges
 * Grant a clinical privilege
 */
const grantSchema = z.object({
  userId: z.string().min(1),
  staffName: z.string().min(1),
  privilegeType: z.string().min(1),
  privilegeCode: z.string().optional(),
  department: z.string().optional(),
  expiresAt: z.string().optional(),
  conditions: z.string().optional(),
  supervisorId: z.string().optional(),
  caseLogRequired: z.number().optional(),
  notes: z.string().optional(),
  status: z.string().optional(),
});

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId: actorId, user }) => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const result = validateBody(body, grantSchema);
    if ('error' in result) return result.error;
    const data = result.data;

    const privilege = await grantPrivilege(
      {
        tenantId,
        userId: data.userId,
        staffName: data.staffName,
        privilegeType: data.privilegeType,
        privilegeCode: data.privilegeCode,
        department: data.department,
        grantedBy: actorId,
        grantedByName: user?.email || undefined,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
        conditions: data.conditions,
        supervisorId: data.supervisorId,
        caseLogRequired: data.caseLogRequired,
        notes: data.notes,
        status: data.status,
      },
      user?.email,
    );

    return NextResponse.json({ success: true, id: privilege.id, privilege });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'credentialing.manage' },
);
