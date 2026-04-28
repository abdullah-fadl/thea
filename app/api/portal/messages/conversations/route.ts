import { NextRequest, NextResponse } from 'next/server';
import { requirePortalSession } from '@/lib/portal/auth';
import { prisma } from '@/lib/db/prisma';
import { withErrorHandler } from '@/lib/core/errors';

export const GET = withErrorHandler(async (req: NextRequest) => {
  const session = await requirePortalSession(req);
  if (session instanceof NextResponse) return session;

  const portalUser = await prisma.patientPortalUser.findFirst({
    where: { tenantId: session.tenantId, id: session.portalUserId },
  });

  const patientId = portalUser?.patientMasterId || session.patientMasterId;
  if (!patientId) {
    return NextResponse.json({ items: [] });
  }

  const conversations = await prisma.patientConversation.findMany({
    where: { patientId, tenantId: session.tenantId },
    orderBy: { lastMessageAt: 'desc' },
    take: 100,
  });

  const providerIds = conversations.map((c: any) => c.providerId).filter(Boolean);
  const providers = providerIds.length
    ? await prisma.clinicalInfraProvider.findMany({
        where: { id: { in: providerIds }, tenantId: session.tenantId },
      })
    : [];
  const providerMap = new Map(providers.map((p: any) => [p.id, p]));

  const items = conversations.map((conv: any) => ({
    ...conv,
    providerName: (providerMap.get(conv.providerId) as Record<string, string>)?.name || '\u0637\u0628\u064a\u0628',
    unreadCount: conv.unreadCount || 0,
  }));

  return NextResponse.json({ items });
});
