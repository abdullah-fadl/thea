import { NextRequest, NextResponse } from 'next/server';
import { generateExplanation, startChatSession, sendChatMessage } from '@/lib/ai/patient/explainer';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';

async function getPortalAuth(req: NextRequest) {
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
export async function POST(req: NextRequest) {
  try {
    const auth = await getPortalAuth(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();

    // Chat mode
    if (body.action === 'chat_start') {
      const session = await startChatSession(auth.tenantId, auth.patientId, body.message);
      return NextResponse.json(session, { status: 201 });
    }

    if (body.action === 'chat_message' && body.sessionId) {
      const session = await sendChatMessage(auth.tenantId, body.sessionId, body.message);
      if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      return NextResponse.json(session);
    }

    // Explain mode
    if (!body.type || !body.content) {
      return NextResponse.json({ error: 'type and content are required' }, { status: 400 });
    }

    const explanation = await generateExplanation({
      patientId: auth.patientId,
      tenantId: auth.tenantId,
      type: body.type,
      content: body.content,
      language: body.language || 'ar',
      context: body.context,
    });

    return NextResponse.json(explanation, { status: 201 });
  } catch (error) {
    logger.error('Portal explain error', { category: 'api', route: 'POST /api/portal/explain', error });
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
