'use client';

import { useState, useMemo, useCallback } from 'react';
import { useLang } from '@/hooks/use-lang';
import { useImdadBrain } from '@/hooks/imdad/use-imdad-brain';

// ==================================================================
// Operations Inbox — Pending work items for the current user
// Sections: Pending Approvals, Delegated Tasks, Overdue Items
// ==================================================================

type Priority = 'ROUTINE' | 'URGENT' | 'EMERGENCY';

interface PendingItem {
  id: string;
  code: string;
  title: string;
  titleAr: string;
  type: string;
  priority: Priority;
  requestedBy: string;
  department: string;
  amount?: number;
  createdAt: string;
  slaDeadline?: string;
  isOverdue: boolean;
  hoursWaiting: number;
  approvalRole?: string;
}

interface DelegationItem {
  id: string;
  delegatedBy: string;
  scope: string;
  validUntil: string;
  actionCount: number;
}

interface OverdueItem {
  id: string;
  code: string;
  title: string;
  titleAr: string;
  daysOverdue: number;
  escalatedTo: string;
  originalRequester: string;
}

// ---- Helpers ----

function relativeTime(dateStr: string, lang: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return lang === 'ar' ? `${mins}د` : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return lang === 'ar' ? `${hrs}س` : `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return lang === 'ar' ? `${days}ي` : `${days}d ago`;
}

function priorityColor(p: Priority): string {
  if (p === 'EMERGENCY') return 'bg-red-500/20 text-red-400 border-red-500/30';
  if (p === 'URGENT') return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
  return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
}

function typeBadgeColor(type: string): string {
  if (type === 'SUPPLY' || type === 'SUPPLY_REORDER') return 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30';
  if (type === 'MAINTENANCE' || type === 'DEVICE_REPLACEMENT') return 'bg-orange-500/15 text-orange-400 border-orange-500/30';
  if (type === 'TRANSFER' || type === 'STOCK_REALLOCATION') return 'bg-violet-500/15 text-violet-400 border-violet-500/30';
  return 'bg-slate-500/15 text-slate-400 border-slate-500/30';
}

function typeLabel(type: string, tr: (ar: string, en: string) => string): string {
  if (type === 'SUPPLY' || type === 'SUPPLY_REORDER') return tr('إمداد', 'Supply');
  if (type === 'MAINTENANCE' || type === 'DEVICE_REPLACEMENT') return tr('صيانة', 'Maintenance');
  if (type === 'TRANSFER' || type === 'STOCK_REALLOCATION') return tr('نقل', 'Transfer');
  if (type === 'EMERGENCY_PROCUREMENT') return tr('مشتريات طوارئ', 'Emergency Procurement');
  return tr('أخرى', 'Other');
}

// ---- Current user role (simulated — would come from auth context) ----
const CURRENT_ROLE = 'HEAD_OF_DEPARTMENT';
const CURRENT_USER = '';

export default function OperationsInboxPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const brain = useImdadBrain();

  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [expandedSections, setExpandedSections] = useState({
    pending: true,
    delegated: true,
    overdue: true,
  });

  const toggleSection = (key: 'pending' | 'delegated' | 'overdue') => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // ---- Build pending approvals ----
  const pendingItems = useMemo<PendingItem[]>(() => {
    const items: PendingItem[] = [];

    // From decisions
    brain.decisions.forEach((d: any) => {
      if (d.status === 'PENDING_REVIEW' || d.status === 'PENDING') {
        const createdAt = d.createdAt || d.timestamp || new Date().toISOString();
        const hoursWaiting = Math.max(0, (Date.now() - new Date(createdAt).getTime()) / 3600000);
        const slaDeadline = d.slaDeadline || d.sla?.deadline;
        const isOverdue = slaDeadline ? new Date(slaDeadline).getTime() < Date.now() : hoursWaiting > 48;

        items.push({
          id: d.id || d.code,
          code: d.code || d.id || '-',
          title: d.title || d.description || '',
          titleAr: d.titleAr || d.descriptionAr || d.title || '',
          type: d.type || 'OTHER',
          priority: d.priority || 'ROUTINE',
          requestedBy: d.requestedBy || d.submittedBy || d.createdByName || '-',
          department: d.department || d.departmentName || '-',
          amount: d.financialImpact?.estimatedCost || d.amount,
          createdAt,
          slaDeadline,
          isOverdue,
          hoursWaiting,
          approvalRole: d.approvalAuthority || CURRENT_ROLE,
        });
      }
    });

    // From requests with matching approval step
    brain.requests.forEach((r: any) => {
      const chain = r.approvalChain || r.approvalSteps || [];
      const pendingStep = chain.find(
        (step: any) => step.status === 'PENDING' && step.role === CURRENT_ROLE,
      );
      if (!pendingStep && r.status !== 'PENDING_REVIEW') return;
      // Avoid duplicates
      if (items.some((i) => i.id === (r.id || r.requestId))) return;

      const createdAt = r.createdAt || r.requestedAt || new Date().toISOString();
      const hoursWaiting = Math.max(0, (Date.now() - new Date(createdAt).getTime()) / 3600000);
      const slaDeadline = r.slaDeadline || r.sla?.deadline;
      const isOverdue = slaDeadline ? new Date(slaDeadline).getTime() < Date.now() : hoursWaiting > 48;

      items.push({
        id: r.id || r.requestId,
        code: r.code || r.requestId || '-',
        title: r.title || r.description || '',
        titleAr: r.titleAr || r.descriptionAr || r.title || '',
        type: r.type || r.category || 'OTHER',
        priority: r.priority || 'ROUTINE',
        requestedBy: r.requestedBy || r.requestedByName || '-',
        department: r.department || r.departmentName || '-',
        amount: r.estimatedCost || r.amount,
        createdAt,
        slaDeadline,
        isOverdue,
        hoursWaiting,
        approvalRole: CURRENT_ROLE,
      });
    });

    // Sort: overdue first, then by priority, then by time waiting
    const priorityOrder: Record<string, number> = { EMERGENCY: 0, URGENT: 1, ROUTINE: 2 };
    items.sort((a, b) => {
      if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
      const pa = priorityOrder[a.priority] ?? 2;
      const pb = priorityOrder[b.priority] ?? 2;
      if (pa !== pb) return pa - pb;
      return b.hoursWaiting - a.hoursWaiting;
    });

    return items;
  }, [brain.decisions, brain.requests]);

  // ---- Delegated tasks ----
  const delegatedItems = useMemo<DelegationItem[]>(() => {
    // Extract delegations from requests where current user is a delegate
    const delegations: DelegationItem[] = [];
    brain.requests.forEach((r: any) => {
      const chain = r.approvalChain || r.approvalSteps || [];
      chain.forEach((step: any) => {
        if (step.delegatedTo === CURRENT_USER || step.delegatedToRole === CURRENT_ROLE) {
          delegations.push({
            id: `${r.id || r.requestId}-${step.role}`,
            delegatedBy: step.delegatedBy || step.role || '-',
            scope: step.scope || r.department || tr('عام', 'General'),
            validUntil: step.delegationExpiry || step.validUntil || '-',
            actionCount: 1,
          });
        }
      });
    });
    return delegations;
  }, [brain.requests, tr]);

  // ---- Overdue items ----
  const overdueItems = useMemo<OverdueItem[]>(() => {
    const items: OverdueItem[] = [];

    const addIfOverdue = (item: any, code: string) => {
      const createdAt = item.createdAt || item.requestedAt || item.timestamp;
      if (!createdAt) return;
      const hoursWaiting = (Date.now() - new Date(createdAt).getTime()) / 3600000;
      const slaDeadline = item.slaDeadline || item.sla?.deadline;
      const isOverdue = slaDeadline
        ? new Date(slaDeadline).getTime() < Date.now()
        : hoursWaiting > 24;

      if (!isOverdue) return;
      const daysOverdue = slaDeadline
        ? Math.max(0, Math.ceil((Date.now() - new Date(slaDeadline).getTime()) / 86400000))
        : Math.max(0, Math.ceil(hoursWaiting / 24) - 1);

      if (daysOverdue <= 0) return;

      items.push({
        id: item.id || item.requestId || code,
        code,
        title: item.title || item.description || '',
        titleAr: item.titleAr || item.descriptionAr || item.title || '',
        daysOverdue,
        escalatedTo: item.escalatedTo || item.approvalAuthority || '-',
        originalRequester: item.requestedBy || item.requestedByName || item.createdByName || '-',
      });
    };

    brain.requests.forEach((r: any) => addIfOverdue(r, r.code || r.requestId || '-'));
    brain.decisions.forEach((d: any) => {
      if (d.status === 'COMPLETED' || d.status === 'REJECTED') return;
      addIfOverdue(d, d.code || d.id || '-');
    });

    // Deduplicate
    const seen = new Set<string>();
    const unique = items.filter((i) => {
      if (seen.has(i.id)) return false;
      seen.add(i.id);
      return true;
    });

    unique.sort((a, b) => b.daysOverdue - a.daysOverdue);
    return unique;
  }, [brain.requests, brain.decisions]);

  const totalPending = pendingItems.length + overdueItems.length;

  // ---- Actions ----
  const handleApprove = useCallback(
    (item: PendingItem) => {
      const result = (brain.approveRequestStep as any)(item.id, item.approvalRole || CURRENT_ROLE, '');
      if (result && !(result as any).success) {
        (console as any).error('Approve failed:', result.error);
      }
    },
    [brain],
  );

  const handleReject = useCallback(
    (item: PendingItem) => {
      if (rejectingId === item.id && rejectReason.trim()) {
        brain.rejectRequestStep(item.id, item.approvalRole || CURRENT_ROLE, rejectReason);
        setRejectingId(null);
        setRejectReason('');
      } else {
        setRejectingId(item.id);
        setRejectReason('');
      }
    },
    [brain, rejectingId, rejectReason],
  );

  // ---- Section Header ----
  const SectionHeader = ({
    label,
    count,
    sectionKey,
    countColor = 'bg-white/10 text-white/70',
  }: {
    label: string;
    count: number;
    sectionKey: 'pending' | 'delegated' | 'overdue';
    countColor?: string;
  }) => (
    <button
      onClick={() => toggleSection(sectionKey)}
      className="w-full flex items-center justify-between px-4 py-3 rounded-lg bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] transition-colors"
    >
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold text-white/90">{label}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${countColor}`}>
          {count}
        </span>
      </div>
      <svg
        className={`w-4 h-4 text-white/40 transition-transform ${expandedSections[sectionKey] ? 'rotate-180' : ''}`}
        fill="none" viewBox="0 0 24 24" stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  );

  return (
    <div className="min-h-screen bg-[#050a18] text-white/90 p-4 md:p-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold tracking-tight">
            {tr('صندوق العمليات', 'Operations Inbox')}
          </h1>
          {totalPending > 0 && (
            <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
              {totalPending}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-white/40">
          <span className="px-2 py-1 rounded bg-white/[0.05] border border-white/[0.08] font-mono">
            {CURRENT_ROLE.replace(/_/g, ' ')}
          </span>
          <span>{CURRENT_USER}</span>
        </div>
      </div>

      <div className="space-y-4">
        {/* ============================================ */}
        {/* SECTION 1: Pending Approvals */}
        {/* ============================================ */}
        <SectionHeader
          label={tr('موافقات معلقة', 'Pending Approvals')}
          count={pendingItems.length}
          sectionKey="pending"
          countColor={pendingItems.length > 0 ? 'bg-amber-500/20 text-amber-400' : 'bg-white/10 text-white/50'}
        />

        {expandedSections.pending && (
          <div className="space-y-2">
            {pendingItems.length === 0 ? (
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-8 text-center">
                <p className="text-sm text-white/40">
                  {tr('لا توجد موافقات معلقة — كل شيء محدّث', 'No pending approvals — all caught up')}
                </p>
              </div>
            ) : (
              pendingItems.map((item) => (
                <div
                  key={item.id}
                  className={`rounded-lg border bg-white/[0.02] p-4 transition-colors hover:bg-white/[0.04] ${
                    item.isOverdue ? 'border-red-500/30' : 'border-white/[0.06]'
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                    {/* Left: Info */}
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs text-white/50 bg-white/[0.05] px-1.5 py-0.5 rounded">
                          {item.code}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${typeBadgeColor(item.type)}`}>
                          {typeLabel(item.type, tr)}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${priorityColor(item.priority)}`}>
                          {item.priority === 'EMERGENCY'
                            ? tr('طوارئ', 'Emergency')
                            : item.priority === 'URGENT'
                              ? tr('عاجل', 'Urgent')
                              : tr('روتيني', 'Routine')}
                        </span>
                        {/* SLA indicator */}
                        <span className={`w-2 h-2 rounded-full ${item.isOverdue ? 'bg-red-500' : 'bg-emerald-500'}`} />
                      </div>

                      <p className="text-sm font-medium text-white/80 truncate">
                        {tr(item.titleAr, item.title)}
                      </p>

                      <div className="flex items-center gap-4 text-xs text-white/40 flex-wrap">
                        <span>{tr('طلب من', 'By')}: {item.requestedBy}</span>
                        <span>{tr('القسم', 'Dept')}: {item.department}</span>
                        {item.amount != null && item.amount > 0 && (
                          <span className="font-mono">
                            {item.amount.toLocaleString(language === 'ar' ? 'ar-SA' : 'en-SA')} {tr('ر.س', 'SAR')}
                          </span>
                        )}
                        <span>{relativeTime(item.createdAt, language)}</span>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      {rejectingId === item.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            className="h-8 w-40 rounded bg-white/[0.05] border border-white/[0.1] px-2 text-xs text-white/80 placeholder:text-white/30 focus:outline-none focus:border-white/20"
                            placeholder={tr('سبب الرفض...', 'Rejection reason...')}
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            autoFocus
                          />
                          <button
                            onClick={() => handleReject(item)}
                            disabled={!rejectReason.trim()}
                            className="h-8 px-3 rounded text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 disabled:opacity-40 transition-colors"
                          >
                            {tr('تأكيد', 'Confirm')}
                          </button>
                          <button
                            onClick={() => setRejectingId(null)}
                            className="h-8 px-2 rounded text-xs text-white/40 hover:text-white/60 transition-colors"
                          >
                            {tr('إلغاء', 'Cancel')}
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={() => handleApprove(item)}
                            className="h-8 px-4 rounded text-xs font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors"
                          >
                            {tr('موافقة', 'Approve')}
                          </button>
                          <button
                            onClick={() => handleReject(item)}
                            className="h-8 px-4 rounded text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors"
                          >
                            {tr('رفض', 'Reject')}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ============================================ */}
        {/* SECTION 2: Delegated Tasks */}
        {/* ============================================ */}
        <SectionHeader
          label={tr('مهام مفوضة', 'Delegated Tasks')}
          count={delegatedItems.length}
          sectionKey="delegated"
        />

        {expandedSections.delegated && (
          <div className="space-y-2">
            {delegatedItems.length === 0 ? (
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-8 text-center space-y-1">
                <p className="text-sm text-white/40">
                  {tr('لا توجد تفويضات نشطة', 'No active delegations')}
                </p>
                <p className="text-xs text-white/25">
                  {tr(
                    'عندما يفوض شخص ما صلاحياته إليك، ستظهر المهام هنا',
                    'When someone delegates their authority to you, tasks will appear here',
                  )}
                </p>
              </div>
            ) : (
              delegatedItems.map((d) => (
                <div
                  key={d.id}
                  className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 flex items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <p className="text-sm text-white/70">
                      {tr('مفوض من', 'Delegated by')}: <span className="text-white/90 font-medium">{d.delegatedBy}</span>
                    </p>
                    <div className="flex items-center gap-3 text-xs text-white/40">
                      <span>{tr('النطاق', 'Scope')}: {d.scope}</span>
                      <span>{tr('صالح حتى', 'Valid until')}: {d.validUntil !== '-' ? new Date(d.validUntil).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US') : '-'}</span>
                    </div>
                  </div>
                  <span className="text-xs font-mono px-2 py-1 rounded bg-white/[0.05] text-white/50">
                    {d.actionCount} {tr('إجراء', 'action(s)')}
                  </span>
                </div>
              ))
            )}
          </div>
        )}

        {/* ============================================ */}
        {/* SECTION 3: Overdue Items */}
        {/* ============================================ */}
        <SectionHeader
          label={tr('عناصر متأخرة', 'Overdue Items')}
          count={overdueItems.length}
          sectionKey="overdue"
          countColor={overdueItems.length > 0 ? 'bg-red-500/20 text-red-400' : 'bg-white/10 text-white/50'}
        />

        {expandedSections.overdue && (
          <div className="space-y-2">
            {overdueItems.length === 0 ? (
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-8 text-center">
                <p className="text-sm text-white/40">
                  {tr('لا توجد عناصر متأخرة — ممتاز', 'No overdue items — excellent')}
                </p>
              </div>
            ) : (
              overdueItems.map((item) => (
                <div
                  key={item.id}
                  className={`rounded-lg p-4 ${
                    item.daysOverdue > 2
                      ? 'border-2 border-red-500/40 bg-red-500/[0.03]'
                      : 'border border-amber-500/30 bg-amber-500/[0.02]'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-white/50 bg-white/[0.05] px-1.5 py-0.5 rounded">
                          {item.code}
                        </span>
                        <span className={`text-xs font-bold ${item.daysOverdue > 2 ? 'text-red-400' : 'text-amber-400'}`}>
                          {item.daysOverdue} {tr('يوم متأخر', 'day(s) overdue')}
                        </span>
                      </div>
                      <p className="text-sm text-white/70">{tr(item.titleAr, item.title)}</p>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-white/40">
                      <span>{tr('تصعيد إلى', 'Escalated to')}: {item.escalatedTo}</span>
                      <span>{tr('طلب من', 'Requested by')}: {item.originalRequester}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
