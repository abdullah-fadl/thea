'use client';

import { useState, useMemo } from 'react';
import { useLang } from '@/hooks/use-lang';
import { useImdadBrain } from '@/hooks/imdad/use-imdad-brain';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type ActiveFlow = 'USE_ITEM' | 'REQUEST_ITEM' | 'REPORT_ISSUE' | 'MOVE_ITEM' | null;
type IssueType = 'DAMAGED' | 'MISSING' | 'EXPIRED' | 'WRONG_ITEM' | null;
type MoveReason = 'TRANSFER' | 'BORROW' | 'RETURN' | null;
type RequestReason = 'PATIENT_CARE' | 'STOCK_REFILL' | 'EMERGENCY' | null;

// ---------------------------------------------------------------------------
// Icons (inline SVG)
// ---------------------------------------------------------------------------
const ScanIcon = () => (
  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.5h3V3h-3a1.5 1.5 0 00-1.5 1.5v3h1.5v-3zm16.5 0v3H21v-3a1.5 1.5 0 00-1.5-1.5h-3v1.5h3zM3.75 19.5v-3H2.25v3A1.5 1.5 0 003.75 21h3v-1.5h-3zm16.5 0h-3V21h3a1.5 1.5 0 001.5-1.5v-3h-1.5v3zM7.5 12h9M7.5 9h9M7.5 15h9" />
  </svg>
);
const PlusCircleIcon = () => (
  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
const AlertTriangleIcon = () => (
  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
  </svg>
);
const ArrowsIcon = () => (
  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
  </svg>
);
const CheckCircleIcon = () => (
  <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
const ChevronIcon = ({ open }: { open: boolean }) => (
  <svg className={`w-5 h-5 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
  </svg>
);
const XIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);
const BackIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
  </svg>
);
const SearchIcon = () => (
  <svg className="w-5 h-5 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
  </svg>
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function relativeTime(iso: string, tr: (ar: string, en: string) => string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return tr('الآن', 'Just now');
  if (mins < 60) return tr(`منذ ${mins} د`, `${mins}m ago`);
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return tr(`منذ ${hrs} س`, `${hrs}h ago`);
  const days = Math.floor(hrs / 24);
  return tr(`منذ ${days} ي`, `${days}d ago`);
}

const STATUS_COLORS: Record<string, string> = {
  PENDING_REVIEW: 'bg-amber-500/20 text-amber-300',
  APPROVED: 'bg-emerald-500/20 text-emerald-300',
  REJECTED: 'bg-red-500/20 text-red-300',
  COMPLETED: 'bg-cyan-500/20 text-cyan-300',
};

const ACTION_ICONS: Record<string, string> = {
  USE_ITEM: 'text-cyan-400',
  REQUEST_ITEM: 'text-emerald-400',
  REPORT_ISSUE: 'text-amber-400',
  MOVE_ITEM: 'text-purple-400',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function ImdadMyWork() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const brain = useImdadBrain();

  const [activeFlow, setActiveFlow] = useState<ActiveFlow>(null);
  const [flowStep, setFlowStep] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [quantity, setQuantity] = useState(1);
  const [issueType, setIssueType] = useState<IssueType>(null);
  const [moveReason, setMoveReason] = useState<MoveReason>(null);
  const [requestReason, setRequestReason] = useState<RequestReason>(null);
  const [notes, setNotes] = useState('');
  const [destination, setDestination] = useState('');
  const [patientMrn, setPatientMrn] = useState('');

  // Collapsible sections
  const [showApprovals, setShowApprovals] = useState(true);
  const [showDelegated, setShowDelegated] = useState(true);
  const [showOverdue, setShowOverdue] = useState(true);

  // Derived data
  const pendingDecisions = useMemo(
    () => brain.decisions.filter((d: any) => d.status === 'PENDING_REVIEW'),
    [brain.decisions],
  );
  const delegatedTasks = useMemo(
    () => brain.requests.filter((r: any) => r.delegateTo),
    [brain.requests],
  );
  const overdueItems = useMemo(
    () => brain.requests.filter((r: any) => r.slaDeadline && new Date(r.slaDeadline) < new Date()),
    [brain.requests],
  );
  const recentLogs = useMemo(() => brain.auditLog.slice(0, 10), [brain.auditLog]);
  const myRequests = useMemo(() => brain.requests.slice(0, 8), [brain.requests]);
  const hasTasks = pendingDecisions.length > 0 || delegatedTasks.length > 0 || overdueItems.length > 0;

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return brain.inventoryItems.filter(
      (i: any) =>
        (i.name || '').toLowerCase().includes(q) ||
        (i.nameAr || '').toLowerCase().includes(q) ||
        (i.sku || '').toLowerCase().includes(q),
    ).slice(0, 8);
  }, [searchQuery, brain.inventoryItems]);

  // Reset flow state
  function openFlow(flow: ActiveFlow) {
    setActiveFlow(flow);
    setFlowStep(0);
    setSearchQuery('');
    setSelectedItem(null);
    setQuantity(1);
    setIssueType(null);
    setMoveReason(null);
    setRequestReason(null);
    setNotes('');
    setDestination('');
    setPatientMrn('');
  }
  function closeFlow() { setActiveFlow(null); }
  function nextStep() { setFlowStep((s) => s + 1); }
  function prevStep() { setFlowStep((s) => Math.max(0, s - 1)); }

  function confirmFlow() {
    if (activeFlow === 'USE_ITEM' && selectedItem) {
      brain.createRequest({ type: 'USE', itemId: selectedItem.id, quantity, patientMrn } as any);
    } else if (activeFlow === 'REQUEST_ITEM' && selectedItem) {
      brain.createRequest({ type: 'REQUEST', itemId: selectedItem.id, quantity, reason: requestReason } as any);
    } else if (activeFlow === 'REPORT_ISSUE') {
      brain.createRequest({ type: 'REPORT', itemId: selectedItem?.id, issueType, notes } as any);
    } else if (activeFlow === 'MOVE_ITEM' && selectedItem) {
      brain.createRequest({ type: 'MOVE', itemId: selectedItem.id, destination, reason: moveReason } as any);
    }
    closeFlow();
  }

  // Flow total steps
  const totalSteps = activeFlow === 'USE_ITEM' ? 5 : activeFlow === 'REPORT_ISSUE' ? 4 : 4;

  // -----------------------------------------------------------------------
  // RENDER
  // -----------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-[#050a18] text-white pb-24" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="max-w-2xl mx-auto px-4 pt-6 space-y-6">

        {/* -- Header -- */}
        <h1 className="text-xl font-bold">{tr('عملي', 'My Work')}</h1>

        {/* ============================================================= */}
        {/* SECTION 1: QUICK ACTIONS                                       */}
        {/* ============================================================= */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {([
            { flow: 'USE_ITEM' as const, icon: <ScanIcon />, color: 'cyan', label: tr('استخدام صنف', 'Use Item'), sub: tr('مسح أو بحث', 'Scan or Search') },
            { flow: 'REQUEST_ITEM' as const, icon: <PlusCircleIcon />, color: 'emerald', label: tr('طلب صنف', 'Request Item'), sub: tr('طلب توريد', 'Request Supply') },
            { flow: 'REPORT_ISSUE' as const, icon: <AlertTriangleIcon />, color: 'amber', label: tr('إبلاغ عن مشكلة', 'Report Issue'), sub: tr('تالف أو مفقود', 'Damaged or Missing') },
            { flow: 'MOVE_ITEM' as const, icon: <ArrowsIcon />, color: 'purple', label: tr('نقل صنف', 'Move Item'), sub: tr('تحويل أو إعارة', 'Transfer or Borrow') },
          ]).map((a) => (
            <button
              key={a.flow}
              onClick={() => openFlow(a.flow)}
              className={`h-28 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md flex items-center gap-3 px-4 transition-all hover:border-${a.color}-500/50 hover:shadow-[0_0_24px_rgba(0,0,0,0.3)] hover:shadow-${a.color}-500/20 active:scale-[0.97]`}
            >
              <span className={`text-${a.color}-400 shrink-0`}>{a.icon}</span>
              <span className="text-start">
                <span className="block text-sm font-semibold">{a.label}</span>
                <span className="block text-xs text-white/50 mt-0.5">{a.sub}</span>
              </span>
            </button>
          ))}
        </div>

        {/* ============================================================= */}
        {/* SECTION 2: MY TASKS                                            */}
        {/* ============================================================= */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">{tr('مهامي', 'My Tasks')}</h2>

          {!hasTasks && (
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-6 flex items-center gap-3 justify-center">
              <CheckCircleIcon />
              <span className="text-white/60 text-sm">{tr('لا توجد مهام معلقة', 'No pending tasks')}</span>
            </div>
          )}

          {/* Pending Approvals */}
          {pendingDecisions.length > 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md overflow-hidden">
              <button onClick={() => setShowApprovals(!showApprovals)} className="w-full flex items-center justify-between px-4 py-3">
                <span className="flex items-center gap-2 text-sm font-medium">
                  {tr('موافقات معلقة', 'Pending Approvals')}
                  <span className="bg-amber-500/20 text-amber-300 text-xs px-2 py-0.5 rounded-full">{pendingDecisions.length}</span>
                </span>
                <ChevronIcon open={showApprovals} />
              </button>
              {showApprovals && (
                <div className="px-4 pb-3 space-y-2">
                  {pendingDecisions.map((d: any) => (
                    <div key={d.id} className="rounded-xl bg-white/5 p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium">{d.code || d.id?.slice(0, 8)}</p>
                          <p className="text-xs text-white/50">{tr(d.titleAr || d.title || '', d.title || '')}</p>
                          {d.department && <p className="text-xs text-white/40 mt-0.5">{d.department}</p>}
                        </div>
                        {d.urgency && (
                          <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${d.urgency === 'HIGH' ? 'bg-red-500/20 text-red-300' : d.urgency === 'MEDIUM' ? 'bg-amber-500/20 text-amber-300' : 'bg-white/10 text-white/60'}`}>
                            {d.urgency}
                          </span>
                        )}
                      </div>
                      {d.slaDeadline && (
                        <p className="text-xs text-white/40">{tr('الموعد النهائي', 'SLA')}: {new Date(d.slaDeadline).toLocaleTimeString(language === 'ar' ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' })}</p>
                      )}
                      <div className="flex gap-2">
                        <button onClick={() => brain.approveRequestStep(d.id, 'user')} className="flex-1 text-xs py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition-colors">
                          {tr('موافقة', 'Approve')}
                        </button>
                        <button onClick={() => brain.rejectRequestStep(d.id, 'user')} className="flex-1 text-xs py-1.5 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-colors">
                          {tr('رفض', 'Reject')}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Delegated Tasks */}
          {delegatedTasks.length > 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md overflow-hidden">
              <button onClick={() => setShowDelegated(!showDelegated)} className="w-full flex items-center justify-between px-4 py-3">
                <span className="text-sm font-medium">{tr('مهام مفوضة', 'Delegated Tasks')}</span>
                <ChevronIcon open={showDelegated} />
              </button>
              {showDelegated && (
                <div className="px-4 pb-3 space-y-2">
                  {delegatedTasks.map((t: any) => (
                    <div key={t.id} className="rounded-xl bg-white/5 p-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm">{t.code || t.id?.slice(0, 8)}</p>
                        <p className="text-xs text-white/50">{tr(t.titleAr || '', t.title || '')}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[t.status] || 'bg-white/10 text-white/60'}`}>
                        {t.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Overdue Items */}
          {overdueItems.length > 0 && (
            <div className="rounded-2xl border border-red-500/30 bg-white/5 backdrop-blur-md overflow-hidden">
              <button onClick={() => setShowOverdue(!showOverdue)} className="w-full flex items-center justify-between px-4 py-3">
                <span className="flex items-center gap-2 text-sm font-medium text-red-300">
                  {tr('متأخرة', 'Overdue')}
                  <span className="bg-red-500/20 text-red-300 text-xs px-2 py-0.5 rounded-full">{overdueItems.length}</span>
                </span>
                <ChevronIcon open={showOverdue} />
              </button>
              {showOverdue && (
                <div className="px-4 pb-3 space-y-2">
                  {overdueItems.map((o: any) => {
                    const overMs = Date.now() - new Date(o.slaDeadline).getTime();
                    const overHrs = Math.floor(overMs / 3600000);
                    return (
                      <div key={o.id} className="rounded-xl bg-white/5 border border-red-500/20 p-3 flex items-center justify-between">
                        <div>
                          <p className="text-sm">{o.code || o.id?.slice(0, 8)}</p>
                          <p className="text-xs text-white/50">{tr(o.titleAr || '', o.title || '')}</p>
                        </div>
                        <span className="text-xs text-red-400">{tr(`متأخر بـ ${overHrs} س`, `Overdue by ${overHrs}h`)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </section>

        {/* ============================================================= */}
        {/* SECTION 3: MY ACTIVITY                                         */}
        {/* ============================================================= */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">{tr('نشاطي', 'My Activity')}</h2>

          {/* Recent Actions */}
          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-4 space-y-3">
            <h3 className="text-sm font-medium text-white/70">{tr('إجراءات أخيرة', 'Recent Actions')}</h3>
            {recentLogs.length === 0 && <p className="text-xs text-white/40">{tr('لا يوجد نشاط', 'No activity')}</p>}
            {recentLogs.map((log: any, i: number) => (
              <div key={log.id || i} className="flex items-center gap-3">
                <span className={`w-2 h-2 rounded-full shrink-0 ${ACTION_ICONS[log.actionType] ? ACTION_ICONS[log.actionType].replace('text-', 'bg-') : 'bg-white/30'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{tr(log.descriptionAr || log.description || '', log.description || '')}</p>
                </div>
                <span className="text-xs text-white/40 shrink-0">{log.timestamp ? relativeTime(log.timestamp, tr) : ''}</span>
              </div>
            ))}
          </div>

          {/* My Requests */}
          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-4 space-y-3">
            <h3 className="text-sm font-medium text-white/70">{tr('طلباتي', 'My Requests')}</h3>
            {myRequests.length === 0 && <p className="text-xs text-white/40">{tr('لا توجد طلبات', 'No requests')}</p>}
            {myRequests.map((r: any, i: number) => (
              <div key={r.id || i} className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-sm truncate">{r.code || r.id?.slice(0, 8)}</p>
                  <p className="text-xs text-white/50">{r.type || ''}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[r.status] || 'bg-white/10 text-white/60'}`}>
                    {r.status || ''}
                  </span>
                  {r.createdAt && <span className="text-xs text-white/40">{relativeTime(r.createdAt, tr)}</span>}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* ================================================================= */}
      {/* ACTIVE FLOW OVERLAY                                               */}
      {/* ================================================================= */}
      {activeFlow && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeFlow} />

          {/* Slide-up panel */}
          <div className="relative bg-[#0a1228] border-t border-white/10 rounded-t-3xl max-h-[85vh] overflow-y-auto animate-[slideUp_0.3s_ease-out]">
            {/* Header */}
            <div className="sticky top-0 bg-[#0a1228] z-10 px-4 pt-4 pb-3 flex items-center justify-between border-b border-white/5">
              <button onClick={flowStep > 0 ? prevStep : closeFlow} className="p-1">
                {flowStep > 0 ? <BackIcon /> : <XIcon />}
              </button>
              <span className="text-sm font-semibold">
                {activeFlow === 'USE_ITEM' && tr('استخدام صنف', 'Use Item')}
                {activeFlow === 'REQUEST_ITEM' && tr('طلب صنف', 'Request Item')}
                {activeFlow === 'REPORT_ISSUE' && tr('إبلاغ عن مشكلة', 'Report Issue')}
                {activeFlow === 'MOVE_ITEM' && tr('نقل صنف', 'Move Item')}
              </span>
              <button onClick={closeFlow} className="p-1 text-white/40"><XIcon /></button>
            </div>

            {/* Step dots */}
            <div className="flex justify-center gap-1.5 py-3">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <span key={i} className={`w-2 h-2 rounded-full transition-colors ${i === flowStep ? 'bg-cyan-400' : i < flowStep ? 'bg-cyan-400/40' : 'bg-white/15'}`} />
              ))}
            </div>

            {/* Body */}
            <div className="px-4 pb-8 min-h-[280px]">
              {/* ---- USE_ITEM Flow ---- */}
              {activeFlow === 'USE_ITEM' && flowStep === 0 && (
                <SearchStep searchQuery={searchQuery} setSearchQuery={setSearchQuery} filteredItems={filteredItems} tr={tr} language={language} onSelect={(item: any) => { setSelectedItem(item); nextStep(); }} />
              )}
              {activeFlow === 'USE_ITEM' && flowStep === 1 && selectedItem && (
                <ItemPreview item={selectedItem} tr={tr} language={language} onNext={nextStep} />
              )}
              {activeFlow === 'USE_ITEM' && flowStep === 2 && (
                <QuantityStep quantity={quantity} setQuantity={setQuantity} tr={tr} onNext={nextStep} />
              )}
              {activeFlow === 'USE_ITEM' && flowStep === 3 && (
                <div className="space-y-4">
                  <label className="block text-sm text-white/60">{tr('رقم المريض (اختياري)', 'Patient MRN (optional)')}</label>
                  <input value={patientMrn} onChange={(e) => setPatientMrn(e.target.value)} placeholder={tr('أدخل رقم الملف', 'Enter MRN')} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm placeholder:text-white/30 focus:outline-none focus:border-cyan-500/50" />
                  <button onClick={nextStep} className="w-full py-3 rounded-xl bg-cyan-500/20 text-cyan-300 font-medium text-sm hover:bg-cyan-500/30 transition-colors">
                    {tr('التالي', 'Next')}
                  </button>
                </div>
              )}
              {activeFlow === 'USE_ITEM' && flowStep === 4 && (
                <ConfirmStep tr={tr} onConfirm={confirmFlow} selectedItem={selectedItem} quantity={quantity} color="cyan" />
              )}

              {/* ---- REQUEST_ITEM Flow ---- */}
              {activeFlow === 'REQUEST_ITEM' && flowStep === 0 && (
                <SearchStep searchQuery={searchQuery} setSearchQuery={setSearchQuery} filteredItems={filteredItems} tr={tr} language={language} onSelect={(item: any) => { setSelectedItem(item); nextStep(); }} />
              )}
              {activeFlow === 'REQUEST_ITEM' && flowStep === 1 && (
                <QuantityStep quantity={quantity} setQuantity={setQuantity} tr={tr} onNext={nextStep} />
              )}
              {activeFlow === 'REQUEST_ITEM' && flowStep === 2 && (
                <div className="space-y-3">
                  <label className="block text-sm text-white/60">{tr('سبب الطلب', 'Reason')}</label>
                  {([
                    { key: 'PATIENT_CARE' as const, ar: 'رعاية مريض', en: 'Patient Care', color: 'cyan' },
                    { key: 'STOCK_REFILL' as const, ar: 'تعبئة مخزون', en: 'Stock Refill', color: 'emerald' },
                    { key: 'EMERGENCY' as const, ar: 'طارئ', en: 'Emergency', color: 'red' },
                  ]).map((r) => (
                    <button key={r.key} onClick={() => { setRequestReason(r.key); nextStep(); }}
                      className={`w-full py-3 rounded-xl border border-white/10 bg-white/5 text-sm font-medium hover:border-${r.color}-500/50 transition-colors`}>
                      {tr(r.ar, r.en)}
                    </button>
                  ))}
                </div>
              )}
              {activeFlow === 'REQUEST_ITEM' && flowStep === 3 && (
                <ConfirmStep tr={tr} onConfirm={confirmFlow} selectedItem={selectedItem} quantity={quantity} color="emerald" />
              )}

              {/* ---- REPORT_ISSUE Flow ---- */}
              {activeFlow === 'REPORT_ISSUE' && flowStep === 0 && (
                <div className="space-y-3">
                  <label className="block text-sm text-white/60">{tr('نوع المشكلة', 'Issue Type')}</label>
                  {([
                    { key: 'DAMAGED' as const, ar: 'تالف', en: 'Damaged', color: 'red' },
                    { key: 'MISSING' as const, ar: 'مفقود', en: 'Missing', color: 'amber' },
                    { key: 'EXPIRED' as const, ar: 'منتهي الصلاحية', en: 'Expired', color: 'orange' },
                    { key: 'WRONG_ITEM' as const, ar: 'صنف خاطئ', en: 'Wrong Item', color: 'purple' },
                  ]).map((t) => (
                    <button key={t.key} onClick={() => { setIssueType(t.key); nextStep(); }}
                      className={`w-full py-3 rounded-xl border border-white/10 bg-white/5 text-sm font-medium hover:border-${t.color}-500/50 transition-colors`}>
                      {tr(t.ar, t.en)}
                    </button>
                  ))}
                </div>
              )}
              {activeFlow === 'REPORT_ISSUE' && flowStep === 1 && (
                <SearchStep searchQuery={searchQuery} setSearchQuery={setSearchQuery} filteredItems={filteredItems} tr={tr} language={language} onSelect={(item: any) => { setSelectedItem(item); nextStep(); }} />
              )}
              {activeFlow === 'REPORT_ISSUE' && flowStep === 2 && (
                <div className="space-y-4">
                  <label className="block text-sm text-white/60">{tr('ملاحظات (اختياري)', 'Notes (optional)')}</label>
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder={tr('وصف المشكلة...', 'Describe the issue...')} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm placeholder:text-white/30 focus:outline-none focus:border-amber-500/50 resize-none" />
                  <button onClick={nextStep} className="w-full py-3 rounded-xl bg-amber-500/20 text-amber-300 font-medium text-sm hover:bg-amber-500/30 transition-colors">
                    {tr('التالي', 'Next')}
                  </button>
                </div>
              )}
              {activeFlow === 'REPORT_ISSUE' && flowStep === 3 && (
                <ConfirmStep tr={tr} onConfirm={confirmFlow} selectedItem={selectedItem} quantity={0} color="amber" />
              )}

              {/* ---- MOVE_ITEM Flow ---- */}
              {activeFlow === 'MOVE_ITEM' && flowStep === 0 && (
                <SearchStep searchQuery={searchQuery} setSearchQuery={setSearchQuery} filteredItems={filteredItems} tr={tr} language={language} onSelect={(item: any) => { setSelectedItem(item); nextStep(); }} />
              )}
              {activeFlow === 'MOVE_ITEM' && flowStep === 1 && (
                <div className="space-y-3">
                  <label className="block text-sm text-white/60">{tr('الوجهة', 'Destination')}</label>
                  {brain.hospitals.map((h: any) => (
                    <button key={h.id} onClick={() => { setDestination(h.id); nextStep(); }}
                      className="w-full py-3 rounded-xl border border-white/10 bg-white/5 text-sm font-medium hover:border-purple-500/50 transition-colors">
                      {tr(h.nameAr || h.name, h.name)}
                    </button>
                  ))}
                  {brain.hospitals.length === 0 && <p className="text-xs text-white/40">{tr('لا توجد وجهات', 'No destinations')}</p>}
                </div>
              )}
              {activeFlow === 'MOVE_ITEM' && flowStep === 2 && (
                <div className="space-y-3">
                  <label className="block text-sm text-white/60">{tr('السبب', 'Reason')}</label>
                  {([
                    { key: 'TRANSFER' as const, ar: 'تحويل', en: 'Transfer' },
                    { key: 'BORROW' as const, ar: 'إعارة', en: 'Borrow' },
                    { key: 'RETURN' as const, ar: 'إرجاع', en: 'Return' },
                  ]).map((r) => (
                    <button key={r.key} onClick={() => { setMoveReason(r.key); nextStep(); }}
                      className="w-full py-3 rounded-xl border border-white/10 bg-white/5 text-sm font-medium hover:border-purple-500/50 transition-colors">
                      {tr(r.ar, r.en)}
                    </button>
                  ))}
                </div>
              )}
              {activeFlow === 'MOVE_ITEM' && flowStep === 3 && (
                <ConfirmStep tr={tr} onConfirm={confirmFlow} selectedItem={selectedItem} quantity={0} color="purple" />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Keyframe for slide-up */}
      <style jsx>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SearchStep({ searchQuery, setSearchQuery, filteredItems, tr, language, onSelect }: {
  searchQuery: string; setSearchQuery: (v: string) => void; filteredItems: any[]; tr: (ar: string, en: string) => string; language: string; onSelect: (item: any) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="relative">
        <span className="absolute inset-y-0 start-3 flex items-center"><SearchIcon /></span>
        <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} autoFocus
          placeholder={tr('بحث بالاسم أو الرمز...', 'Search by name or SKU...')}
          className="w-full bg-white/5 border border-white/10 rounded-xl ps-10 pe-4 py-3 text-sm placeholder:text-white/30 focus:outline-none focus:border-cyan-500/50" />
      </div>
      {filteredItems.length > 0 && (
        <div className="space-y-1">
          {filteredItems.map((item: any) => (
            <button key={item.id} onClick={() => onSelect(item)}
              className="w-full text-start rounded-xl bg-white/5 p-3 hover:bg-white/10 transition-colors">
              <p className="text-sm font-medium">{tr(item.nameAr || item.name, item.name)}</p>
              <div className="flex items-center gap-3 mt-1 text-xs text-white/50">
                {item.sku && <span>{item.sku}</span>}
                <span>{tr('متوفر', 'On Hand')}: {item.onHand ?? item.quantityOnHand ?? 0}</span>
                {item.location && <span>{item.location}</span>}
              </div>
            </button>
          ))}
        </div>
      )}
      {searchQuery.trim() && filteredItems.length === 0 && (
        <p className="text-xs text-white/40 text-center py-4">{tr('لا توجد نتائج', 'No results')}</p>
      )}
    </div>
  );
}

function ItemPreview({ item, tr, language, onNext }: { item: any; tr: (ar: string, en: string) => string; language: string; onNext: () => void }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white/5 border border-white/10 p-4 space-y-2">
        <p className="text-base font-semibold">{tr(item.nameAr || item.name, item.name)}</p>
        <div className="grid grid-cols-2 gap-2 text-xs text-white/60">
          <span>{tr('الرمز', 'SKU')}: {item.sku || '-'}</span>
          <span>{tr('متوفر', 'On Hand')}: {item.onHand ?? item.quantityOnHand ?? 0}</span>
          <span>{tr('الموقع', 'Location')}: {item.location || '-'}</span>
          <span>{tr('الوحدة', 'Unit')}: {item.unit || '-'}</span>
        </div>
      </div>
      <button onClick={onNext} className="w-full py-3 rounded-xl bg-cyan-500/20 text-cyan-300 font-medium text-sm hover:bg-cyan-500/30 transition-colors">
        {tr('التالي', 'Next')}
      </button>
    </div>
  );
}

function QuantityStep({ quantity, setQuantity, tr, onNext }: { quantity: number; setQuantity: (v: number) => void; tr: (ar: string, en: string) => string; onNext: () => void }) {
  return (
    <div className="space-y-4">
      <label className="block text-sm text-white/60">{tr('الكمية', 'Quantity')}</label>
      <div className="flex items-center justify-center gap-6">
        <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-12 h-12 rounded-xl bg-white/10 text-xl font-bold hover:bg-white/20 transition-colors">-</button>
        <span className="text-3xl font-bold tabular-nums w-16 text-center">{quantity}</span>
        <button onClick={() => setQuantity(quantity + 1)} className="w-12 h-12 rounded-xl bg-white/10 text-xl font-bold hover:bg-white/20 transition-colors">+</button>
      </div>
      <button onClick={onNext} className="w-full py-3 rounded-xl bg-cyan-500/20 text-cyan-300 font-medium text-sm hover:bg-cyan-500/30 transition-colors">
        {tr('التالي', 'Next')}
      </button>
    </div>
  );
}

function ConfirmStep({ tr, onConfirm, selectedItem, quantity, color }: { tr: (ar: string, en: string) => string; onConfirm: () => void; selectedItem: any; quantity: number; color: string }) {
  return (
    <div className="space-y-4 text-center">
      <p className="text-sm text-white/60">{tr('تأكيد العملية', 'Confirm Action')}</p>
      {selectedItem && (
        <div className="rounded-xl bg-white/5 border border-white/10 p-4">
          <p className="font-semibold">{selectedItem.name || selectedItem.nameAr}</p>
          {quantity > 0 && <p className="text-xs text-white/50 mt-1">{tr('الكمية', 'Qty')}: {quantity}</p>}
        </div>
      )}
      <button onClick={onConfirm}
        className={`w-full py-3.5 rounded-xl bg-${color}-500 text-white font-semibold text-sm hover:bg-${color}-600 transition-colors`}>
        {tr('تأكيد', 'Confirm')}
      </button>
    </div>
  );
}
