import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { canAccessBilling } from '@/lib/billing/access';
import { createAuditLog } from '@/lib/utils/audit';
import { validateBody } from '@/lib/validation/helpers';
import { normalizeArabicNumerals } from '@/lib/utils';
import { z } from 'zod';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const createDiagnosisSchema = z.object({
  code: z.string().min(1, 'code is required'),
  name: z.string().min(1, 'name is required'),
  category: z.string().optional(),
  icd10: z.string().optional(),
});

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const search = normalizeArabicNumerals(String(req.nextUrl.searchParams.get('search') || req.nextUrl.searchParams.get('q') || '').trim());
    const where: any = { tenantId };
    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { icd10: { contains: search, mode: 'insensitive' } },
      ];
    }

    const items = await prisma.diagnosisCatalog.findMany({
      where,
      orderBy: [{ name: 'asc' }],
    });

    return NextResponse.json({ items });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'billing.view' }
);

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user, role }) => {
    if (!canAccessBilling({ email: user?.email, tenantId, role })) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const v = validateBody(body, createDiagnosisSchema);
    if ('error' in v) return v.error;

    const code = String(v.data.code).trim().toUpperCase();
    const name = String(v.data.name).trim();
    const category = String(v.data.category || '').trim() || null;
    const icd10 = String(v.data.icd10 || '').trim() || null;

    const existingItem = await prisma.diagnosisCatalog.findFirst({ where: { tenantId, code } });
    if (existingItem) {
      return NextResponse.json({ error: 'Diagnosis code already exists', code: 'CODE_EXISTS' }, { status: 409 });
    }

    const now = new Date();
    let item;
    try {
      item = await prisma.diagnosisCatalog.create({
        data: {
          id: uuidv4(),
          tenantId,
          code,
          name,
          category,
          icd10,
          createdAt: now,
          updatedAt: now,
          createdByUserId: userId,
        },
      });
    } catch (err: unknown) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return NextResponse.json({ error: 'Diagnosis code already exists' }, { status: 409 });
      }
      throw err;
    }

    await createAuditLog(
      'diagnosis_catalog',
      item.id,
      'CREATE',
      userId || 'system',
      user?.email,
      { after: item },
      tenantId
    );

    return NextResponse.json({ item });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'billing.view' }
);
