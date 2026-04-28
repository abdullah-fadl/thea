import { NextRequest, NextResponse } from 'next/server';
import { withTenantOwner } from '@/lib/core/guards/withTenantOwner';
import { prisma } from '@/lib/db/prisma';

/**
 * POST /api/tenant-owner/hospitals
 * Create a hospital under the caller's tenant.
 * tenantId is always sourced from the JWT — caller cannot target another tenant.
 *
 * Body: { name: string; code?: string; groupId: string }
 * Response: 201 { id, tenantId, groupId, name, code }
 */
export const POST = withTenantOwner(async (req, { tenantId, userId }) => {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.name !== 'string' || !body.name.trim()) {
    return NextResponse.json(
      { error: 'Bad Request', message: 'name is required' },
      { status: 400 },
    );
  }
  if (typeof body.groupId !== 'string' || !body.groupId.trim()) {
    return NextResponse.json(
      { error: 'Bad Request', message: 'groupId is required' },
      { status: 400 },
    );
  }

  // Verify the group belongs to the caller's tenant (prevents cross-tenant group use)
  const group = await prisma.orgGroup.findFirst({
    where: { id: body.groupId, tenantId },
    select: { id: true },
  });
  if (!group) {
    return NextResponse.json(
      { error: 'Bad Request', message: 'groupId not found in this tenant' },
      { status: 400 },
    );
  }

  const hospital = await prisma.hospital.create({
    data: {
      tenantId,
      groupId: body.groupId,
      name: body.name.trim(),
      code: body.code ? String(body.code).trim() || undefined : undefined,
      createdBy: userId,
    },
    select: { id: true, tenantId: true, groupId: true, name: true, code: true },
  });

  return NextResponse.json(hospital, { status: 201 });
});

/**
 * GET /api/tenant-owner/hospitals
 * List all hospitals under the caller's tenant.
 * Response: 200 { items: Hospital[] }
 */
export const GET = withTenantOwner(async (_req, { tenantId }) => {
  const items = await prisma.hospital.findMany({
    where: { tenantId },
    select: {
      id: true,
      tenantId: true,
      groupId: true,
      name: true,
      code: true,
      isActive: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json({ items });
});
