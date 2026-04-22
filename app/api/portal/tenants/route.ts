import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const RATE_WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_IP = 30;

function getClientIp(request: NextRequest) {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return (
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    request.ip ||
    'unknown'
  );
}

export const GET = withErrorHandler(async (request: NextRequest) => {
  // --- Rate limiting by IP ---
  const ip = getClientIp(request);
  const windowStart = new Date(Date.now() - RATE_WINDOW_MS);
  const ipCount = await prisma.patientPortalRateLimit.count({
    where: {
      type: 'tenants_list_ip',
      key: ip,
      createdAt: { gte: windowStart },
    },
  });
  if (ipCount >= MAX_PER_IP) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
  }
  await prisma.patientPortalRateLimit.create({
    data: {
      type: 'tenants_list_ip',
      key: ip,
    },
  });

  // --- Fetch tenants with minimal data ---
  const tenants = await prisma.tenant.findMany({
    where: { status: 'ACTIVE' },
    orderBy: [{ name: 'asc' }, { tenantId: 'asc' }],
    take: 500,
  });

  const items = tenants.map((tenant: any) => ({
    tenantId: tenant.tenantId || null,
    name: tenant.name || tenant.tenantId || 'Tenant',
    ...(tenant.nameAr ? { nameAr: tenant.nameAr } : {}),
    ...(tenant.logo ? { logo: tenant.logo } : {}),
  }));

  const response = NextResponse.json({ items });
  response.headers.set('Cache-Control', 'public, max-age=300');
  return response;
});
