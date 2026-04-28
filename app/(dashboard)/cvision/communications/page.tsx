'use client';

import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionBadge, CVisionButton, CVisionCard, CVisionCardBody, CVisionCardHeader, CVisionInput, CVisionLabel, CVisionSkeletonCard, CVisionSkeletonStyles, CVisionTextarea, CVisionSelect, CVisionDialog, CVisionDialogFooter , CVisionTabs, CVisionTabContent } from '@/components/cvision/ui';

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cvisionFetch, cvisionMutate, cvisionKeys } from '@/lib/cvision/hooks';

import {
  Megaphone, MessageSquare, Bell, PenLine, Pin,
  Eye, CheckCircle2, Send, Reply, Trash2, ChevronRight,
  AlertTriangle, Info, Clock, Star, Users, Search,
  MessageCircle
} from 'lucide-react';

// ─── helpers ────────────────────────────────────────────────────────────────

function fetchComms(action: string, params: Record<string, string> = {}) {
  return cvisionFetch<any>('/api/cvision/communications', { params: { action, ...params } });
}
function postComms(body: Record<string, any>) {
  return cvisionMutate<any>('/api/cvision/communications', 'POST', body);
}

const priorityColor: Record<string, string> = {
  LOW: 'bg-gray-100 text-gray-700',
  NORMAL: 'bg-blue-100 text-blue-700',
  HIGH: 'bg-orange-100 text-orange-700',
  URGENT: 'bg-red-100 text-red-700',
};

const typeIcon: Record<string, string> = {
  GENERAL: '📋', POLICY: '📜', EVENT: '🎉', URGENT: '🚨', HR_UPDATE: '🏢', SYSTEM: '⚙️',
};

const notifIcon: Record<string, typeof Bell> = {
  ACTION_REQUIRED: AlertTriangle,
  APPROVAL: CheckCircle2,
  WARNING: AlertTriangle,
  INFO: Info,
  REMINDER: Clock,
  SYSTEM: Star,
};

const notifColor: Record<string, string> = {
  ACTION_REQUIRED: 'text-yellow-600',
  APPROVAL: 'text-green-600',
  WARNING: 'text-orange-600',
  INFO: 'text-blue-600',
  REMINDER: 'text-green-600',
  SYSTEM: 'text-gray-500',
};

