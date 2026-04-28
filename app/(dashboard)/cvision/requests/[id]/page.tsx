'use client';

import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionBadge, CVisionButton, CVisionCard, CVisionCardBody, CVisionCardHeader, CVisionTextarea , CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cvisionFetch, cvisionMutate, cvisionKeys } from '@/lib/cvision/hooks';

import { ArrowLeft, Clock, User, Send, AlertTriangle, CheckCircle, XCircle, MessageSquare } from 'lucide-react';

interface RequestEvent {
  id: string;
  eventType: string;
  actorUserId: string;
  actorRole?: string;
  payloadJson: Record<string, any>;
  createdAt: string;
}

interface Request {
  id: string;
  requestNumber: string;
  type: string;
  title: string;
  description: string;
  status: string;
  confidentiality: string;
  currentOwnerRole: string;
  requesterEmployeeId: string;
  departmentId: string;
  slaDueAt?: string;
  slaBreached?: boolean;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
  resolution?: string;
}

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-blue-100 text-blue-800',
  in_review: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  escalated: 'bg-orange-100 text-orange-800',
  closed: 'bg-gray-100 text-gray-800',
};

const TYPE_LABELS: Record<string, string> = {
  leave: 'Leave Request',
  complaint: 'Complaint',
  transfer: 'Transfer',
  training: 'Training',
  payroll_issue: 'Payroll Issue',
  other: 'Other',
};

const EVENT_ICONS: Record<string, any> = {
  created: Clock,
  comment: MessageSquare,
  status_change: CheckCircle,
  escalated: AlertTriangle,
  assigned: User,
  attachment_added: Clock,
};

