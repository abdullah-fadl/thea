import { NextRequest, NextResponse } from 'next/server';
import { getChatHistory } from '@/lib/ai/patient/explainer';
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

    const history = await getChatHistory(auth.tenantId, auth.patientId);
    return NextResponse.json({ sessions: history, total: history.length });
  } catch (error) {
    logger.error('Portal chat history error', { category: 'api', route: 'GET /api/portal/explain/history', error });
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
  }
}
