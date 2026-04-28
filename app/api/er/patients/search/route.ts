import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
  const { searchParams } = new URL(req.url);
  const rawQuery = (searchParams.get('query') || '').trim();

  if (!rawQuery) {
    return NextResponse.json({ results: [] });
  }

  // Escape special characters for safe LIKE matching
  const escaped = rawQuery.replace(/[%_\\]/g, '\\$&');
  const pattern = `%${escaped}%`;

  const results = await prisma.patientMaster.findMany({
    where: {
      tenantId,
      OR: [
        { mrn: { contains: rawQuery, mode: 'insensitive' } },
        { fullName: { contains: rawQuery, mode: 'insensitive' } },
      ],
    },
    take: 10,
  });

  return NextResponse.json({ results });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'er.register.view' }
);
