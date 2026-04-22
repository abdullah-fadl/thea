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
    const type = params.get('type'); // 'lab' | 'radiology' | 'all'

    const where = {
      tenantId: auth.tenantId,
      patientId: auth.patientId,
    };

    if (type === 'lab') {
      const results = await prisma.labResult.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
      return NextResponse.json({ results, total: results.length });
    }

    if (type === 'radiology') {
      const results = await prisma.radiologyReport.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
      return NextResponse.json({ results, total: results.length });
    }

    // All results combined
    const [labResults, radResults] = await Promise.all([
      prisma.labResult.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      prisma.radiologyReport.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    return NextResponse.json({
      labResults,
      radiologyResults: radResults,
      total: labResults.length + radResults.length,
    });
  } catch (error) {
    logger.error('Portal results error', { category: 'api', route: 'GET /api/portal/results', error });
    return NextResponse.json({ error: 'Failed to fetch results' }, { status: 500 });
  }
}
