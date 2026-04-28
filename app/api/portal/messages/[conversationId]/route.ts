import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePortalSession } from '@/lib/portal/auth';
import { prisma } from '@/lib/db/prisma';
import { nanoid } from 'nanoid';
import { validateBody } from '@/lib/validation/helpers';
import { withErrorHandler } from '@/lib/core/errors';

const portalSendMessageSchema = z.object({
  content: z.string().min(1, 'content is required'),
}).passthrough();

function sanitizeContent(text: string): string {
  return String(text || '')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .trim()
    .slice(0, 5000);
}

export const GET = withErrorHandler(async (
  req: NextRequest,
  { params }: { params: { conversationId: string } }
) => {
  const session = await requirePortalSession(req);
  if (session instanceof NextResponse) return session;

  const conversationId = String(params.conversationId || '').trim();
  if (!conversationId) {
    return NextResponse.json({ error: 'Missing conversationId' }, { status: 400 });
  }

  const portalUser = await prisma.patientPortalUser.findFirst({
    where: { tenantId: session.tenantId, id: session.portalUserId },
  });

  const patientId = portalUser?.patientMasterId || session.patientMasterId;
  if (!patientId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const conversation = await prisma.patientConversation.findFirst({
    where: {
      id: conversationId,
      tenantId: session.tenantId,
      patientId,
    },
  });

  if (!conversation) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const messages = await prisma.patientMessage.findMany({
    where: { conversationId, tenantId: session.tenantId },
    orderBy: { createdAt: 'asc' },
    take: 200,
  });

  // Mark unread provider messages as read
  await prisma.patientMessage.updateMany({
    where: {
      conversationId,
      tenantId: session.tenantId,
      senderType: 'provider',
      read: false,
    },
    data: { read: true, readAt: new Date() },
  });

  await prisma.patientConversation.updateMany({
    where: { id: conversationId, tenantId: session.tenantId },
    data: { unreadCount: 0 },
  });

  return NextResponse.json({ items: messages });
});

export const POST = withErrorHandler(async (
  req: NextRequest,
  { params }: { params: { conversationId: string } }
) => {
  const session = await requirePortalSession(req);
  if (session instanceof NextResponse) return session;

  const conversationId = String(params.conversationId || '').trim();
  if (!conversationId) {
    return NextResponse.json({ error: 'Missing conversationId' }, { status: 400 });
  }

  const portalUser = await prisma.patientPortalUser.findFirst({
    where: { tenantId: session.tenantId, id: session.portalUserId },
  });

  const patientId = portalUser?.patientMasterId || session.patientMasterId;
  if (!patientId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const v = validateBody(body, portalSendMessageSchema);
  if ('error' in v) return v.error;
  const { content } = v.data;
  const sanitized = sanitizeContent(content);
  if (!sanitized) {
    return NextResponse.json({ error: 'Message content is required' }, { status: 400 });
  }

  const conversation = await prisma.patientConversation.findFirst({
    where: {
      id: conversationId,
      tenantId: session.tenantId,
      patientId,
    },
  });

  if (!conversation) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const patient = await prisma.patientMaster.findFirst({
    where: { tenantId: session.tenantId, id: patientId },
  });
  const senderName = patient?.fullName || (portalUser as any)?.fullName || 'Patient';

  const message = await prisma.patientMessage.create({
    data: {
      tenantId: session.tenantId,
      conversationId,
      senderId: patientId,
      senderType: 'patient',
      senderName,
      content: sanitized,
      read: false,
    },
  });

  await prisma.patientConversation.updateMany({
    where: { id: conversationId, tenantId: session.tenantId },
    data: {
      lastMessage: sanitized,
      lastMessageAt: new Date(),
    },
  });

  return NextResponse.json({ success: true, message });
});
