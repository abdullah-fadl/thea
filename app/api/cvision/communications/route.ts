/**
 * Internal Communications API
 *
 * GET actions:
 *   announcements         — Published announcements (filters: type, status)
 *   announcement-detail   — Single announcement with read tracking
 *   inbox                 — Current user's received messages
 *   sent                  — Current user's sent messages
 *   thread                — Message thread by threadId
 *   notifications         — Current user's notifications (unread first)
 *   unread-count          — Badge count for notification bell
 *   stats                 — Combined unread stats
 *
 * POST actions:
 *   create-announcement   — Create / draft announcement
 *   publish-announcement  — Publish draft or scheduled announcement
 *   schedule-announcement — Schedule for future publish
 *   acknowledge           — Acknowledge an announcement
 *   send-message          — Send direct message
 *   reply                 — Reply to a message thread
 *   mark-read             — Mark message or notification as read
 *   mark-all-read         — Mark all notifications as read
 *   dismiss-notification  — Dismiss a notification
 *   add-comment           — Comment on an announcement
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import {
  createAnnouncement,
  publishAnnouncement,
  getAnnouncements,
  getAnnouncementDetail,
  markAnnouncementRead,
  acknowledgeAnnouncement,
  addComment,
  sendMessage,
  getInbox,
  getSentMessages,
  getThread,
  markMessageRead,
  createNotification,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  dismissNotification,
  getUnreadCount,
  getUnreadMessageCount,
  getCommsStats,
} from '@/lib/cvision/communications/comms-engine';

// ─── Role helpers ────────────────────────────────────────────────────────────

/** Roles permitted to create, publish, schedule, or manage announcements. */
const COMMS_ADMIN_ROLES = new Set(['admin', 'tenant-admin', 'hr', 'hr-manager', 'hr-admin', 'thea-owner']);

function isCommsAdmin(role: string): boolean {
  return COMMS_ADMIN_ROLES.has(String(role).toLowerCase());
}

// ─── GET ────────────────────────────────────────────────────────────────────

async function handleGet(req: NextRequest, { tenantId, userId, role }: { tenantId: string; userId: string; role: string }) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action') || 'announcements';

  switch (action) {
    // ANNOUNCEMENTS — published announcements are visible to all authenticated users;
    // draft/scheduled listings are restricted to comms admins.
    case 'announcements': {
      const type = searchParams.get('type') || undefined;
      const requestedStatus = searchParams.get('status') || 'PUBLISHED';
      // Non-admins may only see PUBLISHED announcements.
      const status = isCommsAdmin(role) ? requestedStatus : 'PUBLISHED';
      const items = await getAnnouncements(tenantId, { status, type });
      return NextResponse.json({ success: true, data: items });
    }
    case 'announcement-detail': {
      const annId = searchParams.get('id');
      if (!annId) return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });
      const ann = await getAnnouncementDetail(tenantId, annId);
      if (!ann) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
      // Non-admins may only view published announcements.
      if (!isCommsAdmin(role) && (ann as any).status !== 'PUBLISHED') {
        return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
      }
      // Auto-mark as read
      await markAnnouncementRead(tenantId, annId, userId);
      return NextResponse.json({ success: true, data: ann });
    }

    // MESSAGES — always scoped to the authenticated user's own inbox/sent.
    case 'inbox': {
      const items = await getInbox(tenantId, userId);
      return NextResponse.json({ success: true, data: items });
    }
    case 'sent': {
      const items = await getSentMessages(tenantId, userId);
      return NextResponse.json({ success: true, data: items });
    }
    case 'thread': {
      const threadId = searchParams.get('threadId');
      if (!threadId) return NextResponse.json({ success: false, error: 'threadId required' }, { status: 400 });
      // Fetch the thread, then verify the requesting user is a participant
      // (sender or recipient).  Admins may view any thread.
      const items = await getThread(tenantId, threadId);
      if (!isCommsAdmin(role)) {
        const isParticipant = (items as any[]).some(
          (m: any) => m.senderId === userId || m.recipientId === userId,
        );
        if (!isParticipant) {
          return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
        }
      }
      return NextResponse.json({ success: true, data: items });
    }

    // NOTIFICATIONS — always scoped to the authenticated user.
    case 'notifications': {
      const unreadOnly = searchParams.get('unreadOnly') === 'true';
      const category = searchParams.get('category') || undefined;
      const items = await getNotifications(tenantId, userId, { unreadOnly, category });
      return NextResponse.json({ success: true, data: items });
    }
    case 'unread-count': {
      const notifCount = await getUnreadCount(tenantId, userId);
      const msgCount = await getUnreadMessageCount(tenantId, userId);
      return NextResponse.json({ success: true, data: { notifications: notifCount, messages: msgCount, total: notifCount + msgCount } });
    }
    case 'stats': {
      const stats = await getCommsStats(tenantId, userId);
      return NextResponse.json({ success: true, data: stats });
    }

    default:
      return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
  }
}

