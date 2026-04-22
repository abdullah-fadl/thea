import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';

async function getPortalAuth() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('portal_token')?.value;
    if (!token) return null;
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET environment variable is required');
    }
    const secret = new TextEncoder().encode(jwtSecret);
    const { payload } = await jwtVerify(token, secret);
    return payload as { patientId: string; tenantId: string };
  } catch {
    return null;
  }
}

// [SEC-10] Added try/catch error handler for portal route
export async function GET(req: NextRequest) {
  try {
    const auth = await getPortalAuth();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const params = new URL(req.url).searchParams;
    const status = params.get('status') || 'active'; // 'active' | 'all'

    const where: any = {
      tenantId: auth.tenantId,
      patientMasterId: auth.patientId,
      kind: 'MEDICATION',
    };

    if (status === 'active') {
      where.status = { in: ['active', 'ordered'] };
    }

    const medications = await prisma.ordersHub.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({ medications, total: medications.length });
  } catch (error) {
    logger.error('Portal medications error', { category: 'api', route: 'GET /api/portal/medications', error });
    return NextResponse.json({ error: 'Failed to fetch medications' }, { status: 500 });
  }
}
