import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { createAuditLog } from '@/lib/utils/audit';
import { validateBody } from '@/lib/validation/helpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/credentialing/credentials
 * List credentials, filterable by userId, status, credentialType, expiring
 */
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const { searchParams } = req.nextUrl;
    const userId = searchParams.get('userId');
    const status = searchParams.get('status');
    const credentialType = searchParams.get('type');
    const expiring = searchParams.get('expiring'); // 'true' to filter expiring
    const category = searchParams.get('category');
    const verificationStatus = searchParams.get('verificationStatus');

    const where: Record<string, any> = { tenantId };
    if (userId) where.userId = userId;
    if (status) where.status = status;
    if (credentialType) where.credentialType = credentialType;
    if (category) where.category = category;
    if (verificationStatus) where.verificationStatus = verificationStatus;

    if (expiring === 'true') {
      const now = new Date();
      const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      where.expiryDate = { gte: now, lte: thirtyDaysFromNow };
      where.status = { notIn: ['expired', 'revoked'] };
    }

    const items = await prisma.staffCredential.findMany({
      where,
      orderBy: { expiryDate: 'asc' },
      take: 500,
    });

    return NextResponse.json({ items });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'credentialing.view' },
);

/**
 * POST /api/credentialing/credentials
 * Add a new credential
 */
const createSchema = z.object({
  userId: z.string().min(1),
  staffName: z.string().min(1),
  staffNameAr: z.string().optional(),
  credentialType: z.string().min(1),
  credentialNumber: z.string().optional(),
  issuingAuthority: z.string().min(1),
  issuingAuthorityAr: z.string().optional(),
  issueDate: z.string().min(1), // ISO date string
  expiryDate: z.string().optional(),
  status: z.string().optional(),
  verificationStatus: z.string().optional(),
  documentUrl: z.string().optional(),
  category: z.string().optional(),
  specialtyCode: z.string().optional(),
  notes: z.string().optional(),
});

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId: actorId, user }) => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const result = validateBody(body, createSchema);
    if ('error' in result) return result.error;
    const data = result.data;

    const credential = await prisma.staffCredential.create({
      data: {
        tenantId,
        userId: data.userId,
        staffName: data.staffName,
        staffNameAr: data.staffNameAr || null,
        credentialType: data.credentialType,
        credentialNumber: data.credentialNumber || null,
        issuingAuthority: data.issuingAuthority,
        issuingAuthorityAr: data.issuingAuthorityAr || null,
        issueDate: new Date(data.issueDate),
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
        status: data.status || 'active',
        verificationStatus: data.verificationStatus || 'pending',
        documentUrl: data.documentUrl || null,
        category: data.category || null,
        specialtyCode: data.specialtyCode || null,
        notes: data.notes || null,
      },
    });

    await createAuditLog(
      'staff_credential',
      credential.id,
      'CREATE',
      actorId,
      user?.email,
      { after: credential },
      tenantId,
    );

    return NextResponse.json({ success: true, id: credential.id, credential });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'credentialing.manage' },
);
