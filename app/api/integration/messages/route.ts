import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { queryMessages, markForRetry, getMessageStats, type MessageFilter } from '@/lib/integration/messageQueue';
import type { MessageDirection, MessageProtocol, MessageStatus } from '@/lib/integration/hl7/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/integration/messages?direction=INBOUND&protocol=HL7&status=FAILED&page=1&limit=50
 *
 * List integration messages with filtering.
 */
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const sp = req.nextUrl.searchParams;
    const filter: MessageFilter = {};

    if (sp.get('direction')) filter.direction = sp.get('direction') as MessageDirection;
    if (sp.get('protocol')) filter.protocol = sp.get('protocol') as MessageProtocol;
    if (sp.get('status')) filter.status = sp.get('status') as MessageStatus;
    if (sp.get('instrumentId')) filter.instrumentId = sp.get('instrumentId')!;
    if (sp.get('messageType')) filter.messageType = sp.get('messageType')!;
    if (sp.get('search')) filter.search = sp.get('search')!;
    if (sp.get('startDate')) filter.startDate = new Date(sp.get('startDate')!);
    if (sp.get('endDate')) filter.endDate = new Date(sp.get('endDate')!);

    const page = Number(sp.get('page') || 1);
    const limit = Math.min(Number(sp.get('limit') || 50), 200);

    // Stats mode
    if (sp.get('stats') === 'true') {
      const since = sp.get('since') ? new Date(sp.get('since')!) : undefined;
      const stats = await getMessageStats(tenantId, since);
      return NextResponse.json({ stats });
    }

    const { messages, total } = await queryMessages(tenantId, filter, page, limit);

    return NextResponse.json({
      messages,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  }),
  { tenantScoped: true, permissionKey: 'admin.settings' },
);

/**
 * POST /api/integration/messages
 * Body: { action: "retry", messageId: "..." }
 *
 * Retry a failed message.
 */
export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const body = await req.json().catch(() => ({}));
    const { action, messageId } = body;

    if (action === 'retry' && messageId) {
      const success = await markForRetry(tenantId, messageId, 'Manual retry requested');
      return NextResponse.json({ success, messageId });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }),
  { tenantScoped: true, permissionKey: 'admin.settings' },
);
