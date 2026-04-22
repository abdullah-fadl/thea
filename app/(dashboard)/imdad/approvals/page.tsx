'use client';

import { useState, useMemo, useCallback, useRef } from 'react';
import { useLang } from '@/hooks/use-lang';
import { useImdadBrain } from '@/hooks/imdad/use-imdad-brain';

// ─── Types ───────────────────────────────────────────────────────────────────

type FilterTab = 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED';
type Urgency = 'ROUTINE' | 'URGENT' | 'EMERGENCY';

interface ApprovalRow {
  id: string;
  code: string;
  itemName: string;
  itemNameAr: string;
  quantity: number;
  department: string;
  departmentAr: string;
  requester: string;
  requesterAr: string;
  urgency: Urgency;
  slaDeadline: string; // ISO
  createdAt: string;   // ISO
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function relativeTime(iso: string, lang: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return lang === 'ar' ? 'الآن' : 'just now';
  if (mins < 60) return lang === 'ar' ? `منذ ${mins} د` : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return lang === 'ar' ? `منذ ${hrs} س` : `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return lang === 'ar' ? `منذ ${days} ي` : `${days}d ago`;
}

function slaRemaining(deadline: string): { label: string; color: string; overdue: boolean } {
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return { label: 'OVERDUE', color: 'text-red-400', overdue: true };
  const hrs = diff / 3600000;
  const h = Math.floor(hrs);
  const m = Math.floor((hrs - h) * 60);
  const label = `${h}h ${m}m`;
  if (hrs < 4) return { label, color: 'text-red-400', overdue: false };
  if (hrs < 8) return { label, color: 'text-amber-400', overdue: false };
  return { label, color: 'text-emerald-400', overdue: false };
}

const URGENCY_STYLE: Record<Urgency, string> = {
  ROUTINE: 'bg-white/10 text-gray-300',
  URGENT: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
  EMERGENCY: 'bg-red-500/20 text-red-300 border border-red-500/40 animate-pulse',
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function ImdadApprovalsPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const brain = useImdadBrain();

  // ── Derive approval rows from brain requests + decisions ──
  const rows = useMemo<ApprovalRow[]>(() => {
    const out: ApprovalRow[] = [];
    const reqs = brain.requests ?? [];
    reqs.forEach((r: any) => {
      out.push({
        id: r.id || r.requestId || r.code,
        code: r.code || r.requestId || '—',
        itemName: r.itemName || r.title || 'Item',
        itemNameAr: r.itemNameAr || r.titleAr || 'عنصر',
        quantity: r.quantity ?? 1,
        department: r.department || r.departmentName || 'General',
        departmentAr: r.departmentAr || r.departmentNameAr || 'عام',
        requester: r.requesterName || r.submittedBy || 'Staff',
        requesterAr: r.requesterNameAr || r.submittedByAr || 'موظف',
        urgency: (['URGENT', 'EMERGENCY'].includes(r.urgency) ? r.urgency : 'ROUTINE') as Urgency,
        slaDeadline: r.slaDeadline || new Date(Date.now() + 12 * 3600000).toISOString(),
        createdAt: r.createdAt || new Date().toISOString(),
        status: r.status === 'APPROVED' ? 'APPROVED' : r.status === 'REJECTED' ? 'REJECTED' : 'PENDING',
      });
    });
    const decs = brain.decisions ?? [];
    decs.forEach((d: any) => {
      if (d.approvalChain || d.status === 'PENDING_REVIEW') {
        out.push({
          id: d.id || d.code,
          code: d.code || d.id || '—',
          itemName: d.title || 'Decision',
          itemNameAr: d.titleAr || 'قرار',
          quantity: 1,
          department: d.hospitalName || 'Operations',
          departmentAr: d.hospitalNameAr || 'العمليات',
          requester: d.initiatedBy || 'System',
          requesterAr: d.initiatedByAr || 'النظام',
          urgency: d.priority === 'CRITICAL' ? 'EMERGENCY' : d.priority === 'HIGH' ? 'URGENT' : 'ROUTINE',
          slaDeadline: d.slaDeadline || new Date(Date.now() + 8 * 3600000).toISOString(),
          createdAt: d.createdAt || new Date().toISOString(),
          status: d.status === 'COMPLETED' || d.status === 'AUTO_APPROVED' ? 'APPROVED' : d.status === 'REJECTED' ? 'REJECTED' : 'PENDING',
        });
      }
    });
    return out;
  }, [brain.requests, brain.decisions]);

  // ── Filter ──
  const [tab, setTab] = useState<FilterTab>('ALL');
  const counts = useMemo(() => ({
    ALL: rows.length,
    PENDING: rows.filter((r) => r.status === 'PENDING').length,
    APPROVED: rows.filter((r) => r.status === 'APPROVED').length,
    REJECTED: rows.filter((r) => r.status === 'REJECTED').length,
  }), [rows]);

  const filtered = useMemo(() => (tab === 'ALL' ? rows : rows.filter((r) => r.status === tab)), [rows, tab]);

  // ── Selection ──
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggleOne = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((r) => r.id)));
  };

  // ── Optimistic actions ──
  const [optimistic, setOptimistic] = useState<Record<string, 'APPROVED' | 'REJECTED'>>({});
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const doApprove = useCallback((id: string) => {
    setOptimistic((p) => ({ ...p, [id]: 'APPROVED' }));
    brain.approveRequestStep(id, 'APPROVER', '');
  }, [brain]);

  const doReject = useCallback((id: string, reason: string) => {
    setOptimistic((p) => ({ ...p, [id]: 'REJECTED' }));
    brain.rejectRequestStep(id, 'APPROVER', reason);
    setRejectId(null);
    setRejectReason('');
  }, [brain]);

  const batchApprove = () => {
    selected.forEach((id) => doApprove(id));
    setSelected(new Set());
  };
  const batchReject = () => {
    selected.forEach((id) => doReject(id, 'Batch rejected'));
    setSelected(new Set());
  };

  // ── Swipe handling ──
  const touchRef = useRef<{ id: string; x: number } | null>(null);
  const onTouchStart = (id: string, e: React.TouchEvent) => {
    touchRef.current = { id, x: e.touches[0].clientX };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchRef.current) return;
    const dx = e.changedTouches[0].clientX - touchRef.current.x;
    if (dx > 80) doApprove(touchRef.current.id);
    else if (dx < -80) setRejectId(touchRef.current.id);
    touchRef.current = null;
  };

  const effectiveStatus = (r: ApprovalRow) => optimistic[r.id] || r.status;

  // ── Tab config ──
  const TABS: { key: FilterTab; ar: string; en: string }[] = [
    { key: 'ALL', ar: 'الكل', en: 'All' },
    { key: 'PENDING', ar: 'معلقة', en: 'Pending' },
    { key: 'APPROVED', ar: 'موافق عليها', en: 'Approved' },
    { key: 'REJECTED', ar: 'مرفوضة', en: 'Rejected' },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#050a18] text-white p-3 md:p-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <h1 className="text-xl md:text-2xl font-bold tracking-tight">
          {tr('الموافقات', 'My Approvals')}
        </h1>
        {counts.PENDING > 0 && (
          <span className="flex items-center justify-center min-w-[24px] h-6 px-2 rounded-full bg-cyan-500/20 text-cyan-300 text-xs font-semibold">
            {counts.PENDING}
          </span>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1 scrollbar-none">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setSelected(new Set()); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              tab === t.key
                ? 'bg-white/10 text-white border border-white/20'
                : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
            }`}
          >
            {tr(t.ar, t.en)}
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === t.key ? 'bg-cyan-500/20 text-cyan-300' : 'bg-white/5 text-gray-500'}`}>
              {counts[t.key]}
            </span>
          </button>
        ))}
      </div>

      {/* Batch action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 mb-4 px-3 py-2 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={selected.size === filtered.length}
              onChange={toggleAll}
              className="accent-cyan-400 w-4 h-4"
            />
            <span className="text-xs text-gray-300">
              {tr(`${selected.size} محدد`, `${selected.size} selected`)}
            </span>
          </label>
          <div className="flex-1" />
          <button
            onClick={batchApprove}
            className="px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 text-xs font-semibold hover:bg-emerald-500/30 transition-colors"
          >
            {tr('موافقة الكل', 'Approve All')}
          </button>
          <button
            onClick={batchReject}
            className="px-3 py-1 rounded-lg bg-red-500/20 text-red-300 text-xs font-semibold hover:bg-red-500/30 transition-colors"
          >
            {tr('رفض الكل', 'Reject All')}
          </button>
        </div>
      )}

      {/* Empty states */}
      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-gray-500">
          {tab === 'PENDING' || tab === 'ALL' ? (
            <>
              <svg className="w-12 h-12 mb-3 text-emerald-500/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm font-medium">{tr('لا توجد موافقات معلقة', 'No pending approvals')}</p>
            </>
          ) : (
            <p className="text-sm font-medium">{tr('لا توجد موافقات سابقة', 'No previous approvals')}</p>
          )}
        </div>
      )}

      {/* Approval list */}
      <div className="space-y-2 max-h-[calc(100vh-220px)] overflow-y-auto scrollbar-none">
        {filtered.map((row) => {
          const es = effectiveStatus(row);
          const sla = slaRemaining(row.slaDeadline);
          const isRejecting = rejectId === row.id;

          return (
            <div
              key={row.id}
              onTouchStart={(e) => onTouchStart(row.id, e)}
              onTouchEnd={onTouchEnd}
              className={`relative rounded-xl border backdrop-blur-md p-3 md:p-4 transition-all ${
                es === 'APPROVED'
                  ? 'bg-emerald-500/5 border-emerald-500/20 opacity-60'
                  : es === 'REJECTED'
                    ? 'bg-red-500/5 border-red-500/20 opacity-60'
                    : 'bg-white/[0.03] border-white/10 hover:border-white/20'
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Checkbox */}
                {es === 'PENDING' && (
                  <input
                    type="checkbox"
                    checked={selected.has(row.id)}
                    onChange={() => toggleOne(row.id)}
                    className="accent-cyan-400 w-4 h-4 mt-1 shrink-0"
                  />
                )}

                <div className="flex-1 min-w-0">
                  {/* Row 1: code + urgency + SLA */}
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-mono text-xs text-cyan-400">{row.code}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${URGENCY_STYLE[row.urgency]}`}>
                      {row.urgency}
                    </span>
                    {es === 'PENDING' && (
                      <span className={`text-[10px] font-mono ${sla.color}`}>
                        {sla.overdue ? tr('متأخر', 'OVERDUE') : sla.label}
                      </span>
                    )}
                    {es !== 'PENDING' && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                        es === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'
                      }`}>
                        {es === 'APPROVED' ? tr('تمت الموافقة', 'Approved') : tr('مرفوض', 'Rejected')}
                      </span>
                    )}
                  </div>

                  {/* Row 2: item + qty */}
                  <p className="text-sm font-medium text-white truncate">
                    {tr(row.itemNameAr, row.itemName)}
                    <span className="text-gray-500 text-xs ms-1">x{row.quantity}</span>
                  </p>

                  {/* Row 3: department + requester + time */}
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-500 flex-wrap">
                    <span>{tr(row.departmentAr, row.department)}</span>
                    <span className="text-gray-700">|</span>
                    <span>{tr(row.requesterAr, row.requester)}</span>
                    <span className="text-gray-700">|</span>
                    <span>{relativeTime(row.createdAt, language)}</span>
                  </div>
                </div>

                {/* Action buttons */}
                {es === 'PENDING' && !isRejecting && (
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      onClick={() => doApprove(row.id)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 text-xs font-semibold hover:bg-emerald-500/30 active:scale-95 transition-all"
                    >
                      {tr('موافقة', 'Approve')}
                    </button>
                    <button
                      onClick={() => setRejectId(row.id)}
                      className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-300 text-xs font-semibold hover:bg-red-500/30 active:scale-95 transition-all"
                    >
                      {tr('رفض', 'Reject')}
                    </button>
                  </div>
                )}
              </div>

              {/* Inline reject reason */}
              {isRejecting && (
                <div className="mt-2 flex gap-2">
                  <input
                    autoFocus
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder={tr('سبب الرفض...', 'Rejection reason...')}
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-gray-600 outline-none focus:border-red-500/40"
                  />
                  <button
                    onClick={() => doReject(row.id, rejectReason)}
                    className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-300 text-xs font-semibold hover:bg-red-500/30 transition-colors"
                  >
                    {tr('تأكيد', 'Confirm')}
                  </button>
                  <button
                    onClick={() => { setRejectId(null); setRejectReason(''); }}
                    className="px-2 py-1.5 rounded-lg bg-white/5 text-gray-400 text-xs hover:bg-white/10 transition-colors"
                  >
                    {tr('إلغاء', 'Cancel')}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
