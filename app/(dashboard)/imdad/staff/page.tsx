'use client';

import { useState, useMemo, useCallback } from 'react';
import { useLang } from '@/hooks/use-lang';
import { useImdadBrain } from '@/hooks/imdad/use-imdad-brain';

// ==================================================================
// STAFF ACTIONS PAGE
//
// The primary interface for any hospital employee. Hides system
// complexity and shows only actionable items: report usage, request
// items, and report issues.
// ==================================================================

const HOSPITAL_ID = '';

type Tab = 'usage' | 'request' | 'issue';

type UsageReason = 'patient_care' | 'procedure' | 'emergency' | 'routine_restock' | 'training' | 'waste';
type RequestType = 'supply' | 'maintenance' | 'transfer';
type Priority = 'routine' | 'urgent' | 'emergency';
type IssueType = 'device_down' | 'low_stock' | 'expired_item' | 'quality_problem' | 'missing_item';
type Severity = 'low' | 'medium' | 'high';

const LOCATIONS = ['ICU', 'Emergency', 'OR', 'Ward-1', 'Ward-2', 'Pharmacy', 'Main Store'] as const;

interface UsageRecord {
  id: string;
  itemName: string;
  quantity: number;
  reason: UsageReason;
  location: string;
  timestamp: Date;
}

interface IssueRecord {
  id: string;
  type: IssueType;
  itemName: string;
  severity: Severity;
  location: string;
  timestamp: Date;
}