function relTime(d: string | Date) {
  const ms = Date.now() - new Date(d).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ═══════════════════════════════════════════════════════════════════════════
// Main page
// ═══════════════════════════════════════════════════════════════════════════

export default function CommunicationsPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const [tab, setTab] = useState('announcements');

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 8 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>Communications</h1>
          <p style={{ fontSize: 13, color: C.textMuted }}>Internal announcements, messages &amp; notifications</p>
        </div>
      </div>

      <CVisionTabs
        C={C}
        activeTab={tab}
        onChange={setTab}
        tabs={[
          { id: 'announcements', label: tr('الإعلانات', 'Announcements'), icon: <Megaphone size={14} /> },
          { id: 'messages', label: tr('الرسائل', 'Messages'), icon: <MessageSquare size={14} /> },
          { id: 'notifications', label: tr('الإشعارات', 'Notifications'), icon: <Bell size={14} /> },
          { id: 'compose', label: tr('إنشاء', 'Compose'), icon: <PenLine size={14} /> },
        ]}
      >
        <CVisionTabContent tabId="announcements"><AnnouncementsTab /></CVisionTabContent>
        <CVisionTabContent tabId="messages"><MessagesTab /></CVisionTabContent>
        <CVisionTabContent tabId="notifications"><NotificationsTab /></CVisionTabContent>
        <CVisionTabContent tabId="compose"><ComposeTab /></CVisionTabContent>
      </CVisionTabs>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 1 — Announcements
// ═══════════════════════════════════════════════════════════════════════════

function AnnouncementsTab() {
  const { C, isDark } = useCVisionTheme();
  const [detail, setDetail] = useState<any>(null);
  const [commentText, setCommentText] = useState('');

  const announcementsQuery = useQuery({
    queryKey: cvisionKeys.communications.list({ action: 'announcements' }),
    queryFn: () => fetchComms('announcements'),
  });
  const items = announcementsQuery.data?.data?.items || announcementsQuery.data?.data || [];
  const loading = announcementsQuery.isLoading;
  const load = useCallback(() => announcementsQuery.refetch(), [announcementsQuery]);

  async function onAcknowledge(id: string) {
    await postComms({ action: 'acknowledge', announcementId: id });
    load();
  }

  async function openDetail(id: string) {
    const res = await fetchComms('announcement-detail', { id });
    setDetail(res.data || null);
  }

  async function addComment() {
    if (!commentText.trim() || !detail) return;
    await postComms({ action: 'add-comment', announcementId: detail.announcementId || detail.id, content: commentText });
    setCommentText('');
    const res = await fetchComms('announcement-detail', { id: detail.announcementId || detail.id });
    setDetail(res.data || null);
    load();
  }

  if (loading) return <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>{[1,2,3].map(i => <CVisionSkeletonCard C={C} height={200} key={i} style={{ height: 160, width: '100%' }} />)}</div>;

  const pinned = items.filter(a => a.pinned);
  const regular = items.filter(a => !a.pinned);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
      {items.length === 0 && (
        <CVisionCard C={C}><CVisionCardBody style={{ paddingTop: 48, paddingBottom: 48, textAlign: 'center', color: C.textMuted }}>
          No announcements yet. Compose one from the Compose tab.
        </CVisionCardBody></CVisionCard>
      )}

      {/* Pinned */}
      {pinned.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}><Pin size={14}/> Pinned</h3>
          {pinned.map(a => <AnnCard key={a.id} ann={a} onAck={onAcknowledge} onOpen={openDetail}/>)}
        </div>
      )}

      {/* Regular */}
      {regular.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {pinned.length > 0 && <h3 style={{ fontSize: 13, fontWeight: 600 }}>Recent</h3>}
          {regular.map(a => <AnnCard key={a.id} ann={a} onAck={onAcknowledge} onOpen={openDetail}/>)}
        </div>
      )}

      {/* Detail dialog */}
      <CVisionDialog C={C} open={!!detail} onClose={() => setDetail(null)} title="Details" isDark={isDark}>
          {detail && (
            <>                
                <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>View the full announcement details, read status, and comments.</p>              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontSize: 13 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  <CVisionBadge C={C} className={priorityColor[detail.priority]}>{detail.priority}</CVisionBadge>
                  <CVisionBadge C={C} variant="outline">{detail.type}</CVisionBadge>
                  <CVisionBadge C={C} variant="secondary">
                    <Eye size={12} style={{ marginRight: 4 }}/> {detail.readCount}/{detail.totalAudience} read
                  </CVisionBadge>
                  {detail.requiresAcknowledgment && (
                    <CVisionBadge C={C} variant="secondary">
                      <CheckCircle2 size={12} style={{ marginRight: 4 }}/> {(detail.acknowledgedBy||[]).length}/{detail.totalAudience} acknowledged
                    </CVisionBadge>
                  )}
                </div>
                <p style={{ color: C.textMuted }}>{detail.content}</p>
                {detail.contentAr && <p style={{ color: C.textMuted }}>{detail.contentAr}</p>}
                <p style={{ fontSize: 12, color: C.textMuted }}>
                  Published by {detail.publishedByName} · {detail.publishedAt ? new Date(detail.publishedAt).toLocaleDateString() : 'Draft'}
                </p>

                {/* Comments */}
                {detail.allowComments && (
                  <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <h4 style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}><MessageCircle size={14}/> Comments ({(detail.comments||[]).length})</h4>
                    {(detail.comments || []).map((c: any) => (
                      <div key={c.id} style={{ borderRadius: 6, padding: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <p style={{ fontSize: 12, fontWeight: 500 }}>{c.employeeName} · {relTime(c.createdAt)}</p>
                        <p style={{ fontSize: 13 }}>{c.content}</p>
                      </div>
                    ))}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <CVisionInput C={C} placeholder="Add a comment…" value={commentText} onChange={e => setCommentText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addComment(); }}/>
                      <CVisionButton C={C} isDark={isDark} size="sm" onClick={addComment} disabled={!commentText.trim()}>Post</CVisionButton>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
      </CVisionDialog>
    </div>
  );
}

function AnnCard({ ann, onAck, onOpen }: { ann: any; onAck: (id: string) => void; onOpen: (id: string) => void }) {
  const { C, isDark } = useCVisionTheme();
  return (
    <CVisionCard C={C} className="border-l-4" style={{ borderLeftColor: ann.priority === 'URGENT' ? '#ef4444' : ann.priority === 'HIGH' ? '#f97316' : '#3b82f6' }}>
      <CVisionCardBody style={{ paddingTop: 16, paddingBottom: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>{typeIcon[ann.type] || '📋'}</span>
            <CVisionBadge C={C} className={priorityColor[ann.priority]} variant="secondary">{ann.type}</CVisionBadge>
            {ann.pinned && <Pin size={14} style={{ color: C.orange }}/>}
            <h4 style={{ fontWeight: 600 }}>{ann.title}</h4>
          </div>
          <span style={{ fontSize: 12, color: C.textMuted, whiteSpace: 'nowrap' }}>{relTime(ann.publishedAt || ann.createdAt)}</span>
        </div>

        <p style={{ fontSize: 13, color: C.textMuted, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{ann.content}</p>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: C.textMuted, paddingTop: 4 }}>
          <span>By {ann.publishedByName || 'Admin'} · <Eye size={11} className="inline"/> {ann.readCount}/{ann.totalAudience} read</span>
          <div style={{ display: 'flex', gap: 8 }}>
            {ann.requiresAcknowledgment && (
              <CVisionButton C={C} isDark={isDark} size="sm" variant="outline" style={{ height: 28, fontSize: 12 }} onClick={() => onAck(ann.announcementId || ann.id)}>
                <CheckCircle2 size={12} style={{ marginRight: 4 }}/> Acknowledge
              </CVisionButton>
            )}
            <CVisionButton C={C} isDark={isDark} size="sm" variant="ghost" style={{ height: 28, fontSize: 12 }} onClick={() => onOpen(ann.announcementId || ann.id)}>
              View Full <ChevronRight size={12}/>
            </CVisionButton>
            {ann.allowComments && (
              <span style={{ display: 'flex', alignItems: 'center' }}><MessageCircle size={12}/> {(ann.comments||[]).length}</span>
            )}
          </div>
        </div>
      </CVisionCardBody>
    </CVisionCard>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 2 — Messages
// ═══════════════════════════════════════════════════════════════════════════

function MessagesTab() {
  const { C, isDark } = useCVisionTheme();
  const [view, setView] = useState<'inbox' | 'sent'>('inbox');
  const [thread, setThread] = useState<any[] | null>(null);
  const [selectedMsg, setSelectedMsg] = useState<any>(null);
  const [replyText, setReplyText] = useState('');
  const [search, setSearch] = useState('');

  const inboxQuery = useQuery({
    queryKey: cvisionKeys.communications.list({ action: 'inbox' }),
    queryFn: () => fetchComms('inbox'),
  });
  const sentQuery = useQuery({
    queryKey: cvisionKeys.communications.list({ action: 'sent' }),
    queryFn: () => fetchComms('sent'),
  });
  const inbox = inboxQuery.data?.data?.items || inboxQuery.data?.data || [];
  const sent = sentQuery.data?.data?.items || sentQuery.data?.data || [];
  const loading = inboxQuery.isLoading || sentQuery.isLoading;
  const load = useCallback(() => { inboxQuery.refetch(); sentQuery.refetch(); }, [inboxQuery, sentQuery]);

  async function openThread(msg: any) {
    setSelectedMsg(msg);
    if (msg.status !== 'READ') {
      await postComms({ action: 'mark-read', messageId: msg.messageId || msg.id });
    }
    const res = await fetchComms('thread', { threadId: msg.threadId });
    setThread(res.data || [msg]);
    load();
  }

  async function sendReply() {
    if (!replyText.trim() || !selectedMsg) return;
    await postComms({
      action: 'reply',
      threadId: selectedMsg.threadId,
      parentMessageId: selectedMsg.messageId || selectedMsg.id,
      recipientId: selectedMsg.senderId,
      recipientName: selectedMsg.senderName,
      content: replyText,
    });
    setReplyText('');
    const res = await fetchComms('thread', { threadId: selectedMsg.threadId });
    setThread(res.data?.items || res.data || []);
  }

  if (loading) return <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>{[1,2,3,4].map(i => <CVisionSkeletonCard C={C} height={200} key={i} style={{ height: 56, width: '100%' }} />)}</div>;

  const messages = view === 'inbox' ? inbox : sent;
  const filtered = search
    ? messages.filter((m: any) => {
        const hay = `${m.senderName} ${m.recipientName} ${m.subject || ''} ${m.content}`.toLowerCase();
        return hay.includes(search.toLowerCase());
      })
    : messages;

  return (
    <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Controls */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <CVisionButton C={C} isDark={isDark} size="sm" variant={view === 'inbox' ? 'default' : 'outline'} onClick={() => setView('inbox')}>
            Inbox ({inbox.filter(m => m.status !== 'READ').length} unread)
          </CVisionButton>
          <CVisionButton C={C} isDark={isDark} size="sm" variant={view === 'sent' ? 'default' : 'outline'} onClick={() => setView('sent')}>Sent</CVisionButton>
        </div>
        <div style={{ position: 'relative', width: 256 }}>
          <Search size={14} style={{ position: 'absolute', color: C.textMuted }}/>
          <CVisionInput C={C} placeholder="Search messages…" style={{ paddingLeft: 28, height: 32, fontSize: 13 }} value={search} onChange={e => setSearch(e.target.value)}/>
        </div>
      </div>

      {filtered.length === 0 && (
        <CVisionCard C={C}><CVisionCardBody style={{ paddingTop: 40, paddingBottom: 40, textAlign: 'center', color: C.textMuted }}>
          {search ? 'No messages match your search.' : view === 'inbox' ? 'Your inbox is empty.' : 'No sent messages.'}
        </CVisionCardBody></CVisionCard>
      )}

      {/* Message list */}
      <div style={{ borderRadius: 8, border: `1px solid ${C.border}` }}>
        {filtered.map((m: any) => {
          const unread = m.status !== 'READ' && view === 'inbox';
          return (
            <button key={m.id} className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-muted/50 transition ${unread ? 'bg-blue-50/60' : ''}`}
              onClick={() => openThread(m)}>
              {unread && <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.blueDim }}/>}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                  <span className={`font-medium truncate ${unread ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {view === 'inbox' ? m.senderName : m.recipientName}
                  </span>
                  <span style={{ fontSize: 12, color: C.textMuted }}>{relTime(m.sentAt)}</span>
                </div>
                <p style={{ fontSize: 12, color: C.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.subject || m.content}</p>
              </div>
              <ChevronRight size={14} style={{ color: C.textMuted }}/>
            </button>
          );
        })}
      </div>

      {/* Thread dialog */}
      <CVisionDialog C={C} open={!!thread} onClose={() => { setThread(null); setSelectedMsg(null); }} title="Thread" isDark={isDark}>            
            <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>View the conversation thread and send replies.</p>          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {(thread || []).map((m: any) => (
              <div key={m.id} className={`rounded-lg p-3 text-sm ${m.senderId === selectedMsg?.recipientId ? 'bg-muted/50 ml-4' : 'bg-blue-50 mr-4'}`}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontWeight: 500, fontSize: 12 }}>{m.senderName}</span>
                  <span style={{ fontSize: 12, color: C.textMuted }}>{relTime(m.sentAt)}</span>
                </div>
                <p className="whitespace-pre-wrap">{m.content}</p>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, paddingTop: 8, borderTop: `1px solid ${C.border}` }}>
            <CVisionTextarea C={C} placeholder="Write a reply…" style={{ minHeight: '60px', fontSize: 13 }} value={replyText} onChange={e => setReplyText(e.target.value)}/>
          </div>
          <CVisionDialogFooter C={C}>
            <CVisionButton C={C} isDark={isDark} size="sm" onClick={sendReply} disabled={!replyText.trim()}>
              <Reply size={14} style={{ marginRight: 4 }}/> Send Reply
            </CVisionButton>
          </CVisionDialogFooter>
      </CVisionDialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 3 — Notifications
// ═══════════════════════════════════════════════════════════════════════════

function NotificationsTab() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;

  const notificationsQuery = useQuery({
    queryKey: cvisionKeys.notifications.list({ action: 'notifications' }),
    queryFn: () => fetchComms('notifications'),
  });
  const items = notificationsQuery.data?.data?.items || notificationsQuery.data?.data || [];
  const loading = notificationsQuery.isLoading;
  const load = useCallback(() => notificationsQuery.refetch(), [notificationsQuery]);

  async function markAllRead() {
    await postComms({ action: 'mark-all-read' });
    load();
  }

  async function dismiss(id: string) {
    await postComms({ action: 'dismiss-notification', notificationId: id });
    load();
  }

  async function markRead(id: string) {
    await postComms({ action: 'mark-read', notificationId: id });
    load();
  }

  if (loading) return <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>{[1,2,3,4,5].map(i => <CVisionSkeletonCard C={C} height={200} key={i} style={{ height: 56, width: '100%' }} />)}</div>;

  // Group by day
  const today = new Date(); today.setHours(0,0,0,0);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  const groups: { label: string; items: any[] }[] = [];
  const todayItems = items.filter(n => new Date(n.createdAt) >= today);
  const yesterdayItems = items.filter(n => { const d = new Date(n.createdAt); return d >= yesterday && d < today; });
  const earlier = items.filter(n => new Date(n.createdAt) < yesterday);
  if (todayItems.length) groups.push({ label: tr('اليوم', 'Today'), items: todayItems });
  if (yesterdayItems.length) groups.push({ label: tr('أمس', 'Yesterday'), items: yesterdayItems });
  if (earlier.length) groups.push({ label: tr('سابقاً', 'Earlier'), items: earlier });

  return (
    <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ fontSize: 13, color: C.textMuted }}>{items.filter(n => !n.isRead).length} unread</p>
        <CVisionButton C={C} isDark={isDark} size="sm" variant="outline" onClick={markAllRead} disabled={!items.some(n => !n.isRead)}>
          <CheckCircle2 size={14} style={{ marginRight: 4 }}/> Mark All as Read
        </CVisionButton>
      </div>

      {items.length === 0 && (
        <CVisionCard C={C}><CVisionCardBody style={{ paddingTop: 40, paddingBottom: 40, textAlign: 'center', color: C.textMuted }}>
          No notifications yet. You&apos;ll see them here when events occur.
        </CVisionCardBody></CVisionCard>
      )}

      {groups.map(g => (
        <div key={g.label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <h4 style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', marginBottom: 8 }}>{g.label}</h4>
          {g.items.map(n => {
            const Icon = notifIcon[n.type] || Info;
            const color = notifColor[n.type] || 'text-gray-500';
            return (
              <div key={n.id}
                className={`flex items-start gap-3 rounded-md px-3 py-2.5 text-sm transition ${n.isRead ? 'opacity-60' : 'bg-muted/40'}`}>
                <Icon size={16} className={`mt-0.5 shrink-0 ${color}`}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className={`${n.isRead ? '' : 'font-medium'}`}>{n.title}</p>
                  <p style={{ fontSize: 12, color: C.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.message}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 12, color: C.textMuted }}>{relTime(n.createdAt)}</span>
                  {n.actionUrl && (
                    <CVisionButton C={C} isDark={isDark} size="sm" variant="ghost" style={{ height: 24, fontSize: 12, paddingLeft: 8, paddingRight: 8 }} asChild>
                      <a href={n.actionUrl}>View <ChevronRight size={10}/></a>
                    </CVisionButton>
                  )}
                  {!n.isRead && (
                    <CVisionButton C={C} isDark={isDark} size="sm" variant="ghost" style={{ height: 24, width: 24, padding: 0 }} title="Mark read" onClick={() => markRead(n.notificationId || n.id)}>
                      <Eye size={12}/>
                    </CVisionButton>
                  )}
                  <CVisionButton C={C} isDark={isDark} size="sm" variant="ghost" style={{ height: 24, width: 24, padding: 0, color: C.textMuted }} title="Dismiss" onClick={() => dismiss(n.notificationId || n.id)}>
                    <Trash2 size={12}/>
                  </CVisionButton>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 4 — Compose
// ═══════════════════════════════════════════════════════════════════════════

function ComposeTab() {
  const { C, isDark } = useCVisionTheme();
  const [mode, setMode] = useState<'message' | 'announcement'>('message');

  // DM fields
  const [employees, setEmployees] = useState<any[]>([]);
  const [recipientId, setRecipientId] = useState('');
  const [subject, setSubject] = useState('');
  const [msgBody, setMsgBody] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  // Announcement fields
  const [annTitle, setAnnTitle] = useState('');
  const [annTitleAr, setAnnTitleAr] = useState('');
  const [annContent, setAnnContent] = useState('');
  const [annContentAr, setAnnContentAr] = useState('');
  const [annType, setAnnType] = useState<string>('GENERAL');
  const [annPriority, setAnnPriority] = useState<string>('NORMAL');
  const [annAudience, setAnnAudience] = useState<string>('ALL');
  const [annReqAck, setAnnReqAck] = useState(false);
  const [annComments, setAnnComments] = useState(true);
  const [annPinned, setAnnPinned] = useState(false);
  const [annPublishNow, setAnnPublishNow] = useState(true);
  const [annScheduledAt, setAnnScheduledAt] = useState('');

  const employeesQuery = useQuery({
    queryKey: cvisionKeys.employees.list({ statuses: 'ACTIVE,PROBATION', limit: '200' }),
    queryFn: () => cvisionFetch<any>('/api/cvision/employees', { params: { statuses: 'ACTIVE,PROBATION', limit: '200' } }),
  });
  useEffect(() => {
    if (employeesQuery.data) setEmployees(employeesQuery.data.data || employeesQuery.data.items || []);
  }, [employeesQuery.data]);

  async function handleSendMessage() {
    if (!recipientId || !msgBody.trim()) return;
    setSending(true);
    const emp = employees.find(e => (e.id || e._id) === recipientId);
    await postComms({
      action: 'send-message',
      recipientId,
      recipientName: emp ? `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.name || 'Employee' : 'Employee',
      subject,
      content: msgBody,
    });
    setSending(false);
    setSent(true);
    setSubject(''); setMsgBody(''); setRecipientId('');
    setTimeout(() => setSent(false), 3000);
  }

  async function handleCreateAnnouncement(publish: boolean) {
    if (!annTitle.trim() || !annContent.trim()) return;
    setSending(true);
    const ann = await postComms({
      action: 'create-announcement',
      title: annTitle,
      titleAr: annTitleAr || undefined,
      content: annContent,
      contentAr: annContentAr || undefined,
      type: annType,
      priority: annPriority,
      audience: annAudience,
      requiresAcknowledgment: annReqAck,
      allowComments: annComments,
      pinned: annPinned,
      ...((!annPublishNow && annScheduledAt) ? { scheduledAt: annScheduledAt } : {}),
    });

    if (publish && ann.data?.announcementId) {
      await postComms({ action: 'publish-announcement', announcementId: ann.data.announcementId });
    }

    setSending(false);
    setSent(true);
    setAnnTitle(''); setAnnTitleAr(''); setAnnContent(''); setAnnContentAr('');
    setTimeout(() => setSent(false), 3000);
  }

  return (
    <div style={{ marginTop: 16, maxWidth: 672 }}>
      {sent && (
        <div style={{ marginBottom: 16, background: C.greenDim, border: `1px solid ${C.border}`, color: C.green, borderRadius: 8, paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle2 size={16}/> {mode === 'message' ? 'Message sent successfully!' : 'Announcement created!'}
        </div>
      )}

      <CVisionCard C={C}>
        <CVisionCardHeader C={C}>
          <div style={{ fontSize: 16, fontWeight: 600, color: C.text, display: 'flex', alignItems: 'center', gap: 8 }}><PenLine size={16}/> Compose</div>
          <div style={{ fontSize: 12, color: C.textMuted }}>Send a direct message or create an announcement</div>
        </CVisionCardHeader>
        <CVisionCardBody style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Mode toggle */}
          <div style={{ display: 'flex', gap: 8 }}>
            <CVisionButton C={C} isDark={isDark} size="sm" variant={mode === 'message' ? 'default' : 'outline'} onClick={() => setMode('message')}>
              <MessageSquare size={14} style={{ marginRight: 4 }}/> Direct Message
            </CVisionButton>
            <CVisionButton C={C} isDark={isDark} size="sm" variant={mode === 'announcement' ? 'default' : 'outline'} onClick={() => setMode('announcement')}>
              <Megaphone size={14} style={{ marginRight: 4 }}/> Announcement
            </CVisionButton>
          </div>

          {/* ── Direct Message ── */}
          {mode === 'message' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <CVisionLabel C={C} style={{ fontSize: 12 }}>To</CVisionLabel>
                <CVisionSelect
                C={C}
                value={recipientId}
                onChange={setRecipientId}
                placeholder="Select employee…"
                options={employees.map(e => (
                      ({ value: e.id || e._id, label: `${e.firstName || ''} ${e.lastName || ''}`.trim() || e.name || e.employeeNo || 'Employee' })
                    ))}
              />
              </div>
              <div>
                <CVisionLabel C={C} style={{ fontSize: 12 }}>Subject (optional)</CVisionLabel>
                <CVisionInput C={C} value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject…"/>
              </div>
              <div>
                <CVisionLabel C={C} style={{ fontSize: 12 }}>Message</CVisionLabel>
                <CVisionTextarea C={C} value={msgBody} onChange={e => setMsgBody(e.target.value)} placeholder="Type your message…" style={{ minHeight: '100px' }}/>
              </div>
              <CVisionButton C={C} isDark={isDark} onClick={handleSendMessage} disabled={!recipientId || !msgBody.trim() || sending}>
                <Send size={14} style={{ marginRight: 4 }}/> {sending ? 'Sending…' : 'Send Message'}
              </CVisionButton>
            </div>
          )}

          {/* ── Announcement ── */}
          {mode === 'announcement' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 12 }}>
                <div>
                  <CVisionLabel C={C} style={{ fontSize: 12 }}>Title</CVisionLabel>
                  <CVisionInput C={C} value={annTitle} onChange={e => setAnnTitle(e.target.value)} placeholder="Announcement title"/>
                </div>
                <div>
                  <CVisionLabel C={C} style={{ fontSize: 12 }}>Title (Arabic - optional)</CVisionLabel>
                  <CVisionInput C={C} value={annTitleAr} onChange={e => setAnnTitleAr(e.target.value)} placeholder="Arabic title"/>
                </div>
              </div>
              <div>
                <CVisionLabel C={C} style={{ fontSize: 12 }}>Content</CVisionLabel>
                <CVisionTextarea C={C} value={annContent} onChange={e => setAnnContent(e.target.value)} placeholder="Announcement content…" style={{ minHeight: '120px' }}/>
              </div>
              <div>
                <CVisionLabel C={C} style={{ fontSize: 12 }}>Content (Arabic - optional)</CVisionLabel>
                <CVisionTextarea C={C} value={annContentAr} onChange={e => setAnnContentAr(e.target.value)} placeholder="Arabic content..." style={{ minHeight: '80px' }}/>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                <div>
                  <CVisionLabel C={C} style={{ fontSize: 12 }}>Type</CVisionLabel>
                  <CVisionSelect
                C={C}
                value={annType}
                onChange={setAnnType}
                options={['GENERAL','POLICY','EVENT','URGENT','HR_UPDATE','SYSTEM'].map(t => (
                        ({ value: t, label: `${typeIcon[t]} ${t.replace('_',' ')}` })
                      ))}
              />
                </div>
                <div>
                  <CVisionLabel C={C} style={{ fontSize: 12 }}>Priority</CVisionLabel>
                  <CVisionSelect
                C={C}
                value={annPriority}
                onChange={setAnnPriority}
                options={['LOW','NORMAL','HIGH','URGENT'].map(p => (
                        ({ value: p, label: p })
                      ))}
              />
                </div>
                <div>
                  <CVisionLabel C={C} style={{ fontSize: 12 }}>Audience</CVisionLabel>
                  <CVisionSelect
                C={C}
                value={annAudience}
                onChange={setAnnAudience}
                options={['ALL','DEPARTMENT','BRANCH','ROLE','SPECIFIC'].map(a => (
                        ({ value: a, label: a })
                      ))}
              />
                </div>
              </div>

              {/* Options */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 13 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input type="checkbox" checked={annReqAck} onChange={e => setAnnReqAck(e.target.checked)} style={{ borderRadius: 6 }}/>
                  Require Acknowledgment
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input type="checkbox" checked={annComments} onChange={e => setAnnComments(e.target.checked)} style={{ borderRadius: 6 }}/>
                  Allow Comments
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input type="checkbox" checked={annPinned} onChange={e => setAnnPinned(e.target.checked)} style={{ borderRadius: 6 }}/>
                  Pin to Top
                </label>
              </div>

              {/* Schedule */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 13 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input type="radio" name="publish-time" checked={annPublishNow} onChange={() => setAnnPublishNow(true)}/> Publish Now
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input type="radio" name="publish-time" checked={!annPublishNow} onChange={() => setAnnPublishNow(false)}/> Schedule
                </label>
                {!annPublishNow && (
                  <CVisionInput C={C} type="datetime-local" value={annScheduledAt} onChange={e => setAnnScheduledAt(e.target.value)} style={{ width: 208, height: 32, fontSize: 13 }}/>
                )}
              </div>

              <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
                <CVisionButton C={C} isDark={isDark} onClick={() => handleCreateAnnouncement(true)} disabled={!annTitle.trim() || !annContent.trim() || sending}>
                  <Megaphone size={14} style={{ marginRight: 4 }}/> {sending ? 'Publishing…' : 'Publish'}
                </CVisionButton>
                <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => handleCreateAnnouncement(false)} disabled={!annTitle.trim() || !annContent.trim() || sending}>
                  Save as Draft
                </CVisionButton>
              </div>
            </div>
          )}
        </CVisionCardBody>
      </CVisionCard>
    </div>
  );
}
