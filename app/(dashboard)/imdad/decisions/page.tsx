'use client';

import { useState, useMemo } from 'react';
import { useLang } from '@/hooks/use-lang';
import { useImdadBrain } from '@/hooks/imdad/use-imdad-brain';
import {
  Brain, Zap, CheckCircle, Clock, RefreshCw, Shield,
  TrendingUp, BarChart3, DollarSign, Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* Decision type color mapping                                         */
/* ------------------------------------------------------------------ */
const TYPE_COLORS: Record<string, string> = {
  EMERGENCY_PROCUREMENT: 'bg-red-500/15 text-red-400 border-red-500/25',
  DEVICE_REPLACEMENT: 'bg-purple-500/15 text-purple-400 border-purple-500/25',
  SUPPLY_REORDER: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
  VENDOR_ESCALATION: 'bg-orange-500/15 text-orange-400 border-orange-500/25',
  MAINTENANCE_DISPATCH: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/25',
  BUDGET_ADJUSTMENT: 'bg-green-500/15 text-green-400 border-green-500/25',
  STOCK_REALLOCATION: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  RISK_MITIGATION: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  COST_OPTIMIZATION: 'bg-lime-500/15 text-lime-400 border-lime-500/25',
  VENDOR_SWITCH: 'bg-orange-500/15 text-orange-400 border-orange-500/25',
};

const TYPE_LABELS: Record<string, { ar: string; en: string }> = {
  EMERGENCY_PROCUREMENT: { ar: 'مشتريات طارئة', en: 'Emergency Procurement' },
  DEVICE_REPLACEMENT: { ar: 'استبدال جهاز', en: 'Device Replacement' },
  SUPPLY_REORDER: { ar: 'إعادة طلب', en: 'Supply Reorder' },
  VENDOR_ESCALATION: { ar: 'تصعيد مورد', en: 'Vendor Escalation' },
  MAINTENANCE_DISPATCH: { ar: 'إرسال صيانة', en: 'Maintenance Dispatch' },
  BUDGET_ADJUSTMENT: { ar: 'تعديل ميزانية', en: 'Budget Adjustment' },
  STOCK_REALLOCATION: { ar: 'إعادة توزيع مخزون', en: 'Stock Reallocation' },
  RISK_MITIGATION: { ar: 'تخفيف مخاطر', en: 'Risk Mitigation' },
  COST_OPTIMIZATION: { ar: 'تحسين تكاليف', en: 'Cost Optimization' },
  VENDOR_SWITCH: { ar: 'تبديل مورد', en: 'Vendor Switch' },
};

const TYPE_ACTIONS: Record<string, { ar: string; en: string }> = {
  EMERGENCY_PROCUREMENT: { ar: 'إطلاق أمر شراء طارئ', en: 'Issuing emergency purchase order' },
  DEVICE_REPLACEMENT: { ar: 'جدولة استبدال الجهاز', en: 'Scheduling device replacement' },
  SUPPLY_REORDER: { ar: 'إعادة طلب تلقائي', en: 'Auto-reordering supplies' },
  VENDOR_ESCALATION: { ar: 'تصعيد للمورد البديل', en: 'Escalating to alternate vendor' },
  MAINTENANCE_DISPATCH: { ar: 'إرسال فريق صيانة', en: 'Dispatching maintenance team' },
  BUDGET_ADJUSTMENT: { ar: 'تعديل تخصيص الميزانية', en: 'Adjusting budget allocation' },
  STOCK_REALLOCATION: { ar: 'نقل مخزون بين المواقع', en: 'Transferring stock cross-site' },
  RISK_MITIGATION: { ar: 'تفعيل إجراءات وقائية', en: 'Activating preventive measures' },
  COST_OPTIMIZATION: { ar: 'تطبيق خطة تحسين التكاليف', en: 'Applying cost optimization plan' },
  VENDOR_SWITCH: { ar: 'التحويل إلى مورد بديل', en: 'Switching to alternate vendor' },
};

/* ------------------------------------------------------------------ */
/* Status filter config                                                */
/* ------------------------------------------------------------------ */
type FilterKey = 'ALL' | 'AUTO_APPROVED' | 'PENDING_REVIEW' | 'EXECUTING' | 'COMPLETED';

const STATUS_BADGE: Record<string, string> = {
  AUTO_APPROVED: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  PENDING_REVIEW: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  EXECUTING: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/25',
  COMPLETED: 'bg-gray-500/15 text-gray-400 border-gray-500/25',
  REJECTED: 'bg-red-500/15 text-red-400 border-red-500/25',
};

const STATUS_LABELS: Record<string, { ar: string; en: string }> = {
  AUTO_APPROVED: { ar: 'معتمد تلقائيا', en: 'Auto-Approved' },
  PENDING_REVIEW: { ar: 'قيد المراجعة', en: 'Pending Review' },
  EXECUTING: { ar: 'قيد التنفيذ', en: 'Executing' },
  COMPLETED: { ar: 'مكتمل', en: 'Completed' },
  REJECTED: { ar: 'مرفوض', en: 'Rejected' },
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */
const fmtSAR = (n: number | undefined | null) =>
  n != null
    ? new Intl.NumberFormat('en-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(n)
    : '—';

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 1) return '<1m';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */
export default function DecisionCorePage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const brain = useImdadBrain();
  const [filter, setFilter] = useState<FilterKey>('ALL');

  const allDecisions: any[] = brain.decisions;

  /* counts per status */
  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: allDecisions.length };
    for (const d of allDecisions) c[d.status] = (c[d.status] || 0) + 1;
    return c;
  }, [allDecisions]);

  /* filtered list */
  const filtered = useMemo(
    () => (filter === 'ALL' ? allDecisions : allDecisions.filter((d: any) => d.status === filter)),
    [allDecisions, filter],
  );

  /* summary metrics */
  const autoRate = allDecisions.length
    ? Math.round(((counts.AUTO_APPROVED || 0) / allDecisions.length) * 100)
    : 0;
  const avgConf = allDecisions.length
    ? Math.round(allDecisions.reduce((s: number, d: any) => s + (d.confidenceScore ?? d.confidence ?? 0), 0) / allDecisions.length)
    : 0;
  const totalImpact = allDecisions.reduce(
    (s: number, d: any) => s + (d.financialImpact?.estimatedCost ?? d.costImpact ?? 0),
    0,
  );

  const loading = !brain.isLive && brain.cycleCount === 0;

  const FILTERS: { key: FilterKey; ar: string; en: string }[] = [
    { key: 'ALL', ar: 'الكل', en: 'ALL' },
    { key: 'AUTO_APPROVED', ar: 'معتمد تلقائيا', en: 'AUTO_APPROVED' },
    { key: 'PENDING_REVIEW', ar: 'قيد المراجعة', en: 'PENDING_REVIEW' },
    { key: 'EXECUTING', ar: 'قيد التنفيذ', en: 'EXECUTING' },
    { key: 'COMPLETED', ar: 'مكتمل', en: 'COMPLETED' },
  ];

  /* empty state messages per filter */
  const emptyMsg: Record<FilterKey, { ar: string; en: string }> = {
    ALL: { ar: 'لا توجد قرارات بعد — النظام يعالج البيانات', en: 'No decisions yet — system is processing' },
    AUTO_APPROVED: { ar: 'لا توجد قرارات معتمدة تلقائيا', en: 'No auto-approved decisions yet' },
    PENDING_REVIEW: { ar: 'لا توجد قرارات تحتاج مراجعة', en: 'No pending decisions requiring review' },
    EXECUTING: { ar: 'لا توجد قرارات قيد التنفيذ حاليا', en: 'No decisions currently executing' },
    COMPLETED: { ar: 'لا توجد قرارات مكتملة بعد', en: 'No completed decisions yet — system is processing' },
  };

  /* glass panel class */
  const glass = 'bg-white/[0.03] backdrop-blur-sm border border-white/[0.06] rounded-2xl';

  return (
    <div className="min-h-screen bg-[#050a18] text-white p-4 md:p-6 space-y-5" dir={language === 'ar' ? 'rtl' : 'ltr'}>

      {/* -------- Header -------- */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
            <Brain className="h-5 w-5 text-cyan-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight">{tr('نواة القرارات', 'Decision Core')}</h1>
              {brain.isLive && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> LIVE
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {tr('الدورة', 'Cycle')} #{brain.cycleCount} &middot; {allDecisions.length} {tr('قرار', 'decisions')}
            </p>
          </div>
        </div>
      </div>

      {/* -------- Summary Strip -------- */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: tr('إجمالي القرارات', 'Total Decisions'), value: String(allDecisions.length), icon: BarChart3, color: 'text-cyan-400' },
          { label: tr('نسبة الاعتماد التلقائي', 'Auto-Approved %'), value: `${autoRate}%`, icon: Zap, color: 'text-emerald-400' },
          { label: tr('متوسط الثقة', 'Avg Confidence'), value: `${avgConf}%`, icon: Shield, color: 'text-amber-400' },
          { label: tr('إجمالي الأثر المالي', 'Total Impact SAR'), value: fmtSAR(totalImpact), icon: DollarSign, color: 'text-purple-400' },
        ].map((c) => (
          <div key={c.label} className={cn(glass, 'p-4 flex items-center gap-3')}>
            <c.icon className={cn('h-5 w-5 shrink-0', c.color)} />
            <div className="min-w-0">
              <p className="text-[11px] text-gray-500 truncate">{c.label}</p>
              <p className="text-lg font-bold tracking-tight truncate">{c.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* -------- Filter Pills -------- */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = filter === f.key;
          const count = counts[f.key] || 0;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                'px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all',
                active
                  ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300'
                  : 'border-white/[0.06] text-gray-500 hover:border-white/10 hover:text-gray-300',
              )}
            >
              {tr(f.ar, f.en)} ({count})
            </button>
          );
        })}
      </div>

      {/* -------- Decision List -------- */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <Loader2 className="h-8 w-8 text-cyan-400 animate-spin" />
          <p className="text-sm text-gray-500">{tr('جار تحميل نواة القرارات...', 'Loading Decision Core...')}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className={cn(glass, 'flex flex-col items-center justify-center py-20 gap-3')}>
          <Brain className="h-12 w-12 text-gray-700" />
          <p className="text-sm text-gray-500">{tr(emptyMsg[filter].ar, emptyMsg[filter].en)}</p>
        </div>
      ) : (
        <div className="max-h-[calc(100vh-22rem)] overflow-y-auto pr-1 space-y-3 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
          {filtered.map((d: any, idx: number) => {
            const dType = d.decisionType || d.type || '';
            const conf = d.confidenceScore ?? d.confidence ?? 0;
            const risk = d.riskScore ?? d.risk ?? null;
            const estCost = d.financialImpact?.estimatedCost ?? d.costImpact ?? null;
            const avoidedLoss = d.financialImpact?.avoidedLoss ?? null;
            const hospital = language === 'ar' ? (d.hospitalNameAr || d.hospitalName) : (d.hospitalName || d.hospitalNameAr);
            const title = language === 'ar' ? (d.titleAr || d.title) : (d.title || d.titleAr);
            const cause = d.reasoning?.title || d.reasoning || d.cause || title;
            const responsible = d.approvalAuthority || d.governance?.domainOwner || '—';
            const approvalChain = d.approvalChain || d.governance?.approvalChain || [];
            const code = d.decisionCode || d.code || `DEC-2026-${String(idx + 1).padStart(3, '0')}`;
            const statusLbl = STATUS_LABELS[d.status] || { ar: d.status, en: d.status };
            const typeLbl = TYPE_LABELS[dType] || { ar: dType, en: dType };
            const typeAction = TYPE_ACTIONS[dType] || { ar: dType, en: dType };

            return (
              <div key={d.id || idx} className={cn(glass, 'p-4 hover:border-white/10 transition-all group')}>
                {/* Row 1: code + status + auto */}
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="font-mono text-xs text-cyan-400">{code}</span>
                  <span className={cn('px-2 py-0.5 rounded text-[10px] border font-medium flex items-center gap-1', STATUS_BADGE[d.status] || 'bg-gray-500/15 text-gray-400 border-gray-500/25')}>
                    {d.status === 'EXECUTING' && <Loader2 className="h-3 w-3 animate-spin" />}
                    {d.status === 'AUTO_APPROVED' && <CheckCircle className="h-3 w-3" />}
                    {d.status === 'PENDING_REVIEW' && <Clock className="h-3 w-3" />}
                    {d.status === 'COMPLETED' && <CheckCircle className="h-3 w-3" />}
                    {tr(statusLbl.ar, statusLbl.en)}
                  </span>
                  {d.autoApproved && (
                    <span className="text-[10px] text-yellow-400 flex items-center gap-0.5">
                      <Zap className="h-3 w-3" /> {tr('تلقائي', 'auto')}
                    </span>
                  )}
                  <span className="ml-auto text-[10px] text-gray-600">{d.createdAt ? `${timeAgo(d.createdAt)} ${tr('مضت', 'ago')}` : ''}</span>
                </div>

                {/* Row 2: title */}
                <h3 className="text-sm font-semibold mb-2 leading-snug">{title}</h3>

                {/* Row 3: type + hospital + domain */}
                <div className="flex items-center gap-2 flex-wrap mb-3">
                  <span className={cn('px-2 py-0.5 rounded text-[10px] border', TYPE_COLORS[dType] || 'bg-gray-500/15 text-gray-400 border-gray-500/25')}>
                    {tr(typeLbl.ar, typeLbl.en)}
                  </span>
                  {hospital && <span className="text-[10px] text-gray-400">{hospital}</span>}
                  {d.domain && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] bg-white/[0.04] text-gray-500 border border-white/[0.06]">
                      {d.domain}
                    </span>
                  )}
                </div>

                {/* Row 4: confidence bar */}
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-[10px] text-gray-500 w-16 shrink-0">{tr('الثقة', 'Confidence')}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${conf}%`,
                        background: conf >= 80 ? '#22c55e' : conf >= 50 ? '#eab308' : '#ef4444',
                      }}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-gray-400 w-8 text-right">{conf}%</span>
                </div>

                {/* Row 5: detail grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1.5 text-[11px]">
                  {risk != null && (
                    <div>
                      <span className="text-gray-600">{tr('المخاطر', 'Risk')}: </span>
                      <span className="text-red-400 font-medium">{risk}</span>
                    </div>
                  )}
                  {estCost != null && (
                    <div>
                      <span className="text-gray-600">{tr('التكلفة', 'Cost')}: </span>
                      <span className="text-white/80">{fmtSAR(estCost)}</span>
                    </div>
                  )}
                  {avoidedLoss != null && (
                    <div>
                      <span className="text-gray-600">{tr('خسائر مُتفادَاة', 'Avoided Loss')}: </span>
                      <span className="text-emerald-400">{fmtSAR(avoidedLoss)}</span>
                    </div>
                  )}
                  <div className="col-span-2 md:col-span-3">
                    <span className="text-gray-600">{tr('السبب', 'Cause')}: </span>
                    <span className="text-gray-300">{typeof cause === 'string' ? cause : ''}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">{tr('المسؤول', 'Responsible')}: </span>
                    <span className="text-gray-300">{responsible}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-600">{tr('الإجراء', 'Action')}: </span>
                    <span className="text-gray-300">{tr(typeAction.ar, typeAction.en)}</span>
                  </div>
                </div>

                {/* Row 6: approval chain */}
                {approvalChain.length > 0 && (
                  <div className="flex items-center gap-2 mt-3 pt-2 border-t border-white/[0.04]">
                    <span className="text-[10px] text-gray-600 shrink-0">{tr('سلسلة الاعتماد', 'Approval Chain')}</span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {approvalChain.map((step: any, i: number) => (
                        <div key={i} className="flex items-center gap-1">
                          <span className={cn(
                            'h-2 w-2 rounded-full',
                            step.status === 'APPROVED' ? 'bg-emerald-400'
                              : step.status === 'REJECTED' ? 'bg-red-400'
                                : step.status === 'PENDING' ? 'bg-amber-400'
                                  : 'bg-gray-600',
                          )} />
                          <span className="text-[10px] text-gray-400">{step.role || step.name}</span>
                          {i < approvalChain.length - 1 && <span className="text-gray-700 text-[10px]">&rarr;</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