export default function StaffActionsPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const brain = useImdadBrain();

  const [activeTab, setActiveTab] = useState<Tab>('usage');

  // ---------- Usage Form State ----------
  const [usageSearch, setUsageSearch] = useState('');
  const [usageSelectedItem, setUsageSelectedItem] = useState<any | null>(null);
  const [usageQty, setUsageQty] = useState<number>(1);
  const [usageReason, setUsageReason] = useState<UsageReason>('patient_care');
  const [usageMrn, setUsageMrn] = useState('');
  const [usageLocation, setUsageLocation] = useState<string>('ICU');
  const [usageRecords, setUsageRecords] = useState<UsageRecord[]>([]);
  const [usageSuccess, setUsageSuccess] = useState(false);

  // ---------- Request Form State ----------
  const [reqType, setReqType] = useState<RequestType>('supply');
  const [reqSearch, setReqSearch] = useState('');
  const [reqSelectedItem, setReqSelectedItem] = useState<any | null>(null);
  const [reqQty, setReqQty] = useState<number>(1);
  const [reqPriority, setReqPriority] = useState<Priority>('routine');
  const [reqReason, setReqReason] = useState('');
  const [reqSuccess, setReqSuccess] = useState(false);
  const [reqCode, setReqCode] = useState('');

  // ---------- Issue Form State ----------
  const [issueType, setIssueType] = useState<IssueType>('device_down');
  const [issueSearch, setIssueSearch] = useState('');
  const [issueSelectedItem, setIssueSelectedItem] = useState<any | null>(null);
  const [issueDesc, setIssueDesc] = useState('');
  const [issueSeverity, setIssueSeverity] = useState<Severity>('medium');
  const [issueLocation, setIssueLocation] = useState<string>('ICU');
  const [issueRecords, setIssueRecords] = useState<IssueRecord[]>([]);
  const [issueSuccess, setIssueSuccess] = useState(false);

  // ---------- Filtered Items ----------
  const hospitalItems = useMemo(
    () => brain.inventoryItems.filter((i: any) => i.hospitalId === HOSPITAL_ID || !i.hospitalId),
    [brain.inventoryItems],
  );

  const filteredUsageItems = useMemo(() => {
    if (!usageSearch.trim()) return [];
    const q = usageSearch.toLowerCase();
    return hospitalItems.filter(
      (i: any) =>
        (i.name?.toLowerCase().includes(q) || i.sku?.toLowerCase().includes(q) || i.nameAr?.includes(usageSearch)),
    ).slice(0, 8);
  }, [usageSearch, hospitalItems]);

  const filteredReqItems = useMemo(() => {
    if (!reqSearch.trim()) return [];
    const q = reqSearch.toLowerCase();
    return hospitalItems.filter(
      (i: any) =>
        (i.name?.toLowerCase().includes(q) || i.sku?.toLowerCase().includes(q) || i.nameAr?.includes(reqSearch)),
    ).slice(0, 8);
  }, [reqSearch, hospitalItems]);

  const allSearchableItems = useMemo(() => {
    const items = [...hospitalItems];
    brain.deviceAssets.forEach((d: any) => {
      if (d.hospitalId === HOSPITAL_ID || !d.hospitalId) {
        items.push({ ...d, isDevice: true });
      }
    });
    return items;
  }, [hospitalItems, brain.deviceAssets]);

  const filteredIssueItems = useMemo(() => {
    if (!issueSearch.trim()) return [];
    const q = issueSearch.toLowerCase();
    return allSearchableItems.filter(
      (i: any) =>
        (i.name?.toLowerCase().includes(q) || i.sku?.toLowerCase().includes(q) || i.nameAr?.includes(issueSearch) || i.assetTag?.toLowerCase().includes(q)),
    ).slice(0, 8);
  }, [issueSearch, allSearchableItems]);

  // ---------- User requests from brain ----------
  const myRequests = useMemo(
    () => brain.requests.filter((r: any) => r.hospitalId === HOSPITAL_ID).slice(0, 5),
    [brain.requests],
  );

  const mySignalReports = useMemo(
    () => brain.signals.filter((s: any) => s.hospitalId === HOSPITAL_ID && s.type === 'ISSUE_REPORT').slice(0, 5),
    [brain.signals],
  );

  // ---------- Reason labels ----------
  const reasonLabel = useCallback(
    (r: UsageReason) => {
      const map: Record<UsageReason, [string, string]> = {
        patient_care: ['رعاية مريض', 'Patient Care'],
        procedure: ['إجراء طبي', 'Procedure'],
        emergency: ['حالة طوارئ', 'Emergency'],
        routine_restock: ['إعادة تعبئة', 'Routine Restock'],
        training: ['تدريب', 'Training'],
        waste: ['هدر', 'Waste'],
      };
      return tr(map[r][0], map[r][1]);
    },
    [language],
  );

  const issueTypeLabel = useCallback(
    (t: IssueType) => {
      const map: Record<IssueType, [string, string]> = {
        device_down: ['جهاز معطل', 'Device Down'],
        low_stock: ['مخزون منخفض', 'Low Stock'],
        expired_item: ['صنف منتهي', 'Expired Item'],
        quality_problem: ['مشكلة جودة', 'Quality Problem'],
        missing_item: ['صنف مفقود', 'Missing Item'],
      };
      return tr(map[t][0], map[t][1]);
    },
    [language],
  );

  // ---------- Needs MRN ----------
  const needsMrn = usageReason === 'patient_care' || usageReason === 'procedure';

  // ---------- Submit Usage ----------
  const handleUsageSubmit = () => {
    if (!usageSelectedItem || usageQty < 1) return;
    if (needsMrn && !usageMrn.trim()) return;

    const record: UsageRecord = {
      id: `USG-${Date.now()}`,
      itemName: usageSelectedItem.name || usageSelectedItem.sku,
      quantity: usageQty,
      reason: usageReason,
      location: usageLocation,
      timestamp: new Date(),
    };
    setUsageRecords((prev) => [record, ...prev].slice(0, 5));
    setUsageSuccess(true);
    setTimeout(() => setUsageSuccess(false), 2500);

    // Reset form
    setUsageSearch('');
    setUsageSelectedItem(null);
    setUsageQty(1);
    setUsageReason('patient_care');
    setUsageMrn('');
  };

  // ---------- Submit Request ----------
  const handleRequestSubmit = () => {
    if (!reqSelectedItem || reqQty < 1 || !reqReason.trim()) return;

    const result = (brain.createRequest as any)({
      hospitalId: HOSPITAL_ID,
      type: reqType.toUpperCase(),
      sku: reqSelectedItem.sku || reqSelectedItem.name,
      itemName: reqSelectedItem.name,
      quantity: reqQty,
      priority: reqPriority.toUpperCase(),
      justification: reqReason,
      requestedByRole: 'STAFF',
    });

    const code = result?.code || result?.id || `REQ-${Date.now().toString(36).toUpperCase()}`;
    setReqCode(code);
    setReqSuccess(true);
    setTimeout(() => setReqSuccess(false), 3000);

    // Reset form
    setReqSearch('');
    setReqSelectedItem(null);
    setReqQty(1);
    setReqPriority('routine');
    setReqReason('');
  };

  // ---------- Submit Issue ----------
  const handleIssueSubmit = () => {
    if (!issueDesc.trim()) return;

    const record: IssueRecord = {
      id: `ISS-${Date.now()}`,
      type: issueType,
      itemName: issueSelectedItem?.name || issueSelectedItem?.sku || tr('غير محدد', 'Unspecified'),
      severity: issueSeverity,
      location: issueLocation,
      timestamp: new Date(),
    };
    setIssueRecords((prev) => [record, ...prev].slice(0, 5));
    setIssueSuccess(true);
    setTimeout(() => setIssueSuccess(false), 2500);

    // Reset form
    setIssueSearch('');
    setIssueSelectedItem(null);
    setIssueDesc('');
    setIssueSeverity('medium');
    setIssueType('device_down');
  };

  // ---------- Tab config ----------
  const tabs: { key: Tab; labelAr: string; labelEn: string }[] = [
    { key: 'usage', labelAr: 'الإبلاغ عن الاستخدام', labelEn: 'Report Usage' },
    { key: 'request', labelAr: 'طلب صنف', labelEn: 'Request Item' },
    { key: 'issue', labelAr: 'الإبلاغ عن مشكلة', labelEn: 'Report Issue' },
  ];

  // ---------- Severity / Priority color ----------
  const severityColor = (s: Severity | Priority) => {
    if (s === 'low' || s === 'routine') return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    if (s === 'medium' || s === 'urgent') return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    return 'bg-red-500/20 text-red-400 border-red-500/30';
  };

  // ---------- Input styles ----------
  const inputClass =
    'w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/25 focus:ring-1 focus:ring-white/10 transition';
  const selectClass =
    'w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-white/25 focus:ring-1 focus:ring-white/10 transition appearance-none';
  const labelClass = 'block text-xs text-white/50 mb-1';

  return (
    <div className="min-h-screen bg-[#050a18] text-white" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="mx-auto max-w-[600px] px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold">{tr('إجراءاتي', 'My Actions')}</h1>
          <div className="flex items-center gap-2 rounded-full bg-white/5 border border-white/10 px-3 py-1.5">
            <div className="h-2 w-2 rounded-full bg-cyan-400" />
            <span className="text-xs text-white/60">{tr('ممرضة — العناية المركزة', 'Nurse — ICU')}</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 rounded-xl bg-white/5 border border-white/10 p-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition ${
                activeTab === t.key
                  ? 'bg-white/10 text-white'
                  : 'text-white/40 hover:text-white/60'
              }`}
            >
              {tr(t.labelAr, t.labelEn)}
            </button>
          ))}
        </div>

        {/* ====== TAB 1: Report Usage ====== */}
        {activeTab === 'usage' && (
          <div className="space-y-4">
            {usageSuccess && (
              <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-4 py-3">
                <svg className="h-5 w-5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm text-emerald-300">{tr('تم تسجيل الاستخدام بنجاح', 'Usage recorded successfully')}</span>
              </div>
            )}

            <div className="rounded-xl bg-white/[0.03] border border-white/10 p-4 space-y-4">
              {/* Item search */}
              <div>
                <label className={labelClass}>{tr('البحث عن صنف', 'Search Item')}</label>
                <input
                  type="text"
                  className={inputClass}
                  placeholder={tr('اسم أو رمز الصنف...', 'Item name or SKU...')}
                  value={usageSearch}
                  onChange={(e) => {
                    setUsageSearch(e.target.value);
                    setUsageSelectedItem(null);
                  }}
                />
                {filteredUsageItems.length > 0 && !usageSelectedItem && (
                  <div className="mt-1 rounded-lg bg-[#0a1228] border border-white/10 max-h-40 overflow-y-auto">
                    {filteredUsageItems.map((item: any, idx: number) => (
                      <button
                        key={item.sku || idx}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-white/5 transition flex justify-between"
                        onClick={() => {
                          setUsageSelectedItem(item);
                          setUsageSearch(item.name || item.sku);
                        }}
                      >
                        <span className="text-white/80">{item.name || item.sku}</span>
                        <span className="text-white/30 text-xs">{item.sku}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Selected item stock info */}
              {usageSelectedItem && (
                <div className="flex gap-3 text-xs">
                  <div className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 flex-1">
                    <div className="text-white/40">{tr('في المخزن', 'On Hand')}</div>
                    <div className="text-white font-medium mt-0.5">{usageSelectedItem.onHand ?? usageSelectedItem.quantity ?? '—'}</div>
                  </div>
                  <div className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 flex-1">
                    <div className="text-white/40">{tr('متاح', 'Available')}</div>
                    <div className="text-white font-medium mt-0.5">{usageSelectedItem.available ?? usageSelectedItem.onHand ?? '—'}</div>
                  </div>
                </div>
              )}

              {/* Quantity */}
              <div>
                <label className={labelClass}>{tr('الكمية', 'Quantity')}</label>
                <input
                  type="number"
                  min={1}
                  className={inputClass}
                  value={usageQty}
                  onChange={(e) => setUsageQty(Math.max(1, parseInt(e.target.value) || 1))}
                />
              </div>

              {/* Reason */}
              <div>
                <label className={labelClass}>{tr('السبب', 'Reason')}</label>
                <select
                  className={selectClass}
                  value={usageReason}
                  onChange={(e) => setUsageReason(e.target.value as UsageReason)}
                >
                  <option value="patient_care">{tr('رعاية مريض', 'Patient Care')}</option>
                  <option value="procedure">{tr('إجراء طبي', 'Procedure')}</option>
                  <option value="emergency">{tr('حالة طوارئ', 'Emergency')}</option>
                  <option value="routine_restock">{tr('إعادة تعبئة', 'Routine Restock')}</option>
                  <option value="training">{tr('تدريب', 'Training')}</option>
                  <option value="waste">{tr('هدر', 'Waste')}</option>
                </select>
              </div>

              {/* Patient MRN (conditional) */}
              {needsMrn && (
                <div>
                  <label className={labelClass}>{tr('رقم الملف الطبي', 'Patient MRN')} *</label>
                  <input
                    type="text"
                    className={inputClass}
                    placeholder={tr('أدخل رقم الملف...', 'Enter MRN...')}
                    value={usageMrn}
                    onChange={(e) => setUsageMrn(e.target.value)}
                  />
                </div>
              )}

              {/* Location */}
              <div>
                <label className={labelClass}>{tr('الموقع', 'Location')}</label>
                <select
                  className={selectClass}
                  value={usageLocation}
                  onChange={(e) => setUsageLocation(e.target.value)}
                >
                  {LOCATIONS.map((loc) => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>
              </div>

              {/* Submit */}
              <button
                onClick={handleUsageSubmit}
                disabled={!usageSelectedItem || usageQty < 1 || (needsMrn && !usageMrn.trim())}
                className="w-full rounded-lg bg-cyan-500/20 border border-cyan-500/30 px-4 py-2.5 text-sm font-medium text-cyan-300 hover:bg-cyan-500/30 transition disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {tr('تسجيل الاستخدام', 'Record Usage')}
              </button>
            </div>

            {/* Recent usage records */}
            {usageRecords.length > 0 && (
              <div className="rounded-xl bg-white/[0.03] border border-white/10 p-4">
                <h3 className="text-xs text-white/40 mb-3">{tr('آخر التسجيلات', 'Recent Records')}</h3>
                <div className="space-y-2">
                  {usageRecords.map((r) => (
                    <div key={r.id} className="flex items-center justify-between text-xs rounded-lg bg-white/5 px-3 py-2">
                      <div>
                        <span className="text-white/80">{r.itemName}</span>
                        <span className="text-white/30 mx-2">x{r.quantity}</span>
                        <span className="text-white/40">{r.location}</span>
                      </div>
                      <span className="text-white/30">{reasonLabel(r.reason)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ====== TAB 2: Request Item ====== */}
        {activeTab === 'request' && (
          <div className="space-y-4">
            {reqSuccess && (
              <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-4 py-3">
                <svg className="h-5 w-5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm text-emerald-300">
                  {tr('تم إرسال الطلب', 'Request submitted')} — <span className="font-mono">{reqCode}</span>
                </span>
              </div>
            )}

            <div className="rounded-xl bg-white/[0.03] border border-white/10 p-4 space-y-4">
              {/* Request type */}
              <div>
                <label className={labelClass}>{tr('نوع الطلب', 'Request Type')}</label>
                <select
                  className={selectClass}
                  value={reqType}
                  onChange={(e) => setReqType(e.target.value as RequestType)}
                >
                  <option value="supply">{tr('تموين', 'Supply')}</option>
                  <option value="maintenance">{tr('صيانة', 'Maintenance')}</option>
                  <option value="transfer">{tr('نقل', 'Transfer')}</option>
                </select>
              </div>

              {/* Item search */}
              <div>
                <label className={labelClass}>{tr('البحث عن صنف', 'Search Item')}</label>
                <input
                  type="text"
                  className={inputClass}
                  placeholder={tr('اسم أو رمز الصنف...', 'Item name or SKU...')}
                  value={reqSearch}
                  onChange={(e) => {
                    setReqSearch(e.target.value);
                    setReqSelectedItem(null);
                  }}
                />
                {filteredReqItems.length > 0 && !reqSelectedItem && (
                  <div className="mt-1 rounded-lg bg-[#0a1228] border border-white/10 max-h-40 overflow-y-auto">
                    {filteredReqItems.map((item: any, idx: number) => (
                      <button
                        key={item.sku || idx}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-white/5 transition flex justify-between"
                        onClick={() => {
                          setReqSelectedItem(item);
                          setReqSearch(item.name || item.sku);
                        }}
                      >
                        <span className="text-white/80">{item.name || item.sku}</span>
                        <span className="text-white/30 text-xs">{item.sku}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Quantity */}
              <div>
                <label className={labelClass}>{tr('الكمية', 'Quantity')}</label>
                <input
                  type="number"
                  min={1}
                  className={inputClass}
                  value={reqQty}
                  onChange={(e) => setReqQty(Math.max(1, parseInt(e.target.value) || 1))}
                />
              </div>

              {/* Priority */}
              <div>
                <label className={labelClass}>{tr('الأولوية', 'Priority')}</label>
                <div className="flex gap-2">
                  {(['routine', 'urgent', 'emergency'] as Priority[]).map((p) => (
                    <button
                      key={p}
                      onClick={() => setReqPriority(p)}
                      className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition ${
                        reqPriority === p
                          ? severityColor(p)
                          : 'bg-white/5 border-white/10 text-white/40 hover:text-white/60'
                      }`}
                    >
                      {p === 'routine' && tr('عادي', 'Routine')}
                      {p === 'urgent' && tr('عاجل', 'Urgent')}
                      {p === 'emergency' && tr('طوارئ', 'Emergency')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reason */}
              <div>
                <label className={labelClass}>{tr('السبب', 'Reason')} *</label>
                <textarea
                  className={`${inputClass} resize-none`}
                  rows={3}
                  placeholder={tr('اذكر سبب الطلب...', 'Describe the reason...')}
                  value={reqReason}
                  onChange={(e) => setReqReason(e.target.value)}
                />
              </div>

              {/* Department (auto) */}
              <div>
                <label className={labelClass}>{tr('القسم', 'Department')}</label>
                <div className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white/60">
                  {tr('العناية المركزة', 'ICU')}
                </div>
              </div>

              {/* Submit */}
              <button
                onClick={handleRequestSubmit}
                disabled={!reqSelectedItem || reqQty < 1 || !reqReason.trim()}
                className="w-full rounded-lg bg-cyan-500/20 border border-cyan-500/30 px-4 py-2.5 text-sm font-medium text-cyan-300 hover:bg-cyan-500/30 transition disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {tr('إرسال الطلب', 'Submit Request')}
              </button>
            </div>

            {/* My Recent Requests */}
            {myRequests.length > 0 && (
              <div className="rounded-xl bg-white/[0.03] border border-white/10 p-4">
                <h3 className="text-xs text-white/40 mb-3">{tr('طلباتي الأخيرة', 'My Recent Requests')}</h3>
                <div className="space-y-2">
                  {myRequests.map((r: any, idx: number) => (
                    <div key={r.id || idx} className="flex items-center justify-between text-xs rounded-lg bg-white/5 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-white/50">{r.code || r.id}</span>
                        <span className="text-white/80">{r.itemName || r.sku}</span>
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          r.status === 'APPROVED' || r.status === 'COMPLETED'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : r.status === 'REJECTED'
                              ? 'bg-red-500/20 text-red-400'
                              : r.status === 'PENDING_APPROVAL' || r.status === 'PENDING'
                                ? 'bg-amber-500/20 text-amber-400'
                                : 'bg-white/10 text-white/40'
                        }`}
                      >
                        {r.status || tr('جديد', 'New')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ====== TAB 3: Report Issue ====== */}
        {activeTab === 'issue' && (
          <div className="space-y-4">
            {issueSuccess && (
              <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-4 py-3">
                <svg className="h-5 w-5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm text-emerald-300">{tr('تم إرسال البلاغ بنجاح', 'Issue reported successfully')}</span>
              </div>
            )}

            <div className="rounded-xl bg-white/[0.03] border border-white/10 p-4 space-y-4">
              {/* Issue type */}
              <div>
                <label className={labelClass}>{tr('نوع المشكلة', 'Issue Type')}</label>
                <select
                  className={selectClass}
                  value={issueType}
                  onChange={(e) => setIssueType(e.target.value as IssueType)}
                >
                  <option value="device_down">{tr('جهاز معطل', 'Device Down')}</option>
                  <option value="low_stock">{tr('مخزون منخفض', 'Low Stock')}</option>
                  <option value="expired_item">{tr('صنف منتهي', 'Expired Item')}</option>
                  <option value="quality_problem">{tr('مشكلة جودة', 'Quality Problem')}</option>
                  <option value="missing_item">{tr('صنف مفقود', 'Missing Item')}</option>
                </select>
              </div>

              {/* Item / Device search */}
              <div>
                <label className={labelClass}>{tr('البحث عن صنف / جهاز', 'Search Item / Device')}</label>
                <input
                  type="text"
                  className={inputClass}
                  placeholder={tr('اسم أو رمز...', 'Name or code...')}
                  value={issueSearch}
                  onChange={(e) => {
                    setIssueSearch(e.target.value);
                    setIssueSelectedItem(null);
                  }}
                />
                {filteredIssueItems.length > 0 && !issueSelectedItem && (
                  <div className="mt-1 rounded-lg bg-[#0a1228] border border-white/10 max-h-40 overflow-y-auto">
                    {filteredIssueItems.map((item: any, idx: number) => (
                      <button
                        key={item.sku || item.assetTag || idx}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-white/5 transition flex justify-between"
                        onClick={() => {
                          setIssueSelectedItem(item);
                          setIssueSearch(item.name || item.sku || item.assetTag);
                        }}
                      >
                        <span className="text-white/80">{item.name || item.sku || item.assetTag}</span>
                        <span className="text-white/30 text-xs">{(item as any).isDevice ? tr('جهاز', 'Device') : item.sku}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Description */}
              <div>
                <label className={labelClass}>{tr('الوصف', 'Description')} *</label>
                <textarea
                  className={`${inputClass} resize-none`}
                  rows={3}
                  placeholder={tr('صف المشكلة...', 'Describe the issue...')}
                  value={issueDesc}
                  onChange={(e) => setIssueDesc(e.target.value)}
                />
              </div>

              {/* Severity */}
              <div>
                <label className={labelClass}>{tr('الخطورة', 'Severity')}</label>
                <div className="flex gap-2">
                  {(['low', 'medium', 'high'] as Severity[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => setIssueSeverity(s)}
                      className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition ${
                        issueSeverity === s
                          ? severityColor(s)
                          : 'bg-white/5 border-white/10 text-white/40 hover:text-white/60'
                      }`}
                    >
                      {s === 'low' && tr('منخفض', 'Low')}
                      {s === 'medium' && tr('متوسط', 'Medium')}
                      {s === 'high' && tr('عالي', 'High')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Location */}
              <div>
                <label className={labelClass}>{tr('الموقع', 'Location')}</label>
                <select
                  className={selectClass}
                  value={issueLocation}
                  onChange={(e) => setIssueLocation(e.target.value)}
                >
                  {LOCATIONS.map((loc) => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>
              </div>

              {/* Submit */}
              <button
                onClick={handleIssueSubmit}
                disabled={!issueDesc.trim()}
                className="w-full rounded-lg bg-cyan-500/20 border border-cyan-500/30 px-4 py-2.5 text-sm font-medium text-cyan-300 hover:bg-cyan-500/30 transition disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {tr('إبلاغ', 'Report')}
              </button>
            </div>

            {/* My Recent Reports */}
            {issueRecords.length > 0 && (
              <div className="rounded-xl bg-white/[0.03] border border-white/10 p-4">
                <h3 className="text-xs text-white/40 mb-3">{tr('بلاغاتي الأخيرة', 'My Recent Reports')}</h3>
                <div className="space-y-2">
                  {issueRecords.map((r) => (
                    <div key={r.id} className="flex items-center justify-between text-xs rounded-lg bg-white/5 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${severityColor(r.severity)}`}>
                          {r.severity === 'low' && tr('منخفض', 'Low')}
                          {r.severity === 'medium' && tr('متوسط', 'Medium')}
                          {r.severity === 'high' && tr('عالي', 'High')}
                        </span>
                        <span className="text-white/80">{issueTypeLabel(r.type)}</span>
                      </div>
                      <span className="text-white/30">{r.location}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
