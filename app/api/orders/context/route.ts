import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const orderId = String(new URL(req.url).searchParams.get('orderId') || '').trim();
    if (!orderId) {
      return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
    }

    const link = await prisma.orderContextLink.findFirst({
      where: { tenantId, orderId },
    });
    if (!link) {
      return NextResponse.json({ orderId, link: null });
    }

    const note = link.noteId
      ? await prisma.clinicalNote.findFirst({
          where: { tenantId, id: link.noteId },
        })
      : null;

    const noteSummary = note
      ? {
          id: note.id,
          noteType: note.noteType,
          area: note.area,
          title: note.title,
          createdAt: note.createdAt,
          author: note.author || null,
        }
      : null;

    return NextResponse.json({
      orderId,
      noteId: link.noteId,
      note: noteSummary,
      reason: link.reason || null,
      linkedAt: link.linkedAt,
    });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'orders.hub.view' }
);
