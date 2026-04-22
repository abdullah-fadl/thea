'use client';

import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionBadge, CVisionButton, CVisionDialog, CVisionDialogFooter, CVisionSkeleton, CVisionSkeletonCard, CVisionSkeletonStyles, CVisionTextarea } from '@/components/cvision/ui';

import { useState, useEffect, useCallback } from 'react';

import { useToast } from '@/hooks/use-toast';
import {
  Clock,
  Eye,
  CheckCircle,
  XCircle,
  ArrowUpRight,
  AlertTriangle,
  User,
  Calendar,
  Timer,
  MessageSquare,
  Send,
  Loader2,
  FileText,
  Shield,
  Building2,
} from 'lucide-react';
import {
  REQUEST_TYPE_LABELS,
  REQUEST_STATUS_LABELS,
  REQUEST_PRIORITY_LABELS,
  REQUEST_CONFIDENTIALITY_LABELS,
  REQUEST_OWNER_ROLE_LABELS,
} from '@/lib/cvision/constants';

interface RequestDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestId: string | null;
  onStatusChange: () => void;
}

interface RequestDetail {
  id: string;
  requestNumber: string;
  type: string;
  priority?: string;
  title: string;
  description: string;
  status: string;
  confidentiality: string;
  requesterEmployeeId: string;
  departmentId: string;
  currentOwnerRole: string;
  assignedToUserId?: string;
  slaDueAt?: string;
  slaBreached?: boolean;
  resolution?: string;
  closedAt?: string;
  closedBy?: string;
  escalatedAt?: string;
  escalationReason?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

interface RequestEvent {
  id: string;
  eventType: string;
  actorUserId: string;
  actorRole?: string;
  payloadJson: any;
  createdAt: string;
}

const STATUS_BADGE: Record<string, string> = {
  open: 'bg-blue-100 text-blue-800',
  in_review: 'bg-indigo-100 text-indigo-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  escalated: 'bg-orange-100 text-orange-800',
  closed: 'bg-gray-100 text-gray-800',
};

const PRIORITY_BADGE: Record<string, string> = {
  urgent: 'bg-red-100 text-red-800',
  high: 'bg-orange-100 text-orange-800',
  medium: 'bg-yellow-100 text-yellow-800',
  low: 'bg-green-100 text-green-800',
};

function getEventIcon(eventType: string, C: any) {
  switch (eventType) {
    case 'created':
      return <FileText style={{ height: 16, width: 16, color: C.blue }} />;
    case 'comment':
      return <MessageSquare style={{ height: 16, width: 16 }} />;
    case 'status_change':
      return <Eye style={{ height: 16, width: 16 }} />;
    case 'escalated':
      return <ArrowUpRight style={{ height: 16, width: 16, color: C.orange }} />;
    case 'assigned':
      return <User style={{ height: 16, width: 16, color: C.purple }} />;
    default:
      return <Clock style={{ height: 16, width: 16 }} />;
  }
}

function getEventDescription(event: RequestEvent): string {
  const payload = event.payloadJson || {};
  switch (event.eventType) {
    case 'created':
      return `Request created — ${payload.type ? REQUEST_TYPE_LABELS[payload.type] || payload.type : ''}`;
    case 'comment':
      return payload.content || 'Comment added';
    case 'status_change':
      return `Status changed from ${REQUEST_STATUS_LABELS[payload.from] || payload.from || '?'} to ${REQUEST_STATUS_LABELS[payload.to] || payload.to || '?'}${payload.reason ? ` — ${payload.reason}` : ''}`;
    case 'escalated':
      return `Escalated${payload.from ? ` from ${payload.from}` : ''}${payload.to ? ` to ${payload.to}` : ''}${payload.reason ? ` — ${payload.reason}` : ''}`;
    case 'assigned':
      return `Assigned to ${payload.assignToRole || 'user'}${payload.notes ? ` — ${payload.notes}` : ''}`;
    default:
      return event.eventType;
  }
}

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function RequestDetailDialog({
  open,
  onOpenChange,
  requestId,
  onStatusChange,
}: RequestDetailDialogProps) {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const [request, setRequest] = useState<RequestDetail | null>(null);
  const [events, setEvents] = useState<RequestEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [comment, setComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [actionLoading, setActionLoading] = useState('');
  const { toast } = useToast();

  const fetchRequestDetail = useCallback(async (signal?: AbortSignal) => {
    if (!requestId) return;
    setLoading(true);
    try {
      // Fetch request detail
      const res = await fetch(`/api/cvision/requests/${requestId}`, {
        credentials: 'include',
        signal,
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to load request');
      }

      setRequest(data.request || data);

      // Fetch events - the detail endpoint may include them
      if (data.events) {
        setEvents(data.events);
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load request details',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [requestId, toast]);

  useEffect(() => {
    if (open && requestId) {
      const ac = new AbortController();
      fetchRequestDetail(ac.signal);
      setComment('');
      return () => ac.abort();
    }
  }, [open, requestId, fetchRequestDetail]);

  async function handleComment() {
    if (!comment.trim() || !requestId) return;
    setSubmittingComment(true);
    try {
      const res = await fetch(`/api/cvision/requests/${requestId}/comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content: comment.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to add comment');
      }

      setComment('');
      toast({ title: 'Comment Added' });
      fetchRequestDetail();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSubmittingComment(false);
    }
  }

  async function handleAction(action: string, body: Record<string, any> = {}) {
    if (!requestId) return;
    setActionLoading(action);
    try {
      let endpoint = '';
      let payload = body;

      switch (action) {
        case 'approve':
          endpoint = `/api/cvision/requests/${requestId}/close`;
          payload = { status: 'approved', resolution: 'Approved by admin' };
          break;
        case 'reject':
          endpoint = `/api/cvision/requests/${requestId}/close`;
          payload = { status: 'rejected', resolution: 'Rejected by admin' };
          break;
        case 'close':
          endpoint = `/api/cvision/requests/${requestId}/close`;
          payload = { status: 'closed', resolution: body.resolution || 'Closed' };
          break;
        case 'escalate':
          endpoint = `/api/cvision/requests/${requestId}/escalate`;
          payload = { reason: body.reason || 'Escalated for further review' };
          break;
        default:
          return;
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Failed to ${action} request`);
      }

      toast({ title: `Request ${action === 'approve' ? 'Approved' : action === 'reject' ? 'Rejected' : action === 'escalate' ? 'Escalated' : 'Closed'}` });
      fetchRequestDetail();
      onStatusChange();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setActionLoading('');
    }
  }

  const isTerminal = request?.status === 'closed' || request?.status === 'approved' || request?.status === 'rejected';
  const priority = request?.priority || 'medium';

  return (
    <CVisionDialog C={C} open={open} onClose={() => onOpenChange(false)} title={request?.title || tr('تفاصيل الطلب', 'Request Details')} isDark={isDark}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 16, paddingBottom: 16 }}>
            <CVisionSkeleton C={C} height={32} />
            <CVisionSkeleton C={C} height={16} />
            <CVisionSkeletonCard C={C} height={200} style={{ height: 80, width: '100%' }}  />
            <CVisionSkeletonCard C={C} height={200} style={{ height: 160, width: '100%' }}  />
          </div>
        ) : request ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              <span style={{ fontFamily: 'monospace', fontSize: 13, color: C.textMuted }}>
                {request.requestNumber}
              </span>
              <CVisionBadge C={C} className={`text-xs ${STATUS_BADGE[request.status] || ''}`}>
                {REQUEST_STATUS_LABELS[request.status] || request.status}
              </CVisionBadge>
              <CVisionBadge C={C} className={`text-xs ${PRIORITY_BADGE[priority] || ''}`}>
                {REQUEST_PRIORITY_LABELS[priority] || priority}
              </CVisionBadge>
              <CVisionBadge C={C} variant="outline" style={{ fontSize: 12 }}>
                {REQUEST_TYPE_LABELS[request.type] || request.type}
              </CVisionBadge>
            </div>
            <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>{tr('عرض تفاصيل الطلب والجدول الزمني واتخاذ إجراء.', 'View request details, timeline, and take action on this request.')}</p>

            {/* Info Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, fontSize: 13 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: C.textMuted }}>
                <Shield style={{ height: 14, width: 14 }} />
                <span>{REQUEST_CONFIDENTIALITY_LABELS[request.confidentiality] || request.confidentiality}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: C.textMuted }}>
                <User style={{ height: 14, width: 14 }} />
                <span>Owner: {REQUEST_OWNER_ROLE_LABELS[request.currentOwnerRole] || request.currentOwnerRole}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: C.textMuted }}>
                <Calendar style={{ height: 14, width: 14 }} />
                <span>{formatDateTime(request.createdAt)}</span>
              </div>
              {request.slaDueAt && (
                <div className={`flex items-center gap-1.5 ${request.slaBreached ? 'text-red-600' : 'text-muted-foreground'}`}>
                  <Timer style={{ height: 14, width: 14 }} />
                  <span>
                    {request.slaBreached ? 'SLA Breached' : `SLA Due: ${new Date(request.slaDueAt).toLocaleDateString()}`}
                  </span>
                </div>
              )}
            </div>

            <div style={{ height: 1, background: C.border, margin: "8px 0" }} />

            {/* Description */}
            <div>
              <h4 style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Description</h4>
              <p style={{ fontSize: 13, color: C.textMuted }}>
                {request.description}
              </p>
            </div>

            {/* Resolution (if closed/approved/rejected) */}
            {request.resolution && (
              <>
                <div style={{ height: 1, background: C.border, margin: "8px 0" }} />
                <div>
                  <h4 style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Resolution</h4>
                  <p style={{ fontSize: 13, color: C.textMuted }}>
                    {request.resolution}
                  </p>
                </div>
              </>
            )}

            <div style={{ height: 1, background: C.border, margin: "8px 0" }} />

            {/* Timeline */}
            <div>
              <h4 style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>Timeline</h4>
              {events.length === 0 ? (
                <p style={{ fontSize: 12, color: C.textMuted }}>No events recorded yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {events.map((event) => (
                    <div key={event.id} style={{ display: 'flex', gap: 12 }}>
                      <div style={{ marginTop: 2 }}>{getEventIcon(event.eventType, C)}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13 }}>{getEventDescription(event)}</p>
                        <p style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
                          {formatDateTime(event.createdAt)}
                          {event.actorRole ? ` by ${event.actorRole}` : ''}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Comment Input */}
            {!isTerminal && (
              <>
                <div style={{ height: 1, background: C.border, margin: "8px 0" }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <h4 style={{ fontSize: 13, fontWeight: 500 }}>Add Comment</h4>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <CVisionTextarea C={C}
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Write a comment..."
                      rows={2}
                      style={{ flex: 1 }}
                    />
                    <CVisionButton C={C} isDark={isDark}
                      size="sm"
                      onClick={handleComment}
                      disabled={!comment.trim() || submittingComment}
                      className="self-end"
                    >
                      {submittingComment ? (
                        <Loader2 style={{ height: 16, width: 16, animation: 'spin 1s linear infinite' }} />
                      ) : (
                        <Send style={{ height: 16, width: 16 }} />
                      )}
                    </CVisionButton>
                  </div>
                </div>
              </>
            )}

            {/* Action Buttons */}
            {!isTerminal && (
              <>
                <div style={{ height: 1, background: C.border, margin: "8px 0" }} />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  <CVisionButton C={C} isDark={isDark}
                    size="sm"
                    variant="default"
                    onClick={() => handleAction('approve')}
                    disabled={!!actionLoading}
                    style={{ background: C.greenDim }}
                  >
                    {actionLoading === 'approve' && <Loader2 style={{ marginRight: 4, height: 14, width: 14, animation: 'spin 1s linear infinite' }} />}
                    <CheckCircle style={{ marginRight: 4, height: 14, width: 14 }} />
                    Approve
                  </CVisionButton>
                  <CVisionButton C={C} isDark={isDark}
                    size="sm"
                    variant="danger"
                    onClick={() => handleAction('reject')}
                    disabled={!!actionLoading}
                  >
                    {actionLoading === 'reject' && <Loader2 style={{ marginRight: 4, height: 14, width: 14, animation: 'spin 1s linear infinite' }} />}
                    <XCircle style={{ marginRight: 4, height: 14, width: 14 }} />
                    Reject
                  </CVisionButton>
                  <CVisionButton C={C} isDark={isDark}
                    size="sm"
                    variant="outline"
                    onClick={() => handleAction('escalate')}
                    disabled={!!actionLoading}
                  >
                    {actionLoading === 'escalate' && <Loader2 style={{ marginRight: 4, height: 14, width: 14, animation: 'spin 1s linear infinite' }} />}
                    <ArrowUpRight style={{ marginRight: 4, height: 14, width: 14 }} />
                    Escalate
                  </CVisionButton>
                  <CVisionButton C={C} isDark={isDark}
                    size="sm"
                    variant="outline"
                    onClick={() => handleAction('close', { resolution: 'Closed by admin' })}
                    disabled={!!actionLoading}
                  >
                    {actionLoading === 'close' && <Loader2 style={{ marginRight: 4, height: 14, width: 14, animation: 'spin 1s linear infinite' }} />}
                    Close
                  </CVisionButton>
                </div>
              </>
            )}
          </>
        ) : (
          <div style={{ paddingTop: 32, paddingBottom: 32, textAlign: 'center', color: C.textMuted }}>
            {tr('الطلب غير موجود.', 'Request not found.')}
          </div>
        )}
    </CVisionDialog>
  );
}
