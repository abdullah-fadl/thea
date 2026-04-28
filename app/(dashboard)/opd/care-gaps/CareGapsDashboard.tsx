'use client';

import { useState, useCallback } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { useToast } from '@/hooks/use-toast';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------

type TabKey = 'overview' | 'gaps' | 'scan' | 'rules' | 'readmissions';

// ---------------------------------------------------------------------------
// Severity config
// ---------------------------------------------------------------------------

const SEVERITY_CONFIG: Record<string, { labelAr: string; labelEn: string; color: string; order: number }> = {
  critical: { labelAr: 'حرج', labelEn: 'Critical', color: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200', order: 0 },
  high: { labelAr: 'عالي', labelEn: 'High', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-200', order: 1 },
  moderate: { labelAr: 'متوسط', labelEn: 'Moderate', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200', order: 2 },
  low: { labelAr: 'منخفض', labelEn: 'Low', color: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300', order: 3 },
};

const CATEGORY_CONFIG: Record<string, { labelAr: string; labelEn: string }> = {
  preventive: { labelAr: 'رعاية وقائية', labelEn: 'Preventive Care' },
  chronic_disease: { labelAr: 'أمراض مزمنة', labelEn: 'Chronic Disease' },
  medication: { labelAr: 'الأدوية', labelEn: 'Medication' },
  follow_up: { labelAr: 'المتابعة', labelEn: 'Follow-up' },
  screening: { labelAr: 'الفحوصات', labelEn: 'Screening' },
};

const ROOT_CAUSE_CONFIG: Record<string, { labelAr: string; labelEn: string }> = {
  premature_discharge: { labelAr: 'خروج مبكر', labelEn: 'Premature Discharge' },
  inadequate_follow_up: { labelAr: 'متابعة غير كافية', labelEn: 'Inadequate Follow-up' },
  medication_issue: { labelAr: 'مشكلة دوائية', labelEn: 'Medication Issue' },
  social_factors: { labelAr: 'عوامل اجتماعية', labelEn: 'Social Factors' },
  disease_progression: { labelAr: 'تطور المرض', labelEn: 'Disease Progression' },
  complication: { labelAr: 'مضاعفات', labelEn: 'Complication' },
};

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function CareGapsDashboard() {
  const { language, isRTL } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  const tabs: { key: TabKey; labelAr: string; labelEn: string }[] = [
    { key: 'overview', labelAr: 'نظرة عامة', labelEn: 'Overview' },
    { key: 'gaps', labelAr: 'فجوات المرضى', labelEn: 'Patient Gaps' },
    { key: 'scan', labelAr: 'المسح', labelEn: 'Scan' },
    { key: 'rules', labelAr: 'القواعد', labelEn: 'Rules' },
    { key: 'readmissions', labelAr: 'إعادة الدخول', labelEn: 'Readmissions' },
  ];

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="space-y-6 thea-animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            {tr('ماسح فجوات الرعاية وتتبع إعادة الدخول', 'Care Gap Scanner & Readmission Tracking')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {tr(
              'اكتشاف فجوات الرعاية الوقائية وتتبع معدل إعادة الدخول خلال 30 يوم (CBAHI)',
              'Identify preventive care gaps and track 30-day readmission rates (CBAHI)'
            )}
          </p>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 border-b border-border pb-0">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-semibold rounded-t-xl transition-colors ${
              activeTab === tab.key
                ? 'bg-card border border-b-0 border-border text-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            {tr(tab.labelAr, tab.labelEn)}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && <OverviewTab tr={tr} language={language} />}
      {activeTab === 'gaps' && <GapsTab tr={tr} language={language} toast={toast} />}
      {activeTab === 'scan' && <ScanTab tr={tr} language={language} toast={toast} />}
      {activeTab === 'rules' && <RulesTab tr={tr} language={language} toast={toast} />}
      {activeTab === 'readmissions' && <ReadmissionsTab tr={tr} language={language} toast={toast} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared KPI Card
// ---------------------------------------------------------------------------

function KpiCard({ label, value, color, subtitle }: { label: string; value: string | number; color?: string; subtitle?: string }) {
  return (
    <div className="bg-card rounded-2xl border border-border p-4">
      <span className="text-xs text-muted-foreground font-medium">{label}</span>
      <p className={`text-2xl font-bold mt-1 ${color || 'text-foreground'}`}>{value}</p>
      {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 1: Overview
// ---------------------------------------------------------------------------

function OverviewTab({ tr, language }: { tr: (ar: string, en: string) => string; language: string }) {
  const { data: gapStats } = useSWR('/api/care-gaps/findings/stats', fetcher);
  const { data: readmitStats } = useSWR('/api/quality/readmissions/stats', fetcher);

  const gs = gapStats || { totalOpen: 0, totalAddressed: 0, totalDismissed: 0, bySeverity: { critical: 0, high: 0, moderate: 0, low: 0 }, byCategory: {}, addressedThisMonth: 0, closureRate: 0, trend: [] };
  const rs = readmitStats || { thirtyDayRate: 0, totalReadmissions: 0, pendingReview: 0, preventablePercent: 0, trend: [] };

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <KpiCard
          label={tr('فجوات مفتوحة', 'Open Gaps')}
          value={gs.totalOpen}
          color="text-red-600"
        />
        <KpiCard
          label={tr('حرجة', 'Critical')}
          value={gs.bySeverity.critical}
          color={gs.bySeverity.critical > 0 ? 'text-red-600' : 'text-foreground'}
        />
        <KpiCard
          label={tr('تم معالجتها هذا الشهر', 'Addressed This Month')}
          value={gs.addressedThisMonth}
          color="text-emerald-600"
        />
        <KpiCard
          label={tr('معدل الإغلاق', 'Closure Rate')}
          value={`${gs.closureRate}%`}
          color="text-blue-600"
        />
        <KpiCard
          label={tr('معدل إعادة الدخول 30 يوم', '30-Day Readmit Rate')}
          value={`${rs.thirtyDayRate}%`}
          color={rs.thirtyDayRate > 10 ? 'text-red-600' : 'text-emerald-600'}
        />
        <KpiCard
          label={tr('بانتظار المراجعة', 'Pending Review')}
          value={rs.pendingReview}
          color="text-amber-600"
        />
      </div>

      {/* Severity Distribution */}
      <div className="bg-card rounded-2xl border border-border p-5">
        <h3 className="font-bold text-foreground mb-4">
          {tr('توزيع الشدة', 'Severity Distribution')}
        </h3>
        <div className="grid grid-cols-4 gap-3">
          {(['critical', 'high', 'moderate', 'low'] as const).map((sev) => {
            const cfg = SEVERITY_CONFIG[sev];
            const count = gs.bySeverity[sev] || 0;
            const total = gs.totalOpen || 1;
            const pct = Math.round((count / total) * 100);
            return (
              <div key={sev} className="text-center">
                <div className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${cfg.color}`}>
                  {language === 'ar' ? cfg.labelAr : cfg.labelEn}
                </div>
                <p className="text-xl font-bold mt-2 text-foreground">{count}</p>
                <div className="w-full bg-muted rounded-full h-2 mt-2">
                  <div
                    className={`h-2 rounded-full ${
                      sev === 'critical' ? 'bg-red-500' : sev === 'high' ? 'bg-orange-500' : sev === 'moderate' ? 'bg-amber-500' : 'bg-slate-400'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground">{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="bg-card rounded-2xl border border-border p-5">
        <h3 className="font-bold text-foreground mb-4">
          {tr('حسب الفئة', 'By Category')}
        </h3>
        <div className="space-y-3">
          {Object.entries(gs.byCategory || {}).map(([cat, count]) => {
            const cfg = CATEGORY_CONFIG[cat] || { labelAr: cat, labelEn: cat };
            return (
              <div key={cat} className="flex items-center justify-between">
                <span className="text-sm text-foreground">
                  {language === 'ar' ? cfg.labelAr : cfg.labelEn}
                </span>
                <div className="flex items-center gap-2">
                  <div className="w-24 bg-muted rounded-full h-2">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{ width: `${Math.min(100, ((count as number) / Math.max(gs.totalOpen, 1)) * 100)}%` }}
                    />
                  </div>
                  <span className="text-sm font-bold text-foreground w-8 text-end">{count as number}</span>
                </div>
              </div>
            );
          })}
          {Object.keys(gs.byCategory || {}).length === 0 && (
            <p className="text-sm text-muted-foreground">{tr('لا توجد بيانات', 'No data')}</p>
          )}
        </div>
      </div>

      {/* Trend */}
      {gs.trend && gs.trend.length > 0 && (
        <div className="bg-card rounded-2xl border border-border p-5">
          <h3 className="font-bold text-foreground mb-4">
            {tr('الاتجاه (6 أشهر)', 'Trend (6 months)')}
          </h3>
          <div className="flex items-end gap-2 h-32">
            {gs.trend.map((t: any) => {
              const maxCount = Math.max(...gs.trend.map((x: any) => x.count), 1);
              const height = Math.max(4, (t.count / maxCount) * 100);
              return (
                <div key={t.period} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs font-bold text-foreground">{t.count}</span>
                  <div className="w-full rounded-t-lg bg-primary/80" style={{ height: `${height}%` }} />
                  <span className="text-[10px] text-muted-foreground">{t.period.slice(5)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 2: Patient Gaps
// ---------------------------------------------------------------------------

function GapsTab({ tr, language, toast }: { tr: (ar: string, en: string) => string; language: string; toast: any }) {
  const [statusFilter, setStatusFilter] = useState('open');
  const [severityFilter, setSeverityFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [page, setPage] = useState(1);
  const [dismissReason, setDismissReason] = useState('');
  const [showDismissId, setShowDismissId] = useState<string | null>(null);

  const params = new URLSearchParams({
    page: String(page),
    limit: '20',
    ...(statusFilter && { status: statusFilter }),
    ...(severityFilter && { severity: severityFilter }),
    ...(categoryFilter && { category: categoryFilter }),
  });

  const { data, mutate } = useSWR(`/api/care-gaps/findings?${params}`, fetcher);
  const findings = data?.items || [];
  const totalPages = data?.totalPages || 1;

  const handleAction = useCallback(async (id: string, action: 'address' | 'dismiss', reason?: string) => {
    try {
      const res = await fetch(`/api/care-gaps/findings/${id}`, {
        credentials: 'include',
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...(reason && { dismissedReason: reason }) }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || err.message);
      }
      toast({ title: tr('تم التحديث', 'Updated') });
      mutate();
      setShowDismissId(null);
      setDismissReason('');
    } catch (err: any) {
      toast({ title: tr('فشل', 'Failed'), description: err.message, variant: 'destructive' as const });
    }
  }, [mutate, toast, tr]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {['open', 'addressed', 'dismissed'].map((s) => (
          <button
            key={s}
            onClick={() => { setStatusFilter(statusFilter === s ? '' : s); setPage(1); }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
              statusFilter === s ? 'bg-primary text-white border-primary' : 'bg-card border-border text-muted-foreground hover:bg-muted'
            }`}
          >
            {s === 'open' ? tr('مفتوح', 'Open') : s === 'addressed' ? tr('تمت معالجته', 'Addressed') : tr('مرفوض', 'Dismissed')}
          </button>
        ))}
        <div className="w-px h-6 bg-border self-center" />
        {Object.entries(SEVERITY_CONFIG).map(([key, cfg]) => (
          <button
            key={key}
            onClick={() => { setSeverityFilter(severityFilter === key ? '' : key); setPage(1); }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
              severityFilter === key ? 'bg-primary text-white border-primary' : `${cfg.color} border-border`
            }`}
          >
            {language === 'ar' ? cfg.labelAr : cfg.labelEn}
          </button>
        ))}
        <div className="w-px h-6 bg-border self-center" />
        <select
          value={categoryFilter}
          onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
          className="px-3 py-1.5 rounded-xl text-xs bg-card border border-border text-foreground"
        >
          <option value="">{tr('كل الفئات', 'All Categories')}</option>
          {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
            <option key={key} value={key}>{language === 'ar' ? cfg.labelAr : cfg.labelEn}</option>
          ))}
        </select>
      </div>

      {/* Findings list */}
      <div className="space-y-3">
        {findings.map((f: any) => {
          const sevCfg = SEVERITY_CONFIG[f.severity] || SEVERITY_CONFIG.moderate;
          const catCfg = CATEGORY_CONFIG[f.category] || { labelAr: f.category, labelEn: f.category };

          return (
            <div key={f.id} className="bg-card rounded-2xl border border-border p-4 transition-shadow hover:shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  {/* Badges */}
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${sevCfg.color}`}>
                      {language === 'ar' ? sevCfg.labelAr : sevCfg.labelEn}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200">
                      {language === 'ar' ? catCfg.labelAr : catCfg.labelEn}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      f.status === 'open' ? 'bg-red-50 text-red-700 dark:bg-red-900/50 dark:text-red-200'
                      : f.status === 'addressed' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                    }`}>
                      {f.status === 'open' ? tr('مفتوح', 'Open') : f.status === 'addressed' ? tr('تمت المعالجة', 'Addressed') : tr('مرفوض', 'Dismissed')}
                    </span>
                  </div>

                  {/* Patient & description */}
                  <p className="font-medium text-foreground">{f.patientName || tr('مريض', 'Patient')}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {language === 'ar' ? (f.descriptionAr || f.description) : f.description}
                  </p>

                  {/* Dates */}
                  <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                    <span>{tr('اكتُشف:', 'Detected:')} {new Date(f.identifiedAt).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-GB', { month: 'short', day: 'numeric' })}</span>
                    {f.dueDate && (
                      <span>{tr('الاستحقاق:', 'Due:')} {new Date(f.dueDate).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-GB', { month: 'short', day: 'numeric' })}</span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                {f.status === 'open' && (
                  <div className="flex flex-col gap-1.5 shrink-0">
                    <button
                      onClick={() => handleAction(f.id, 'address')}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900 transition-colors"
                    >
                      {tr('معالجة', 'Address')}
                    </button>
                    <button
                      onClick={() => setShowDismissId(f.id)}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    >
                      {tr('رفض', 'Dismiss')}
                    </button>
                  </div>
                )}
              </div>

              {/* Dismiss dialog (inline) */}
              {showDismissId === f.id && (
                <div className="mt-3 pt-3 border-t border-border flex items-center gap-2">
                  <input
                    value={dismissReason}
                    onChange={(e) => setDismissReason(e.target.value)}
                    placeholder={tr('سبب الرفض...', 'Dismiss reason...')}
                    className="flex-1 rounded-xl border border-border bg-card px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground"
                  />
                  <button
                    onClick={() => handleAction(f.id, 'dismiss', dismissReason)}
                    disabled={!dismissReason.trim()}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-primary text-white disabled:opacity-50 transition-colors"
                  >
                    {tr('تأكيد', 'Confirm')}
                  </button>
                  <button
                    onClick={() => { setShowDismissId(null); setDismissReason(''); }}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-muted text-muted-foreground transition-colors"
                  >
                    {tr('إلغاء', 'Cancel')}
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {findings.length === 0 && (
          <div className="bg-card rounded-2xl border border-border py-16 text-center">
            <p className="font-bold text-foreground">{tr('لا توجد فجوات', 'No care gaps found')}</p>
            <p className="text-sm text-muted-foreground mt-1">{tr('جرب تغيير الفلاتر أو تشغيل المسح', 'Try changing filters or running a scan')}</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-3 py-1.5 rounded-xl text-sm bg-card border border-border text-muted-foreground hover:bg-muted disabled:opacity-30 transition-colors"
          >
            {language === 'ar' ? '\u25B6' : '\u25C0'}
          </button>
          <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-3 py-1.5 rounded-xl text-sm bg-card border border-border text-muted-foreground hover:bg-muted disabled:opacity-30 transition-colors"
          >
            {language === 'ar' ? '\u25C0' : '\u25B6'}
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 3: Scan
// ---------------------------------------------------------------------------

function ScanTab({ tr, language, toast }: { tr: (ar: string, en: string) => string; language: string; toast: any }) {
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);
  const [patientId, setPatientId] = useState('');

  const handleScan = useCallback(async () => {
    setScanning(true);
    setScanResult(null);
    try {
      const body: any = {};
      if (patientId.trim()) body.patientId = patientId.trim();

      const res = await fetch('/api/care-gaps/scan', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || err.message);
      }

      const data = await res.json();
      setScanResult(data);
      toast({ title: tr('اكتمل المسح', 'Scan Complete') });
    } catch (err: any) {
      toast({ title: tr('فشل المسح', 'Scan Failed'), description: err.message, variant: 'destructive' as const });
    } finally {
      setScanning(false);
    }
  }, [patientId, toast, tr]);

  return (
    <div className="space-y-6">
      {/* Scan controls */}
      <div className="bg-card rounded-2xl border border-border p-6">
        <h3 className="font-bold text-foreground mb-4">
          {tr('تشغيل ماسح فجوات الرعاية', 'Run Care Gap Scanner')}
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          {tr(
            'يقوم الماسح بتحليل جميع المرضى النشطين وفقاً للقواعد المعرفة لاكتشاف فجوات الرعاية الوقائية والفحوصات والأدوية والمتابعات.',
            'The scanner analyzes all active patients against defined rules to detect preventive care, screening, medication, and follow-up gaps.'
          )}
        </p>

        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-foreground mb-1.5">
              {tr('معرف المريض (اختياري)', 'Patient ID (Optional)')}
            </label>
            <input
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              placeholder={tr('UUID للمريض — اتركه فارغاً لمسح الكل', 'Patient UUID — leave empty for bulk scan')}
              className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <button
            onClick={handleScan}
            disabled={scanning}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-primary text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {scanning ? tr('جاري المسح...', 'Scanning...') : tr('تشغيل المسح', 'Run Scan')}
          </button>
        </div>
      </div>

      {/* Scan results */}
      {scanResult && (
        <div className="bg-card rounded-2xl border border-border p-6">
          <h3 className="font-bold text-foreground mb-4">
            {tr('نتائج المسح', 'Scan Results')}
          </h3>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <KpiCard
              label={tr('المرضى الممسوحين', 'Patients Scanned')}
              value={scanResult.totalPatients || 0}
            />
            <KpiCard
              label={tr('فجوات مكتشفة', 'Gaps Found')}
              value={scanResult.gapsFound || 0}
              color="text-amber-600"
            />
            <KpiCard
              label={tr('فجوات جديدة', 'New Gaps Created')}
              value={scanResult.gapsCreated || 0}
              color="text-red-600"
            />
            <KpiCard
              label={tr('تم تخطيها (موجودة)', 'Skipped (Existing)')}
              value={scanResult.gapsSkipped || 0}
              color="text-slate-500"
            />
          </div>

          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>{tr('القواعد المُقيّمة:', 'Rules Evaluated:')} {scanResult.rulesEvaluated || 0}</span>
            <span>{tr('المدة:', 'Duration:')} {scanResult.durationMs || 0}ms</span>
            <span>{tr('النوع:', 'Mode:')} {scanResult.mode === 'single' ? tr('مريض واحد', 'Single patient') : tr('مسح شامل', 'Bulk scan')}</span>
          </div>

          {scanResult.errors && scanResult.errors.length > 0 && (
            <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/30 rounded-xl">
              <p className="text-xs font-medium text-red-700 dark:text-red-300">
                {tr('أخطاء:', 'Errors:')}
              </p>
              {scanResult.errors.slice(0, 5).map((e: string, i: number) => (
                <p key={i} className="text-xs text-red-600 dark:text-red-400">{e}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 4: Rules
// ---------------------------------------------------------------------------

function RulesTab({ tr, language, toast }: { tr: (ar: string, en: string) => string; language: string; toast: any }) {
  const { data, mutate } = useSWR('/api/care-gaps/rules', fetcher);
  const rules = data?.rules || [];

  const [showCreate, setShowCreate] = useState(false);
  const [newRule, setNewRule] = useState({
    name: '', nameAr: '', description: '', descriptionAr: '',
    category: 'preventive', gapType: 'screening_overdue', severity: 'moderate', frequency: 'monthly',
    criteria: '{}',
  });

  const handleToggle = useCallback(async (ruleId: string, isActive: boolean) => {
    try {
      const res = await fetch('/api/care-gaps/rules', {
        credentials: 'include',
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ruleId, isActive }),
      });
      if (!res.ok) throw new Error('Failed');
      toast({ title: tr('تم التحديث', 'Updated') });
      mutate();
    } catch {
      toast({ title: tr('فشل', 'Failed'), variant: 'destructive' as const });
    }
  }, [mutate, toast, tr]);

  const handleCreate = useCallback(async () => {
    try {
      let criteria: Record<string, any> = {};
      try { criteria = JSON.parse(newRule.criteria); } catch { criteria = {}; }

      const res = await fetch('/api/care-gaps/rules', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newRule, criteria }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed');
      }
      toast({ title: tr('تم إنشاء القاعدة', 'Rule Created') });
      setShowCreate(false);
      setNewRule({ name: '', nameAr: '', description: '', descriptionAr: '', category: 'preventive', gapType: 'screening_overdue', severity: 'moderate', frequency: 'monthly', criteria: '{}' });
      mutate();
    } catch (err: any) {
      toast({ title: tr('فشل', 'Failed'), description: err.message, variant: 'destructive' as const });
    }
  }, [newRule, mutate, toast, tr]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {tr(`${rules.length} قاعدة (${data?.builtInCount || 0} مدمجة + ${data?.customCount || 0} مخصصة)`,
            `${rules.length} rules (${data?.builtInCount || 0} built-in + ${data?.customCount || 0} custom)`)}
        </p>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="px-4 py-2 rounded-xl text-sm font-semibold bg-primary text-white hover:bg-primary/90 transition-colors"
        >
          {showCreate ? tr('إلغاء', 'Cancel') : tr('إنشاء قاعدة', 'Create Rule')}
        </button>
      </div>

      {/* Create rule form */}
      {showCreate && (
        <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
          <h3 className="font-bold text-foreground">{tr('قاعدة جديدة', 'New Rule')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">{tr('الاسم (EN)', 'Name (EN)')}</label>
              <input value={newRule.name} onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground" />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">{tr('الاسم (AR)', 'Name (AR)')}</label>
              <input value={newRule.nameAr} onChange={(e) => setNewRule({ ...newRule, nameAr: e.target.value })}
                className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground" dir="rtl" />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">{tr('الوصف (EN)', 'Description (EN)')}</label>
              <input value={newRule.description} onChange={(e) => setNewRule({ ...newRule, description: e.target.value })}
                className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground" />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">{tr('الوصف (AR)', 'Description (AR)')}</label>
              <input value={newRule.descriptionAr} onChange={(e) => setNewRule({ ...newRule, descriptionAr: e.target.value })}
                className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground" dir="rtl" />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">{tr('الفئة', 'Category')}</label>
              <select value={newRule.category} onChange={(e) => setNewRule({ ...newRule, category: e.target.value })}
                className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground">
                {Object.entries(CATEGORY_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{language === 'ar' ? v.labelAr : v.labelEn}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">{tr('نوع الفجوة', 'Gap Type')}</label>
              <select value={newRule.gapType} onChange={(e) => setNewRule({ ...newRule, gapType: e.target.value })}
                className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground">
                <option value="screening_overdue">{tr('فحص متأخر', 'Screening Overdue')}</option>
                <option value="vaccination_due">{tr('تطعيم مستحق', 'Vaccination Due')}</option>
                <option value="follow_up_missed">{tr('متابعة فائتة', 'Follow-up Missed')}</option>
                <option value="lab_overdue">{tr('تحليل متأخر', 'Lab Overdue')}</option>
                <option value="medication_refill">{tr('إعادة صرف', 'Medication Refill')}</option>
                <option value="referral_pending">{tr('تحويل معلق', 'Referral Pending')}</option>
                <option value="preventive_care">{tr('رعاية وقائية', 'Preventive Care')}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">{tr('الشدة', 'Severity')}</label>
              <select value={newRule.severity} onChange={(e) => setNewRule({ ...newRule, severity: e.target.value })}
                className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground">
                {Object.entries(SEVERITY_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{language === 'ar' ? v.labelAr : v.labelEn}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">{tr('التكرار', 'Frequency')}</label>
              <select value={newRule.frequency} onChange={(e) => setNewRule({ ...newRule, frequency: e.target.value })}
                className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground">
                <option value="daily">{tr('يومي', 'Daily')}</option>
                <option value="weekly">{tr('أسبوعي', 'Weekly')}</option>
                <option value="monthly">{tr('شهري', 'Monthly')}</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1">{tr('المعايير (JSON)', 'Criteria (JSON)')}</label>
            <textarea
              value={newRule.criteria}
              onChange={(e) => setNewRule({ ...newRule, criteria: e.target.value })}
              rows={3}
              className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground font-mono"
              placeholder='{"diagnosisPrefix": "E11", "labCode": "HBA1C", "intervalMonths": 3}'
            />
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleCreate}
              disabled={!newRule.name || !newRule.description}
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-primary text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {tr('حفظ القاعدة', 'Save Rule')}
            </button>
          </div>
        </div>
      )}

      {/* Rules list */}
      <div className="space-y-2">
        {rules.map((rule: any) => {
          const sevCfg = SEVERITY_CONFIG[rule.severity] || SEVERITY_CONFIG.moderate;
          return (
            <div key={rule.id} className="bg-card rounded-2xl border border-border p-4 flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-foreground text-sm">
                    {language === 'ar' ? (rule.nameAr || rule.name) : rule.name}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${sevCfg.color}`}>
                    {language === 'ar' ? sevCfg.labelAr : sevCfg.labelEn}
                  </span>
                  {rule.isBuiltIn && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200">
                      {tr('مدمج', 'Built-in')}
                    </span>
                  )}
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground">
                    {rule.frequency}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {language === 'ar' ? (rule.descriptionAr || rule.description) : rule.description}
                </p>
              </div>

              {/* Toggle for custom rules only */}
              {!rule.isBuiltIn && (
                <button
                  onClick={() => handleToggle(rule.id, !rule.isActive)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                    rule.isActive
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
                      : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                  }`}
                >
                  {rule.isActive ? tr('نشط', 'Active') : tr('معطل', 'Disabled')}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 5: Readmissions
// ---------------------------------------------------------------------------

function ReadmissionsTab({ tr, language, toast }: { tr: (ar: string, en: string) => string; language: string; toast: any }) {
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [reviewForm, setReviewForm] = useState({
    isPreventable: 'unknown' as string,
    rootCause: '',
    reviewNotes: '',
    actionPlan: '',
  });

  const { data: stats } = useSWR('/api/quality/readmissions/stats', fetcher);
  const rs = stats || { thirtyDayRate: 0, totalReadmissions: 0, pendingReview: 0, preventablePercent: 0, bySeverity: {}, byRootCause: [] };

  const params = new URLSearchParams({
    page: String(page), limit: '20',
    ...(statusFilter && { reviewStatus: statusFilter }),
  });
  const { data: listData, mutate } = useSWR(`/api/quality/readmissions?${params}`, fetcher);
  const readmissions = listData?.items || [];
  const totalPages = listData?.totalPages || 1;

  const handleReview = useCallback(async () => {
    if (!reviewId) return;
    try {
      const res = await fetch(`/api/quality/readmissions/${reviewId}/review`, {
        credentials: 'include',
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reviewForm),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed');
      }
      toast({ title: tr('تم حفظ المراجعة', 'Review Saved') });
      setReviewId(null);
      setReviewForm({ isPreventable: 'unknown', rootCause: '', reviewNotes: '', actionPlan: '' });
      mutate();
    } catch (err: any) {
      toast({ title: tr('فشل', 'Failed'), description: err.message, variant: 'destructive' as const });
    }
  }, [reviewId, reviewForm, mutate, toast, tr]);

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        <KpiCard
          label={tr('معدل إعادة الدخول 30 يوم', '30-Day Rate')}
          value={`${rs.thirtyDayRate}%`}
          color={rs.thirtyDayRate > 10 ? 'text-red-600' : rs.thirtyDayRate > 5 ? 'text-amber-600' : 'text-emerald-600'}
        />
        <KpiCard
          label={tr('إجمالي إعادة الدخول', 'Total Readmissions')}
          value={rs.totalReadmissions}
        />
        <KpiCard
          label={tr('بانتظار المراجعة', 'Pending Review')}
          value={rs.pendingReview}
          color="text-amber-600"
        />
        <KpiCard
          label={tr('نسبة القابلة للمنع', 'Preventable %')}
          value={`${rs.preventablePercent}%`}
          color={rs.preventablePercent > 30 ? 'text-red-600' : 'text-foreground'}
        />
        <KpiCard
          label={tr('تم اتخاذ إجراء', 'Action Taken')}
          value={rs.actionTakenCount || 0}
          color="text-emerald-600"
        />
      </div>

      {/* Root Cause Breakdown */}
      {rs.byRootCause && rs.byRootCause.length > 0 && (
        <div className="bg-card rounded-2xl border border-border p-5">
          <h3 className="font-bold text-foreground mb-3">{tr('حسب السبب الجذري', 'By Root Cause')}</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {rs.byRootCause.map((rc: any) => {
              const cfg = ROOT_CAUSE_CONFIG[rc.cause] || { labelAr: rc.cause, labelEn: rc.cause };
              return (
                <div key={rc.cause} className="flex items-center justify-between bg-muted/50 rounded-xl px-3 py-2">
                  <span className="text-xs text-foreground">{language === 'ar' ? cfg.labelAr : cfg.labelEn}</span>
                  <span className="text-sm font-bold text-foreground">{rc.count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2">
        {['', 'pending', 'reviewed', 'action_taken'].map((s) => (
          <button
            key={s || 'all'}
            onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
              statusFilter === s ? 'bg-primary text-white border-primary' : 'bg-card border-border text-muted-foreground hover:bg-muted'
            }`}
          >
            {s === '' ? tr('الكل', 'All')
              : s === 'pending' ? tr('بانتظار', 'Pending')
              : s === 'reviewed' ? tr('تمت المراجعة', 'Reviewed')
              : tr('تم الإجراء', 'Action Taken')}
          </button>
        ))}
      </div>

      {/* Readmission list */}
      <div className="space-y-3">
        {readmissions.map((r: any) => (
          <div key={r.id} className="bg-card rounded-2xl border border-border p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                {/* Badges */}
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    r.reviewStatus === 'pending' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200'
                    : r.reviewStatus === 'reviewed' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200'
                    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200'
                  }`}>
                    {r.reviewStatus === 'pending' ? tr('بانتظار المراجعة', 'Pending Review')
                      : r.reviewStatus === 'reviewed' ? tr('تمت المراجعة', 'Reviewed')
                      : tr('تم الإجراء', 'Action Taken')}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                    {r.daysBetween} {tr('يوم', 'days')}
                  </span>
                  {r.isPreventable === 'yes' && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200">
                      {tr('قابل للمنع', 'Preventable')}
                    </span>
                  )}
                  {r.rootCause && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-50 text-purple-700 dark:bg-purple-900/50 dark:text-purple-200">
                      {language === 'ar'
                        ? (ROOT_CAUSE_CONFIG[r.rootCause]?.labelAr || r.rootCause)
                        : (ROOT_CAUSE_CONFIG[r.rootCause]?.labelEn || r.rootCause)}
                    </span>
                  )}
                </div>

                {/* Patient */}
                <p className="font-medium text-foreground">{r.patientName || tr('مريض', 'Patient')}</p>

                {/* Details */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                  <span>{tr('التشخيص الأصلي:', 'Original Dx:')} {r.originalDiagnosis || '-'}</span>
                  <span>{tr('تشخيص إعادة الدخول:', 'Readmit Dx:')} {r.readmitDiagnosis || '-'}</span>
                  <span>{tr('القسم الأصلي:', 'Original Dept:')} {r.originalDepartment || '-'}</span>
                  <span>{tr('قسم إعادة الدخول:', 'Readmit Dept:')} {r.readmitDepartment || '-'}</span>
                  <span>{tr('خروج:', 'Discharged:')} {new Date(r.originalDischargeDate).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-GB', { month: 'short', day: 'numeric' })}</span>
                  <span>{tr('إعادة دخول:', 'Readmitted:')} {new Date(r.readmitDate).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-GB', { month: 'short', day: 'numeric' })}</span>
                </div>

                {/* Review notes if exists */}
                {r.reviewNotes && (
                  <p className="mt-2 text-xs bg-muted/50 rounded-xl px-3 py-2 text-foreground">
                    {tr('ملاحظات:', 'Notes:')} {r.reviewNotes}
                  </p>
                )}
                {r.actionPlan && (
                  <p className="mt-1 text-xs bg-emerald-50 dark:bg-emerald-900/30 rounded-xl px-3 py-2 text-emerald-700 dark:text-emerald-300">
                    {tr('خطة العمل:', 'Action Plan:')} {r.actionPlan}
                  </p>
                )}
              </div>

              {/* Review button */}
              {r.reviewStatus === 'pending' && (
                <button
                  onClick={() => setReviewId(r.id)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 shrink-0 transition-colors"
                >
                  {tr('مراجعة', 'Review')}
                </button>
              )}
            </div>

            {/* Review form (inline) */}
            {reviewId === r.id && (
              <div className="mt-4 pt-4 border-t border-border space-y-3">
                <h4 className="font-semibold text-foreground text-sm">{tr('مراجعة إعادة الدخول', 'Readmission Review')}</h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">{tr('قابل للمنع؟', 'Preventable?')}</label>
                    <select
                      value={reviewForm.isPreventable}
                      onChange={(e) => setReviewForm({ ...reviewForm, isPreventable: e.target.value })}
                      className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground"
                    >
                      <option value="unknown">{tr('غير معروف', 'Unknown')}</option>
                      <option value="yes">{tr('نعم', 'Yes')}</option>
                      <option value="no">{tr('لا', 'No')}</option>
                      <option value="under_review">{tr('قيد المراجعة', 'Under Review')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">{tr('السبب الجذري', 'Root Cause')}</label>
                    <select
                      value={reviewForm.rootCause}
                      onChange={(e) => setReviewForm({ ...reviewForm, rootCause: e.target.value })}
                      className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground"
                    >
                      <option value="">{tr('اختر السبب', 'Select cause')}</option>
                      {Object.entries(ROOT_CAUSE_CONFIG).map(([k, v]) => (
                        <option key={k} value={k}>{language === 'ar' ? v.labelAr : v.labelEn}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">{tr('ملاحظات المراجعة', 'Review Notes')}</label>
                  <textarea
                    value={reviewForm.reviewNotes}
                    onChange={(e) => setReviewForm({ ...reviewForm, reviewNotes: e.target.value })}
                    rows={2}
                    className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground"
                    placeholder={tr('أدخل ملاحظاتك...', 'Enter your notes...')}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">{tr('خطة العمل', 'Action Plan')}</label>
                  <textarea
                    value={reviewForm.actionPlan}
                    onChange={(e) => setReviewForm({ ...reviewForm, actionPlan: e.target.value })}
                    rows={2}
                    className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground"
                    placeholder={tr('خطة العمل لمنع إعادة الدخول...', 'Action plan to prevent readmission...')}
                  />
                </div>

                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => { setReviewId(null); setReviewForm({ isPreventable: 'unknown', rootCause: '', reviewNotes: '', actionPlan: '' }); }}
                    className="px-4 py-2 rounded-xl text-sm font-semibold bg-muted text-muted-foreground transition-colors"
                  >
                    {tr('إلغاء', 'Cancel')}
                  </button>
                  <button
                    onClick={handleReview}
                    className="px-4 py-2 rounded-xl text-sm font-semibold bg-primary text-white hover:bg-primary/90 transition-colors"
                  >
                    {tr('حفظ المراجعة', 'Save Review')}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {readmissions.length === 0 && (
          <div className="bg-card rounded-2xl border border-border py-16 text-center">
            <p className="font-bold text-foreground">{tr('لا توجد حالات إعادة دخول', 'No readmissions found')}</p>
            <p className="text-sm text-muted-foreground mt-1">{tr('لم يتم اكتشاف إعادة دخول خلال 30 يوم', 'No 30-day readmissions detected')}</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-3 py-1.5 rounded-xl text-sm bg-card border border-border text-muted-foreground hover:bg-muted disabled:opacity-30 transition-colors"
          >
            {language === 'ar' ? '\u25B6' : '\u25C0'}
          </button>
          <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-3 py-1.5 rounded-xl text-sm bg-card border border-border text-muted-foreground hover:bg-muted disabled:opacity-30 transition-colors"
          >
            {language === 'ar' ? '\u25C0' : '\u25B6'}
          </button>
        </div>
      )}
    </div>
  );
}