export default function RequestDetailsPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const requestId = params?.id as string;

  const [comment, setComment] = useState('');

  const { data: reqData, isLoading: loading, error: fetchError, refetch } = useQuery({
    queryKey: cvisionKeys.requests.detail(requestId),
    queryFn: () => cvisionFetch<any>(`/api/cvision/requests/${requestId}`, { params: { includeEvents: true } }),
    enabled: !!requestId,
  });

  const request: Request | null = reqData?.request || null;
  const events: RequestEvent[] = reqData?.events || [];
  const error = fetchError ? (fetchError as Error).message : null;

  const commentMutation = useMutation({
    mutationFn: () => cvisionMutate(`/api/cvision/requests/${requestId}/comment`, 'POST', { content: comment, isInternal: false }),
    onSuccess: () => { setComment(''); refetch(); },
    onError: (err: any) => alert(err.message || tr('حدث خطأ', 'An error occurred')),
  });

  const escalateMutation = useMutation({
    mutationFn: (reason: string) => cvisionMutate(`/api/cvision/requests/${requestId}/escalate`, 'POST', { reason }),
    onSuccess: () => refetch(),
    onError: (err: any) => alert(err.message || tr('حدث خطأ', 'An error occurred')),
  });

  const closeMutation = useMutation({
    mutationFn: ({ resolution, status }: { resolution: string; status: string }) => cvisionMutate(`/api/cvision/requests/${requestId}/close`, 'POST', { resolution, status }),
    onSuccess: () => refetch(),
    onError: (err: any) => alert(err.message || tr('حدث خطأ', 'An error occurred')),
  });

  const submitting = commentMutation.isPending;

  function handleAddComment() {
    if (!comment.trim()) return;
    commentMutation.mutate();
  }

  function handleEscalate() {
    const reason = prompt(tr('أدخل سبب التصعيد:', 'Enter escalation reason:'));
    if (!reason) return;
    escalateMutation.mutate(reason);
  }

  function handleClose(status: 'approved' | 'rejected' | 'closed') {
    const resolution = prompt(tr('أدخل القرار:', 'Enter resolution:'));
    if (!resolution) return;
    closeMutation.mutate({ resolution, status });
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleString();
  }

  function getEventDescription(event: RequestEvent): string {
    const { eventType, payloadJson } = event;
    
    switch (eventType) {
      case 'created':
        return `Request created (${payloadJson.type})`;
      case 'comment':
        return payloadJson.content;
      case 'status_change':
        return `Status changed: ${payloadJson.previousStatus} → ${payloadJson.newStatus}`;
      case 'escalated':
        return `Escalated from ${payloadJson.previousOwnerRole} to ${payloadJson.newOwnerRole}. Reason: ${payloadJson.reason}`;
      case 'assigned':
        return `Assigned to ${payloadJson.assignedToRole}`;
      default:
        return eventType;
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <div className="animate-pulse">Loading request details...</div>
      </div>
    );
  }

  if (error || !request) {
    return (
      <div style={{ padding: 24 }}>
        <div style={{ color: C.red }}>Error: {error || 'Request not found'}</div>
        <CVisionButton C={C} isDark={isDark} onClick={() => router.back()} style={{ marginTop: 16 }}>
          <ArrowLeft style={{ width: 16, height: 16, marginRight: 8 }} />
          Back
        </CVisionButton>
      </div>
    );
  }

  const isClosed = request.status === 'closed' || request.status === 'approved' || request.status === 'rejected';

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <CVisionButton C={C} isDark={isDark} variant="ghost" onClick={() => router.back()}>
          <ArrowLeft style={{ width: 16, height: 16, marginRight: 8 }} />
          Back
        </CVisionButton>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>{request.requestNumber}</h1>
          <p className="text-gray-500">{request.title}</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 24 }}>
        {/* Main Content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Request Details */}
          <CVisionCard C={C}>
            <CVisionCardHeader C={C}>
              <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>Request Details</div>
            </CVisionCardHeader>
            <CVisionCardBody style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                <div>
                  <label style={{ fontSize: 13 }}>Type</label>
                  <p style={{ fontWeight: 500 }}>{TYPE_LABELS[request.type] || request.type}</p>
                </div>
                <div>
                  <label style={{ fontSize: 13 }}>Status</label>
                  <div>
                    <CVisionBadge C={C} className={STATUS_COLORS[request.status] || 'bg-gray-100'}>
                      {request.status.replace('_', ' ').toUpperCase()}
                    </CVisionBadge>
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 13 }}>Confidentiality</label>
                  <p style={{ fontWeight: 500 }}>{request.confidentiality}</p>
                </div>
                <div>
                  <label style={{ fontSize: 13 }}>Current Owner</label>
                  <p style={{ fontWeight: 500 }}>{request.currentOwnerRole}</p>
                </div>
                <div>
                  <label style={{ fontSize: 13 }}>Created</label>
                  <p style={{ fontWeight: 500 }}>{formatDate(request.createdAt)}</p>
                </div>
                {request.slaDueAt && (
                  <div>
                    <label style={{ fontSize: 13 }}>SLA Due</label>
                    <p className={`font-medium ${request.slaBreached ? 'text-red-600' : ''}`}>
                      {formatDate(request.slaDueAt)}
                      {request.slaBreached && ' (BREACHED)'}
                    </p>
                  </div>
                )}
              </div>
              
              <div>
                <label style={{ fontSize: 13 }}>Description</label>
                <p style={{ marginTop: 4 }}>{request.description}</p>
              </div>

              {request.resolution && (
                <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
                  <label style={{ fontSize: 13 }}>Resolution</label>
                  <p style={{ marginTop: 4 }}>{request.resolution}</p>
                </div>
              )}
            </CVisionCardBody>
          </CVisionCard>

          {/* Timeline */}
          <CVisionCard C={C}>
            <CVisionCardHeader C={C}>
              <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>Timeline</div>
            </CVisionCardHeader>
            <CVisionCardBody>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {events.length === 0 ? (
                  <p className="text-gray-500">No events yet</p>
                ) : (
                  events.map((event) => {
                    const Icon = EVENT_ICONS[event.eventType] || Clock;
                    return (
                      <div key={event.id} style={{ display: 'flex', gap: 16 }}>
                        <div style={{ flexShrink: 0 }}>
                          <div style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Icon style={{ width: 16, height: 16 }} />
                          </div>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 500 }}>{getEventDescription(event)}</p>
                          <p style={{ fontSize: 12 }}>
                            {formatDate(event.createdAt)}
                            {event.actorRole && ` • ${event.actorRole}`}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Add Comment */}
              {!isClosed && (
                <div style={{ marginTop: 24, borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
                  <CVisionTextarea C={C}
                    placeholder="Add a comment..."
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={3}
                  />
                  <CVisionButton C={C} isDark={isDark}
                    onClick={handleAddComment}
                    disabled={!comment.trim() || submitting}
                    style={{ marginTop: 8 }}
                  >
                    <Send style={{ width: 16, height: 16, marginRight: 8 }} />
                    {submitting ? 'Sending...' : 'Add Comment'}
                  </CVisionButton>
                </div>
              )}
            </CVisionCardBody>
          </CVisionCard>
        </div>

        {/* Sidebar Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <CVisionCard C={C}>
            <CVisionCardHeader C={C}>
              <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>Actions</div>
            </CVisionCardHeader>
            <CVisionCardBody style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {!isClosed && (
                <>
                  <CVisionButton C={C} isDark={isDark}
                    variant="outline"
                    style={{ width: '100%' }}
                    onClick={handleEscalate}
                  >
                    <AlertTriangle style={{ width: 16, height: 16, marginRight: 8 }} />
                    Escalate
                  </CVisionButton>
                  <CVisionButton C={C} isDark={isDark}
                    variant="outline"
                    style={{ width: '100%', color: C.green }}
                    onClick={() => handleClose('approved')}
                  >
                    <CheckCircle style={{ width: 16, height: 16, marginRight: 8 }} />
                    Approve & Close
                  </CVisionButton>
                  <CVisionButton C={C} isDark={isDark}
                    variant="outline"
                    style={{ width: '100%', color: C.red }}
                    onClick={() => handleClose('rejected')}
                  >
                    <XCircle style={{ width: 16, height: 16, marginRight: 8 }} />
                    Reject
                  </CVisionButton>
                  <CVisionButton C={C} isDark={isDark}
                    variant="outline"
                    style={{ width: '100%' }}
                    onClick={() => handleClose('closed')}
                  >
                    Close Request
                  </CVisionButton>
                </>
              )}
              {isClosed && (
                <p style={{ fontSize: 13 }}>
                  This request is {request.status}. No further actions available.
                </p>
              )}
            </CVisionCardBody>
          </CVisionCard>

          {/* SLA Warning */}
          {request.slaBreached && !isClosed && (
            <CVisionCard C={C} style={{ background: C.redDim }}>
              <CVisionCardBody style={{ paddingTop: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.red }}>
                  <AlertTriangle style={{ width: 20, height: 20 }} />
                  <span style={{ fontWeight: 500 }}>SLA Breached</span>
                </div>
                <p style={{ fontSize: 13, color: C.red, marginTop: 4 }}>
                  This request has exceeded its SLA deadline and requires immediate attention.
                </p>
              </CVisionCardBody>
            </CVisionCard>
          )}
        </div>
      </div>
    </div>
  );
}