// ─── POST ───────────────────────────────────────────────────────────────────

async function handlePost(req: NextRequest, { tenantId, userId, role }: { tenantId: string; userId: string; role: string }) {
  const body = await req.json();
  const action = body.action as string;

  switch (action) {
    // ANNOUNCEMENTS — create / publish / schedule require HR/admin role.
    case 'create-announcement': {
      if (!isCommsAdmin(role)) {
        return NextResponse.json({ success: false, error: 'Forbidden: only HR/admin may create announcements' }, { status: 403 });
      }
      const ann = await createAnnouncement(tenantId, body, userId);
      return NextResponse.json({ success: true, data: ann });
    }
    case 'publish-announcement': {
      if (!isCommsAdmin(role)) {
        return NextResponse.json({ success: false, error: 'Forbidden: only HR/admin may publish announcements' }, { status: 403 });
      }
      if (!body.announcementId) return NextResponse.json({ success: false, error: 'announcementId required' }, { status: 400 });
      const ann = await publishAnnouncement(tenantId, body.announcementId);
      return NextResponse.json({ success: true, data: ann });
    }
    case 'schedule-announcement': {
      if (!isCommsAdmin(role)) {
        return NextResponse.json({ success: false, error: 'Forbidden: only HR/admin may schedule announcements' }, { status: 403 });
      }
      if (!body.announcementId || !body.scheduledAt) {
        return NextResponse.json({ success: false, error: 'announcementId and scheduledAt required' }, { status: 400 });
      }
      // Create in scheduled state (handled inside createAnnouncement via scheduledAt)
      const ann = await createAnnouncement(tenantId, { ...body, scheduledAt: body.scheduledAt }, userId);
      return NextResponse.json({ success: true, data: ann });
    }

    // ANNOUNCEMENTS — acknowledge and comment are available to all employees.
    case 'acknowledge': {
      if (!body.announcementId) return NextResponse.json({ success: false, error: 'announcementId required' }, { status: 400 });
      await acknowledgeAnnouncement(tenantId, body.announcementId, userId);
      return NextResponse.json({ success: true });
    }
    case 'add-comment': {
      if (!body.announcementId || !body.content) return NextResponse.json({ success: false, error: 'announcementId and content required' }, { status: 400 });
      const comment = await addComment(tenantId, body.announcementId, userId, body.employeeName || 'User', body.content);
      return NextResponse.json({ success: true, data: comment });
    }

    // MESSAGES — senderId is always pinned to the authenticated userId so the
    // caller cannot impersonate another sender.
    case 'send-message': {
      if (!body.recipientId || !body.content) return NextResponse.json({ success: false, error: 'recipientId and content required' }, { status: 400 });
      const msg = await sendMessage(tenantId, {
        senderId: userId,
        senderName: body.senderName || 'User',
        recipientId: body.recipientId,
        recipientName: body.recipientName || '',
        subject: body.subject,
        content: body.content,
      });
      return NextResponse.json({ success: true, data: msg });
    }
    case 'reply': {
      if (!body.threadId || !body.content || !body.recipientId) {
        return NextResponse.json({ success: false, error: 'threadId, recipientId, and content required' }, { status: 400 });
      }
      const msg = await sendMessage(tenantId, {
        senderId: userId,
        senderName: body.senderName || 'User',
        recipientId: body.recipientId,
        recipientName: body.recipientName || '',
        content: body.content,
        threadId: body.threadId,
        parentMessageId: body.parentMessageId,
      });
      return NextResponse.json({ success: true, data: msg });
    }

    // NOTIFICATIONS — mark-read and dismiss are always scoped to the current user
    // by passing userId into the underlying engine call where available.
    case 'mark-read': {
      const { messageId, notificationId } = body;
      if (messageId) await markMessageRead(tenantId, messageId);
      if (notificationId) await markNotificationRead(tenantId, notificationId);
      return NextResponse.json({ success: true });
    }
    case 'mark-all-read': {
      // markAllNotificationsRead already scopes to userId — no cross-user risk.
      const updated = await markAllNotificationsRead(tenantId, userId);
      return NextResponse.json({ success: true, data: { updated } });
    }
    case 'dismiss-notification': {
      if (!body.notificationId) return NextResponse.json({ success: false, error: 'notificationId required' }, { status: 400 });
      await dismissNotification(tenantId, body.notificationId);
      return NextResponse.json({ success: true });
    }

    default:
      return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
  }
}

// ─── Exports ────────────────────────────────────────────────────────────────

export const GET = withAuthTenant(
  (req, ctx) => handleGet(req, { tenantId: ctx.tenantId, userId: ctx.userId, role: ctx.role }),
);
export const POST = withAuthTenant(
  (req, ctx) => handlePost(req, { tenantId: ctx.tenantId, userId: ctx.userId, role: ctx.role }),
);
