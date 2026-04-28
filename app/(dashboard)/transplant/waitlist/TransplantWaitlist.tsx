'use client';

import { useState, useMemo } from 'react';
import useSWR, { mutate as globalMutate } from 'swr';
import {
  Heart,
  Clock,
  AlertTriangle,
  Activity,
  Users,
  ClipboardCheck,
  Plus,
  Search,
  RefreshCw,
  X,
  ChevronRight,
  ArrowUpDown,
  Filter,
  BarChart3,
  History,
  ListOrdered,
  Layers,
  Stethoscope,
  CalendarDays,
  FileText,
  TrendingUp,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Eye,
  Edit,
  Printer,
} from 'lucide-react';
import { useLang } from '@/hooks/use-lang';

// ─── SWR Fetcher ────────────────────────────────────────────────────────────

const fetcher = (url: string) =>
  fetch(url, { credentials: 'include' }).then((r) => r.json());

// ─── Types ──────────────────────────────────────────────────────────────────

interface HLATyping {
  classI: { a1: string; a2: string; b1: string; b2: string; c1: string; c2: string };
  classII: { dr1: string; dr2: string; dq1: string; dq2: string };
}

interface CrossmatchEntry {
  date: string;
  donorId: string;
  result: 'POSITIVE' | 'NEGATIVE' | 'INCONCLUSIVE';
  notes?: string;
}

interface StatusHistoryEntry {
  date: string;
  from: string;
  to: string;
  reason: string;
  by: string;
}

interface WaitlistEntry {
  id: string;
  tenantId: string;
  patientMasterId: string;
  caseId: string | null;
  organType: string;
  bloodType: string;
  urgencyStatus: string;
  medicalStatus: string;
  listingDate: string;
  evaluationComplete: boolean;
  primaryDiagnosis: string;
  icdCode: string | null;
  meldScore: number | null;
  childPughScore: string | null;
  pra: number | null;
  hlaTyping: HLATyping | null;
  crossmatchHistory: CrossmatchEntry[];
  dialysisStartDate: string | null;
  dialysisType: string | null;
  previousTransplants: number;
  waitingDays: number;
  priorityScore: number | null;
  region: string | null;
  transplantCenter: string | null;
  statusHistory: StatusHistoryEntry[];
  notes: string | null;
  lastReviewDate: string | null;
  nextReviewDate: string | null;
  removedReason: string | null;
  removedDate: string | null;
  createdAt: string;
  updatedAt: string;
}

interface WaitlistStats {
  totalActive: number;
  avgWaitTime: number;
  byOrgan: Record<string, number>;
  urgencyBreakdown: Record<string, number>;
  longestWait: number;
  pendingEval: number;
  transplantedThisYear: number;
  bloodTypeDistribution: Record<string, number>;
  outcomes: Record<string, number>;
  recentChanges: Array<{
    entryId: string;
    patientMasterId: string;
    organType: string;
    date: string;
    from: string;
    to: string;
    reason: string;
    by: string;
  }>;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const ORGAN_LABELS: Record<string, { ar: string; en: string }> = {
  KIDNEY: { ar: 'كلية', en: 'Kidney' },
  LIVER: { ar: 'كبد', en: 'Liver' },
  HEART: { ar: 'قلب', en: 'Heart' },
  LUNG: { ar: 'رئة', en: 'Lung' },
  PANCREAS: { ar: 'بنكرياس', en: 'Pancreas' },
  BONE_MARROW: { ar: 'نخاع عظمي', en: 'Bone Marrow' },
  CORNEA: { ar: 'قرنية', en: 'Cornea' },
};

const ORGAN_TYPE_VALUES = Object.keys(ORGAN_LABELS);

const BLOOD_TYPE_VALUES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const URGENCY_CONFIG: Record<string, { ar: string; en: string; color: string; bg: string; pulse?: boolean }> = {
  EMERGENT: { ar: 'طارئ', en: 'Emergent', color: 'text-red-700', bg: 'bg-red-50 border-red-300', pulse: true },
  URGENT: { ar: 'عاجل', en: 'Urgent', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-300' },
  ROUTINE: { ar: 'روتيني', en: 'Routine', color: 'text-muted-foreground', bg: 'bg-muted/50 border-border' },
};

const STATUS_CONFIG: Record<string, { ar: string; en: string; color: string; bg: string }> = {
  ACTIVE: { ar: 'نشط', en: 'Active', color: 'text-green-700', bg: 'bg-green-50 border-green-300' },
  TEMPORARILY_INACTIVE: { ar: 'غير نشط مؤقتاً', en: 'Temp. Inactive', color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-300' },
  PERMANENTLY_INACTIVE: { ar: 'غير نشط دائماً', en: 'Perm. Inactive', color: 'text-muted-foreground', bg: 'bg-muted border-border' },
  TRANSPLANTED: { ar: 'تم الزراعة', en: 'Transplanted', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-300' },
  DECEASED: { ar: 'متوفى', en: 'Deceased', color: 'text-slate-700', bg: 'bg-slate-100 border-slate-300' },
  REMOVED: { ar: 'تمت الإزالة', en: 'Removed', color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
};

const DIALYSIS_LABELS: Record<string, { ar: string; en: string }> = {
  HD: { ar: 'غسيل دموي', en: 'Hemodialysis' },
  PD: { ar: 'غسيل بريتوني', en: 'Peritoneal Dialysis' },
  NONE: { ar: 'لا يوجد', en: 'None' },
};

const CHILD_PUGH_LABELS: Record<string, { ar: string; en: string }> = {
  A: { ar: 'الفئة أ (خفيف)', en: 'Class A (Mild)' },
  B: { ar: 'الفئة ب (متوسط)', en: 'Class B (Moderate)' },
  C: { ar: 'الفئة ج (شديد)', en: 'Class C (Severe)' },
};

const CROSSMATCH_RESULT_LABELS: Record<string, { ar: string; en: string; color: string }> = {
  POSITIVE: { ar: 'إيجابي', en: 'Positive', color: 'text-red-600' },
  NEGATIVE: { ar: 'سلبي', en: 'Negative', color: 'text-green-600' },
  INCONCLUSIVE: { ar: 'غير حاسم', en: 'Inconclusive', color: 'text-yellow-600' },
};

// ─── Helper: format date ────────────────────────────────────────────────────

function fmtDate(d: string | null): string {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function fmtWait(days: number, lang: string): string {
  if (days < 30) return lang === 'ar' ? `${days} يوم` : `${days}d`;
  const months = Math.floor(days / 30);
  if (months < 12) return lang === 'ar' ? `${months} شهر` : `${months}mo`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (rem === 0) return lang === 'ar' ? `${years} سنة` : `${years}y`;
  return lang === 'ar' ? `${years} سنة و ${rem} شهر` : `${years}y ${rem}m`;
}

// ─── Priority bar color ─────────────────────────────────────────────────────

function priorityColor(score: number | null): string {
  if (score == null) return 'bg-muted';
  if (score >= 100) return 'bg-red-500';
  if (score >= 70) return 'bg-orange-500';
  if (score >= 40) return 'bg-yellow-500';
  return 'bg-green-500';
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── Main Component ─────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

export function TransplantWaitlist() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  // ── State ───────────────────────────────────────────────────────────────
  const [tab, setTab] = useState<'waitlist' | 'byOrgan' | 'stats' | 'history'>('waitlist');
  const [filterOrgan, setFilterOrgan] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterUrgency, setFilterUrgency] = useState('');
  const [filterBlood, setFilterBlood] = useState('');
  const [searchText, setSearchText] = useState('');
  const [sortBy, setSortBy] = useState<'priority' | 'wait' | 'meld'>('priority');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState<WaitlistEntry | null>(null);
  const [showEditDialog, setShowEditDialog] = useState<WaitlistEntry | null>(null);
  const [showStatusDialog, setShowStatusDialog] = useState<WaitlistEntry | null>(null);

  // ── Data fetching ───────────────────────────────────────────────────────
  const params = new URLSearchParams();
  if (filterOrgan) params.set('organType', filterOrgan);
  if (filterStatus) params.set('medicalStatus', filterStatus);
  if (filterUrgency) params.set('urgencyStatus', filterUrgency);
  if (filterBlood) params.set('bloodType', filterBlood);
  if (searchText) params.set('search', searchText);

  const apiUrl = `/api/transplant/waitlist?${params.toString()}`;
  const { data, error, isLoading } = useSWR(apiUrl, fetcher, { refreshInterval: 30000 });

  const entries: WaitlistEntry[] = data?.entries ?? [];
  const stats: WaitlistStats = data?.stats ?? {
    totalActive: 0,
    avgWaitTime: 0,
    byOrgan: {},
    urgencyBreakdown: { EMERGENT: 0, URGENT: 0, ROUTINE: 0 },
    longestWait: 0,
    pendingEval: 0,
    transplantedThisYear: 0,
    bloodTypeDistribution: {},
    outcomes: {},
    recentChanges: [],
  };

  // Sort entries client-side
  const sorted = useMemo(() => {
    const arr = [...entries];
    if (sortBy === 'priority') arr.sort((a, b) => (b.priorityScore ?? 0) - (a.priorityScore ?? 0));
    if (sortBy === 'wait') arr.sort((a, b) => b.waitingDays - a.waitingDays);
    if (sortBy === 'meld') arr.sort((a, b) => (b.meldScore ?? 0) - (a.meldScore ?? 0));
    return arr;
  }, [entries, sortBy]);

  const refreshData = () => globalMutate(apiUrl);

  // ── Tabs config ─────────────────────────────────────────────────────────
  const tabs = [
    { key: 'waitlist' as const, label: tr('قائمة الانتظار', 'Active Waitlist'), icon: ListOrdered },
    { key: 'byOrgan' as const, label: tr('حسب العضو', 'By Organ'), icon: Layers },
    { key: 'stats' as const, label: tr('الإحصائيات', 'Statistics'), icon: BarChart3 },
    { key: 'history' as const, label: tr('سجل التغييرات', 'Status History'), icon: History },
  ];

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {tr('إدارة قائمة انتظار زراعة الأعضاء', 'Transplant Waitlist Management')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {tr('تتبع وإدارة المرضى المنتظرين لزراعة الأعضاء', 'Track and manage patients awaiting organ transplantation')}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={refreshData}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-border rounded-lg hover:bg-muted/50"
          >
            <RefreshCw className="w-4 h-4" />
            {tr('تحديث', 'Refresh')}
          </button>
          <button
            onClick={() => setShowCreateDialog(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            {tr('إضافة مريض', 'Add Patient')}
          </button>
        </div>
      </div>

      {/* ── KPI Cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard
          icon={Users}
          label={tr('نشط في الانتظار', 'Active on Waitlist')}
          value={stats.totalActive}
          color="blue"
        />
        <KpiCard
          icon={Clock}
          label={tr('متوسط الانتظار', 'Avg Wait Time')}
          value={fmtWait(stats.avgWaitTime, language)}
          color="amber"
        />
        <KpiCard
          icon={AlertTriangle}
          label={tr('حالات طارئة', 'Emergent Cases')}
          value={stats.urgencyBreakdown.EMERGENT ?? 0}
          color="red"
        />
        <KpiCard
          icon={CheckCircle2}
          label={tr('زُرعت هذا العام', 'Transplanted This Year')}
          value={stats.transplantedThisYear}
          color="green"
        />
        <KpiCard
          icon={TrendingUp}
          label={tr('أطول انتظار', 'Longest Wait')}
          value={fmtWait(stats.longestWait, language)}
          color="purple"
        />
        <KpiCard
          icon={ClipboardCheck}
          label={tr('تقييمات معلقة', 'Pending Evaluations')}
          value={stats.pendingEval}
          color="orange"
        />
      </div>

      {/* ── Filter Bar ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 p-3 bg-card border rounded-lg">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Filter className="w-4 h-4" />
          {tr('تصفية:', 'Filter:')}
        </div>
        <select
          value={filterOrgan}
          onChange={(e) => setFilterOrgan(e.target.value)}
          className="text-sm border border-border rounded-md px-2 py-1.5"
        >
          <option value="">{tr('جميع الأعضاء', 'All Organs')}</option>
          {ORGAN_TYPE_VALUES.map((o) => (
            <option key={o} value={o}>{tr(ORGAN_LABELS[o].ar, ORGAN_LABELS[o].en)}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="text-sm border border-border rounded-md px-2 py-1.5"
        >
          <option value="">{tr('جميع الحالات', 'All Statuses')}</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{tr(v.ar, v.en)}</option>
          ))}
        </select>
        <select
          value={filterUrgency}
          onChange={(e) => setFilterUrgency(e.target.value)}
          className="text-sm border border-border rounded-md px-2 py-1.5"
        >
          <option value="">{tr('جميع الأولويات', 'All Urgencies')}</option>
          {Object.entries(URGENCY_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{tr(v.ar, v.en)}</option>
          ))}
        </select>
        <select
          value={filterBlood}
          onChange={(e) => setFilterBlood(e.target.value)}
          className="text-sm border border-border rounded-md px-2 py-1.5"
        >
          <option value="">{tr('جميع فصائل الدم', 'All Blood Types')}</option>
          {BLOOD_TYPE_VALUES.map((bt) => (
            <option key={bt} value={bt}>{bt}</option>
          ))}
        </select>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder={tr('بحث بالتشخيص أو الرمز أو المنطقة...', 'Search by diagnosis, code, region...')}
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-border rounded-md"
          />
        </div>
        {(filterOrgan || filterStatus || filterUrgency || filterBlood || searchText) && (
          <button
            onClick={() => { setFilterOrgan(''); setFilterStatus(''); setFilterUrgency(''); setFilterBlood(''); setSearchText(''); }}
            className="text-sm text-red-600 hover:text-red-800 flex items-center gap-1"
          >
            <X className="w-3.5 h-3.5" />
            {tr('مسح الكل', 'Clear All')}
          </button>
        )}
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      <div className="border-b border-border">
        <nav className="flex gap-1">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  active
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                }`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* ── Loading / Error ─────────────────────────────────────────────── */}
      {isLoading && (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <RefreshCw className="w-6 h-6 animate-spin mr-2" />
          {tr('جاري التحميل...', 'Loading...')}
        </div>
      )}
      {error && !isLoading && (
        <div className="text-center py-12 text-red-600">
          {tr('حدث خطأ في تحميل البيانات', 'Error loading data')}
        </div>
      )}

      {/* ── Tab Content ─────────────────────────────────────────────────── */}
      {!isLoading && !error && (
        <>
          {tab === 'waitlist' && (
            <ActiveWaitlistTab
              entries={sorted}
              sortBy={sortBy}
              onSortChange={setSortBy}
              onView={setShowViewDialog}
              onEdit={setShowEditDialog}
              onStatusChange={setShowStatusDialog}
              tr={tr}
              language={language}
            />
          )}
          {tab === 'byOrgan' && (
            <ByOrganTab entries={entries} stats={stats} tr={tr} language={language} />
          )}
          {tab === 'stats' && (
            <StatisticsTab stats={stats} tr={tr} language={language} />
          )}
          {tab === 'history' && (
            <StatusHistoryTab changes={stats.recentChanges} tr={tr} language={language} />
          )}
        </>
      )}

      {/* ── Dialogs ────────────────────────────────────────────────────── */}
      {showCreateDialog && (
        <CreateEditDialog
          entry={null}
          onClose={() => setShowCreateDialog(false)}
          onSaved={() => { setShowCreateDialog(false); refreshData(); }}
          tr={tr}
          language={language}
        />
      )}
      {showEditDialog && (
        <CreateEditDialog
          entry={showEditDialog}
          onClose={() => setShowEditDialog(null)}
          onSaved={() => { setShowEditDialog(null); refreshData(); }}
          tr={tr}
          language={language}
        />
      )}
      {showViewDialog && (
        <ViewDialog
          entry={showViewDialog}
          onClose={() => setShowViewDialog(null)}
          onEdit={(e) => { setShowViewDialog(null); setShowEditDialog(e); }}
          onStatusChange={(e) => { setShowViewDialog(null); setShowStatusDialog(e); }}
          tr={tr}
          language={language}
        />
      )}
      {showStatusDialog && (
        <StatusChangeDialog
          entry={showStatusDialog}
          onClose={() => setShowStatusDialog(null)}
          onSaved={() => { setShowStatusDialog(null); refreshData(); }}
          tr={tr}
          language={language}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── KPI Card ───────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

function KpiCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: any;
  label: string;
  value: number | string;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    amber: 'bg-amber-50 text-amber-600 border-amber-200',
    red: 'bg-red-50 text-red-600 border-red-200',
    green: 'bg-green-50 text-green-600 border-green-200',
    purple: 'bg-purple-50 text-purple-600 border-purple-200',
    orange: 'bg-orange-50 text-orange-600 border-orange-200',
  };
  return (
    <div className={`rounded-lg border p-4 ${colorMap[color] || colorMap.blue}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-5 h-5" />
        <span className="text-xs font-medium opacity-80">{label}</span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── Tab 1: Active Waitlist ─────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

function ActiveWaitlistTab({
  entries,
  sortBy,
  onSortChange,
  onView,
  onEdit,
  onStatusChange,
  tr,
  language,
}: {
  entries: WaitlistEntry[];
  sortBy: string;
  onSortChange: (s: 'priority' | 'wait' | 'meld') => void;
  onView: (e: WaitlistEntry) => void;
  onEdit: (e: WaitlistEntry) => void;
  onStatusChange: (e: WaitlistEntry) => void;
  tr: (ar: string, en: string) => string;
  language: string;
}) {
  if (entries.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p className="text-lg">{tr('لا توجد إدخالات في قائمة الانتظار', 'No waitlist entries found')}</p>
        <p className="text-sm mt-1">{tr('قم بإضافة مرضى جدد أو تغيير عوامل التصفية', 'Add new patients or adjust filters')}</p>
      </div>
    );
  }

  return (
    <div className="bg-card border rounded-lg overflow-hidden">
      {/* ── Sort bar ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-2 bg-muted/50 border-b text-sm">
        <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
        <span className="text-muted-foreground">{tr('ترتيب حسب:', 'Sort by:')}</span>
        {[
          { key: 'priority' as const, ar: 'الأولوية', en: 'Priority' },
          { key: 'wait' as const, ar: 'مدة الانتظار', en: 'Wait Time' },
          { key: 'meld' as const, ar: 'نقاط MELD', en: 'MELD Score' },
        ].map((s) => (
          <button
            key={s.key}
            onClick={() => onSortChange(s.key)}
            className={`px-2.5 py-1 rounded-md transition-colors ${
              sortBy === s.key
                ? 'bg-blue-100 text-blue-700 font-medium'
                : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            {tr(s.ar, s.en)}
          </button>
        ))}
        <span className="ml-auto text-muted-foreground">
          {entries.length} {tr('إدخال', 'entries')}
        </span>
      </div>

      {/* ── Table ────────────────────────────────────────────────────── */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-3 py-2.5 text-left font-medium">#</th>
              <th className="px-3 py-2.5 text-left font-medium">{tr('المريض', 'Patient')}</th>
              <th className="px-3 py-2.5 text-left font-medium">{tr('العضو', 'Organ')}</th>
              <th className="px-3 py-2.5 text-left font-medium">{tr('فصيلة الدم', 'Blood')}</th>
              <th className="px-3 py-2.5 text-left font-medium">{tr('الأولوية', 'Urgency')}</th>
              <th className="px-3 py-2.5 text-left font-medium">{tr('التشخيص', 'Diagnosis')}</th>
              <th className="px-3 py-2.5 text-left font-medium">{tr('نقاط الأولوية', 'Priority')}</th>
              <th className="px-3 py-2.5 text-left font-medium">{tr('أيام الانتظار', 'Wait Days')}</th>
              <th className="px-3 py-2.5 text-left font-medium">PRA%</th>
              <th className="px-3 py-2.5 text-left font-medium">{tr('الحالة', 'Status')}</th>
              <th className="px-3 py-2.5 text-left font-medium">{tr('إجراءات', 'Actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {entries.map((entry, i) => {
              const urgConf = URGENCY_CONFIG[entry.urgencyStatus] || URGENCY_CONFIG.ROUTINE;
              const statConf = STATUS_CONFIG[entry.medicalStatus] || STATUS_CONFIG.ACTIVE;
              const organLabel = ORGAN_LABELS[entry.organType];
              const maxPriority = 150;
              const pctPriority = Math.min(((entry.priorityScore ?? 0) / maxPriority) * 100, 100);
              return (
                <tr key={entry.id} className="hover:bg-muted/50 transition-colors">
                  <td className="px-3 py-2.5 text-muted-foreground font-mono text-xs">{i + 1}</td>
                  <td className="px-3 py-2.5">
                    <span className="font-medium text-foreground">{entry.patientMasterId.slice(0, 8)}...</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="inline-flex items-center gap-1 text-foreground">
                      {organLabel ? tr(organLabel.ar, organLabel.en) : entry.organType}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="inline-block px-2 py-0.5 text-xs font-bold bg-red-50 text-red-700 rounded">
                      {entry.bloodType}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded border ${urgConf.bg} ${urgConf.color}`}
                    >
                      {urgConf.pulse && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />}
                      {tr(urgConf.ar, urgConf.en)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 max-w-[180px] truncate text-foreground" title={entry.primaryDiagnosis}>
                    {entry.primaryDiagnosis}
                    {entry.icdCode && (
                      <span className="ml-1 text-xs text-muted-foreground">({entry.icdCode})</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${priorityColor(entry.priorityScore)}`}
                          style={{ width: `${pctPriority}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono text-muted-foreground">
                        {entry.priorityScore?.toFixed(0) ?? '-'}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs">
                    {entry.waitingDays}
                    <span className="text-muted-foreground ml-1">
                      ({fmtWait(entry.waitingDays, language)})
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-xs font-mono">
                    {entry.pra != null ? `${entry.pra}%` : '-'}
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`inline-block px-2 py-0.5 text-xs font-medium rounded border ${statConf.bg} ${statConf.color}`}
                    >
                      {tr(statConf.ar, statConf.en)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onView(entry)}
                        className="p-1 text-muted-foreground hover:text-blue-600 rounded"
                        title={tr('عرض', 'View')}
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onEdit(entry)}
                        className="p-1 text-muted-foreground hover:text-green-600 rounded"
                        title={tr('تعديل', 'Edit')}
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onStatusChange(entry)}
                        className="p-1 text-muted-foreground hover:text-orange-600 rounded"
                        title={tr('تغيير الحالة', 'Change Status')}
                      >
                        <Activity className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── Tab 2: By Organ ────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

function ByOrganTab({
  entries,
  stats,
  tr,
  language,
}: {
  entries: WaitlistEntry[];
  stats: WaitlistStats;
  tr: (ar: string, en: string) => string;
  language: string;
}) {
  const [selectedOrgan, setSelectedOrgan] = useState<string | null>(null);

  const organsWithEntries = ORGAN_TYPE_VALUES.filter(
    (o) => (stats.byOrgan[o] || 0) > 0 || entries.some((e) => e.organType === o),
  );

  // If no entries at all, show message
  if (entries.length === 0 && organsWithEntries.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Layers className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>{tr('لا توجد بيانات لعرضها حسب العضو', 'No data to display by organ')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Organ summary cards ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {ORGAN_TYPE_VALUES.map((organ) => {
          const count = stats.byOrgan[organ] || 0;
          const organInfo = ORGAN_LABELS[organ];
          const isSelected = selectedOrgan === organ;
          return (
            <button
              key={organ}
              onClick={() => setSelectedOrgan(isSelected ? null : organ)}
              className={`p-3 rounded-lg border text-center transition-all ${
                isSelected
                  ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                  : 'border-border bg-card hover:border-border'
              }`}
            >
              <div className="text-2xl font-bold text-foreground">{count}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {organInfo ? tr(organInfo.ar, organInfo.en) : organ}
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Organ detail table ──────────────────────────────────────── */}
      {selectedOrgan && (() => {
        const organEntries = entries.filter(
          (e) => e.organType === selectedOrgan && e.medicalStatus === 'ACTIVE',
        );
        const organLabel = ORGAN_LABELS[selectedOrgan];
        // Blood type distribution for this organ
        const btDist: Record<string, number> = {};
        organEntries.forEach((e) => {
          btDist[e.bloodType] = (btDist[e.bloodType] || 0) + 1;
        });
        const avgWait =
          organEntries.length > 0
            ? Math.round(organEntries.reduce((s, e) => s + e.waitingDays, 0) / organEntries.length)
            : 0;

        return (
          <div className="bg-card border rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">
                {organLabel ? tr(organLabel.ar, organLabel.en) : selectedOrgan}
              </h3>
              <div className="flex gap-4 text-sm text-muted-foreground">
                <span>
                  {tr('نشط:', 'Active:')} <strong>{organEntries.length}</strong>
                </span>
                <span>
                  {tr('متوسط الانتظار:', 'Avg Wait:')} <strong>{fmtWait(avgWait, language)}</strong>
                </span>
              </div>
            </div>

            {/* Blood type distribution mini-bar */}
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs text-muted-foreground">{tr('فصائل الدم:', 'Blood Types:')}</span>
              {Object.entries(btDist).map(([bt, c]) => (
                <span key={bt} className="inline-block px-2 py-0.5 text-xs bg-red-50 text-red-700 rounded font-medium">
                  {bt}: {c}
                </span>
              ))}
              {Object.keys(btDist).length === 0 && <span className="text-xs text-muted-foreground">-</span>}
            </div>

            {organEntries.length > 0 ? (
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">#</th>
                    <th className="px-3 py-2 text-left font-medium">{tr('المريض', 'Patient')}</th>
                    <th className="px-3 py-2 text-left font-medium">{tr('فصيلة الدم', 'Blood')}</th>
                    <th className="px-3 py-2 text-left font-medium">{tr('الأولوية', 'Urgency')}</th>
                    <th className="px-3 py-2 text-left font-medium">{tr('أيام الانتظار', 'Wait')}</th>
                    <th className="px-3 py-2 text-left font-medium">{tr('نقاط', 'Score')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {organEntries
                    .sort((a, b) => (b.priorityScore ?? 0) - (a.priorityScore ?? 0))
                    .map((entry, i) => {
                      const urgConf = URGENCY_CONFIG[entry.urgencyStatus] || URGENCY_CONFIG.ROUTINE;
                      return (
                        <tr key={entry.id} className="hover:bg-muted/50">
                          <td className="px-3 py-2 text-muted-foreground text-xs">{i + 1}</td>
                          <td className="px-3 py-2 font-medium text-foreground">{entry.patientMasterId.slice(0, 8)}...</td>
                          <td className="px-3 py-2">
                            <span className="px-1.5 py-0.5 text-xs font-bold bg-red-50 text-red-700 rounded">{entry.bloodType}</span>
                          </td>
                          <td className="px-3 py-2">
                            <span className={`px-2 py-0.5 text-xs rounded border ${urgConf.bg} ${urgConf.color}`}>
                              {tr(urgConf.ar, urgConf.en)}
                            </span>
                          </td>
                          <td className="px-3 py-2 font-mono text-xs">{entry.waitingDays}d</td>
                          <td className="px-3 py-2 font-mono text-xs">{entry.priorityScore?.toFixed(0) ?? '-'}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            ) : (
              <p className="text-center py-6 text-muted-foreground text-sm">
                {tr('لا توجد إدخالات نشطة لهذا العضو', 'No active entries for this organ')}
              </p>
            )}
          </div>
        );
      })()}

      {/* ── If no organ selected, show all organs summary table ──────── */}
      {!selectedOrgan && (
        <div className="bg-card border rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-4">{tr('ملخص حسب العضو', 'Summary by Organ')}</h3>
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">{tr('العضو', 'Organ')}</th>
                <th className="px-3 py-2 text-left font-medium">{tr('نشط', 'Active')}</th>
                <th className="px-3 py-2 text-left font-medium">{tr('طارئ', 'Emergent')}</th>
                <th className="px-3 py-2 text-left font-medium">{tr('عاجل', 'Urgent')}</th>
                <th className="px-3 py-2 text-left font-medium">{tr('روتيني', 'Routine')}</th>
                <th className="px-3 py-2 text-left font-medium">{tr('متوسط الانتظار', 'Avg Wait')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {ORGAN_TYPE_VALUES.map((organ) => {
                const organEntries = entries.filter((e) => e.organType === organ && e.medicalStatus === 'ACTIVE');
                if (organEntries.length === 0) return null;
                const emergent = organEntries.filter((e) => e.urgencyStatus === 'EMERGENT').length;
                const urgent = organEntries.filter((e) => e.urgencyStatus === 'URGENT').length;
                const routine = organEntries.filter((e) => e.urgencyStatus === 'ROUTINE').length;
                const avgWait = Math.round(organEntries.reduce((s, e) => s + e.waitingDays, 0) / organEntries.length);
                const organLabel = ORGAN_LABELS[organ];
                return (
                  <tr key={organ} className="hover:bg-muted/50 cursor-pointer" onClick={() => setSelectedOrgan(organ)}>
                    <td className="px-3 py-2 font-medium">{organLabel ? tr(organLabel.ar, organLabel.en) : organ}</td>
                    <td className="px-3 py-2 font-bold">{organEntries.length}</td>
                    <td className="px-3 py-2">
                      {emergent > 0 ? <span className="text-red-600 font-bold">{emergent}</span> : <span className="text-muted-foreground">0</span>}
                    </td>
                    <td className="px-3 py-2">
                      {urgent > 0 ? <span className="text-orange-600 font-medium">{urgent}</span> : <span className="text-muted-foreground">0</span>}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{routine}</td>
                    <td className="px-3 py-2 font-mono text-xs">{fmtWait(avgWait, language)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── Tab 3: Statistics ──────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

function StatisticsTab({
  stats,
  tr,
  language,
}: {
  stats: WaitlistStats;
  tr: (ar: string, en: string) => string;
  language: string;
}) {
  const totalOutcomes = Object.values(stats.outcomes).reduce((a, b) => a + b, 0);

  // Wait time distribution buckets
  const waitBuckets = [
    { label: tr('< 30 يوم', '< 30 days'), key: '<30' },
    { label: tr('30-90 يوم', '30-90 days'), key: '30-90' },
    { label: tr('90-180 يوم', '90-180 days'), key: '90-180' },
    { label: tr('180-365 يوم', '180-365 days'), key: '180-365' },
    { label: tr('1-2 سنة', '1-2 years'), key: '365-730' },
    { label: tr('> 2 سنة', '> 2 years'), key: '>730' },
  ];

  return (
    <div className="space-y-6">
      {/* ── Blood Type Distribution ──────────────────────────────────── */}
      <div className="bg-card border rounded-lg p-5">
        <h3 className="text-lg font-semibold mb-4">{tr('توزيع فصائل الدم (نشط)', 'Blood Type Distribution (Active)')}</h3>
        <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
          {BLOOD_TYPE_VALUES.map((bt) => {
            const count = stats.bloodTypeDistribution[bt] || 0;
            const pct = stats.totalActive > 0 ? Math.round((count / stats.totalActive) * 100) : 0;
            return (
              <div key={bt} className="text-center p-3 rounded-lg bg-red-50 border border-red-100">
                <div className="text-lg font-bold text-red-700">{bt}</div>
                <div className="text-2xl font-bold text-foreground mt-1">{count}</div>
                <div className="text-xs text-muted-foreground">{pct}%</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Outcomes ─────────────────────────────────────────────────── */}
      <div className="bg-card border rounded-lg p-5">
        <h3 className="text-lg font-semibold mb-4">{tr('نتائج المرضى', 'Patient Outcomes')}</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {Object.entries(STATUS_CONFIG).map(([key, conf]) => {
            const count = stats.outcomes[key] || 0;
            const rate = totalOutcomes > 0 ? ((count / totalOutcomes) * 100).toFixed(1) : '0';
            return (
              <div key={key} className={`p-3 rounded-lg border ${conf.bg}`}>
                <div className={`text-xs font-medium ${conf.color}`}>{tr(conf.ar, conf.en)}</div>
                <div className="text-xl font-bold text-foreground mt-1">{count}</div>
                <div className="text-xs text-muted-foreground">{rate}%</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Urgency Breakdown ────────────────────────────────────────── */}
      <div className="bg-card border rounded-lg p-5">
        <h3 className="text-lg font-semibold mb-4">{tr('توزيع الأولوية', 'Urgency Breakdown')}</h3>
        <div className="space-y-3">
          {Object.entries(URGENCY_CONFIG).map(([key, conf]) => {
            const count = stats.urgencyBreakdown[key] || 0;
            const pct = stats.totalActive > 0 ? Math.round((count / stats.totalActive) * 100) : 0;
            return (
              <div key={key} className="flex items-center gap-3">
                <span className={`text-sm font-medium w-24 ${conf.color}`}>{tr(conf.ar, conf.en)}</span>
                <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      key === 'EMERGENT' ? 'bg-red-500' : key === 'URGENT' ? 'bg-orange-400' : 'bg-muted-foreground'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-sm font-mono w-16 text-right">{count} ({pct}%)</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Organ Wait Time Comparison ───────────────────────────────── */}
      <div className="bg-card border rounded-lg p-5">
        <h3 className="text-lg font-semibold mb-4">{tr('مقارنة أوقات الانتظار حسب العضو', 'Wait Time Comparison by Organ')}</h3>
        <div className="space-y-3">
          {Object.entries(stats.byOrgan)
            .sort(([, a], [, b]) => b - a)
            .map(([organ, count]) => {
              const organLabel = ORGAN_LABELS[organ];
              return (
                <div key={organ} className="flex items-center gap-3">
                  <span className="text-sm font-medium w-28">
                    {organLabel ? tr(organLabel.ar, organLabel.en) : organ}
                  </span>
                  <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${Math.min((count / Math.max(stats.totalActive, 1)) * 100, 100)}%` }}
                    />
                  </div>
                  <span className="text-sm font-mono w-12 text-right">{count}</span>
                </div>
              );
            })}
          {Object.keys(stats.byOrgan).length === 0 && (
            <p className="text-center text-muted-foreground py-4">{tr('لا توجد بيانات', 'No data')}</p>
          )}
        </div>
      </div>

      {/* ── PRA Distribution ─────────────────────────────────────────── */}
      <div className="bg-card border rounded-lg p-5">
        <h3 className="text-lg font-semibold mb-4">{tr('توزيع مستوى PRA', 'PRA Level Distribution')}</h3>
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: tr('منخفض (0-20%)', 'Low (0-20%)'), range: [0, 20], color: 'bg-green-50 border-green-200 text-green-700' },
            { label: tr('متوسط (21-50%)', 'Moderate (21-50%)'), range: [21, 50], color: 'bg-yellow-50 border-yellow-200 text-yellow-700' },
            { label: tr('مرتفع (51-80%)', 'High (51-80%)'), range: [51, 80], color: 'bg-orange-50 border-orange-200 text-orange-700' },
            { label: tr('حساسية عالية (>80%)', 'Highly Sensitized (>80%)'), range: [81, 100], color: 'bg-red-50 border-red-200 text-red-700' },
          ].map(({ label, range, color }) => {
            // We don't have per-entry PRA in stats, so show a placeholder based on available info
            return (
              <div key={label} className={`p-3 rounded-lg border text-center ${color}`}>
                <div className="text-xs font-medium mb-1">{label}</div>
                <div className="text-lg font-bold">{range[0]}-{range[1]}%</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── Tab 4: Status History ──────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

function StatusHistoryTab({
  changes,
  tr,
  language,
}: {
  changes: WaitlistStats['recentChanges'];
  tr: (ar: string, en: string) => string;
  language: string;
}) {
  if (changes.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>{tr('لا توجد تغييرات حالة حديثة', 'No recent status changes')}</p>
      </div>
    );
  }

  return (
    <div className="bg-card border rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-muted/50 border-b">
        <h3 className="text-sm font-medium text-foreground">
          {tr('آخر 50 تغيير حالة', 'Last 50 Status Changes')}
        </h3>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left font-medium">{tr('التاريخ', 'Date')}</th>
            <th className="px-3 py-2 text-left font-medium">{tr('المريض', 'Patient')}</th>
            <th className="px-3 py-2 text-left font-medium">{tr('العضو', 'Organ')}</th>
            <th className="px-3 py-2 text-left font-medium">{tr('من', 'From')}</th>
            <th className="px-3 py-2 text-left font-medium" />
            <th className="px-3 py-2 text-left font-medium">{tr('إلى', 'To')}</th>
            <th className="px-3 py-2 text-left font-medium">{tr('السبب', 'Reason')}</th>
            <th className="px-3 py-2 text-left font-medium">{tr('بواسطة', 'Changed By')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {changes.map((ch, i) => {
            const fromConf = STATUS_CONFIG[ch.from] || { ar: ch.from, en: ch.from, color: 'text-muted-foreground', bg: '' };
            const toConf = STATUS_CONFIG[ch.to] || { ar: ch.to, en: ch.to, color: 'text-muted-foreground', bg: '' };
            const organLabel = ORGAN_LABELS[ch.organType];
            return (
              <tr key={`${ch.entryId}-${i}`} className="hover:bg-muted/50">
                <td className="px-3 py-2 text-xs text-muted-foreground">{fmtDate(ch.date)}</td>
                <td className="px-3 py-2 font-medium">{ch.patientMasterId.slice(0, 8)}...</td>
                <td className="px-3 py-2 text-muted-foreground">
                  {organLabel ? tr(organLabel.ar, organLabel.en) : ch.organType}
                </td>
                <td className="px-3 py-2">
                  <span className={`text-xs font-medium ${fromConf.color}`}>{tr(fromConf.ar, fromConf.en)}</span>
                </td>
                <td className="px-3 py-2">
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </td>
                <td className="px-3 py-2">
                  <span className={`text-xs font-medium ${toConf.color}`}>{tr(toConf.ar, toConf.en)}</span>
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground max-w-[200px] truncate">{ch.reason}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{ch.by.slice(0, 8)}...</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── Create / Edit Dialog ───────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

function CreateEditDialog({
  entry,
  onClose,
  onSaved,
  tr,
  language,
}: {
  entry: WaitlistEntry | null;
  onClose: () => void;
  onSaved: () => void;
  tr: (ar: string, en: string) => string;
  language: string;
}) {
  const isEdit = !!entry;
  const [dialogTab, setDialogTab] = useState<'patient' | 'clinical' | 'priority'>('patient');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [patientMasterId, setPatientMasterId] = useState(entry?.patientMasterId ?? '');
  const [organType, setOrganType] = useState(entry?.organType ?? 'KIDNEY');
  const [bloodType, setBloodType] = useState(entry?.bloodType ?? 'O+');
  const [urgencyStatus, setUrgencyStatus] = useState(entry?.urgencyStatus ?? 'ROUTINE');
  const [primaryDiagnosis, setPrimaryDiagnosis] = useState(entry?.primaryDiagnosis ?? '');
  const [icdCode, setIcdCode] = useState(entry?.icdCode ?? '');
  const [listingDate, setListingDate] = useState(
    entry?.listingDate ? new Date(entry.listingDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
  );
  const [previousTransplants, setPreviousTransplants] = useState(entry?.previousTransplants ?? 0);
  const [transplantCenter, setTransplantCenter] = useState(entry?.transplantCenter ?? '');
  const [region, setRegion] = useState(entry?.region ?? '');
  const [notes, setNotes] = useState(entry?.notes ?? '');

  // Clinical tab
  const [meldScore, setMeldScore] = useState<number | ''>(entry?.meldScore ?? '');
  const [childPughScore, setChildPughScore] = useState(entry?.childPughScore ?? '');
  const [pra, setPra] = useState<number | ''>(entry?.pra ?? '');
  const [dialysisStartDate, setDialysisStartDate] = useState(
    entry?.dialysisStartDate ? new Date(entry.dialysisStartDate).toISOString().split('T')[0] : '',
  );
  const [dialysisType, setDialysisType] = useState(entry?.dialysisType ?? 'NONE');
  const [evaluationComplete, setEvaluationComplete] = useState(entry?.evaluationComplete ?? false);

  // HLA
  const [hla, setHla] = useState<HLATyping>(
    entry?.hlaTyping ?? {
      classI: { a1: '', a2: '', b1: '', b2: '', c1: '', c2: '' },
      classII: { dr1: '', dr2: '', dq1: '', dq2: '' },
    },
  );

  // Crossmatch
  const [crossmatches, setCrossmatches] = useState<CrossmatchEntry[]>(entry?.crossmatchHistory ?? []);
  const [cmDonorId, setCmDonorId] = useState('');
  const [cmResult, setCmResult] = useState<'POSITIVE' | 'NEGATIVE' | 'INCONCLUSIVE'>('NEGATIVE');

  // MELD auto-calculate
  const [bilirubinInput, setBilirubinInput] = useState('');
  const [creatinineInput, setCreatinineInput] = useState('');
  const [inrInput, setInrInput] = useState('');

  // Priority tab
  const [lastReviewDate, setLastReviewDate] = useState(
    entry?.lastReviewDate ? new Date(entry.lastReviewDate).toISOString().split('T')[0] : '',
  );
  const [nextReviewDate, setNextReviewDate] = useState(
    entry?.nextReviewDate ? new Date(entry.nextReviewDate).toISOString().split('T')[0] : '',
  );

  // Auto-calculate MELD
  function handleCalcMeld() {
    const bil = parseFloat(bilirubinInput);
    const cr = parseFloat(creatinineInput);
    const inr = parseFloat(inrInput);
    if (isNaN(bil) || isNaN(cr) || isNaN(inr)) return;
    const bilVal = Math.max(bil, 1);
    const crVal = Math.min(Math.max(cr, 1), 4);
    const inrVal = Math.max(inr, 1);
    const score = Math.round(
      10 * (0.957 * Math.log(crVal) + 0.378 * Math.log(bilVal) + 1.120 * Math.log(inrVal)) + 6.43,
    );
    setMeldScore(Math.min(Math.max(score, 6), 40));
  }

  // Add crossmatch
  function addCrossmatch() {
    if (!cmDonorId.trim()) return;
    setCrossmatches([
      ...crossmatches,
      { date: new Date().toISOString(), donorId: cmDonorId.trim(), result: cmResult },
    ]);
    setCmDonorId('');
    setCmResult('NEGATIVE');
  }

  // Calculate display priority
  const waitDays = listingDate
    ? Math.max(0, Math.floor((Date.now() - new Date(listingDate).getTime()) / 86400000))
    : 0;

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      const payload: Record<string, unknown> = {
        patientMasterId,
        organType,
        bloodType,
        urgencyStatus,
        primaryDiagnosis,
        icdCode: icdCode || null,
        listingDate,
        previousTransplants,
        transplantCenter: transplantCenter || null,
        region: region || null,
        notes: notes || null,
        meldScore: meldScore !== '' ? Number(meldScore) : null,
        childPughScore: childPughScore || null,
        pra: pra !== '' ? Number(pra) : null,
        dialysisStartDate: dialysisStartDate || null,
        dialysisType: dialysisType || null,
        evaluationComplete,
        hlaTyping: hla,
        crossmatchHistory: crossmatches,
        lastReviewDate: lastReviewDate || null,
        nextReviewDate: nextReviewDate || null,
      };
      if (isEdit) {
        payload.id = entry!.id;
      }

      const res = await fetch('/api/transplant/waitlist', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || res.statusText);
      }
      onSaved();
    } catch (err: any) {
      setError(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  const dialogTabs = [
    { key: 'patient' as const, label: tr('بيانات المريض', 'Patient Info'), icon: Users },
    { key: 'clinical' as const, label: tr('البيانات السريرية', 'Clinical Data'), icon: Stethoscope },
    { key: 'priority' as const, label: tr('الأولوية والمراجعة', 'Priority & Review'), icon: TrendingUp },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-card rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* ── Dialog header ──────────────────────────────────────────── */}
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {isEdit
              ? tr('تعديل إدخال قائمة الانتظار', 'Edit Waitlist Entry')
              : tr('إضافة مريض لقائمة الانتظار', 'Add Patient to Waitlist')}
          </h2>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-muted-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Dialog tabs ────────────────────────────────────────────── */}
        <div className="border-b px-6">
          <nav className="flex gap-1">
            {dialogTabs.map((dt) => {
              const Icon = dt.icon;
              return (
                <button
                  key={dt.key}
                  onClick={() => setDialogTab(dt.key)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 ${
                    dialogTab === dt.key
                      ? 'border-blue-600 text-blue-600 font-medium'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {dt.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* ── Dialog body ────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
          )}

          {/* ── Tab: Patient Info ──────────────────────────────────── */}
          {dialogTab === 'patient' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    {tr('رقم المريض *', 'Patient ID *')}
                  </label>
                  <input
                    type="text"
                    value={patientMasterId}
                    onChange={(e) => setPatientMasterId(e.target.value)}
                    className="w-full border border-border rounded-md px-3 py-2 text-sm"
                    placeholder={tr('معرف المريض الرئيسي', 'Patient Master ID')}
                    disabled={isEdit}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    {tr('تاريخ الإدراج *', 'Listing Date *')}
                  </label>
                  <input
                    type="date"
                    value={listingDate}
                    onChange={(e) => setListingDate(e.target.value)}
                    className="w-full border border-border rounded-md px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    {tr('نوع العضو *', 'Organ Type *')}
                  </label>
                  <select
                    value={organType}
                    onChange={(e) => setOrganType(e.target.value)}
                    className="w-full border border-border rounded-md px-3 py-2 text-sm"
                  >
                    {ORGAN_TYPE_VALUES.map((o) => (
                      <option key={o} value={o}>{tr(ORGAN_LABELS[o].ar, ORGAN_LABELS[o].en)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    {tr('فصيلة الدم *', 'Blood Type *')}
                  </label>
                  <select
                    value={bloodType}
                    onChange={(e) => setBloodType(e.target.value)}
                    className="w-full border border-border rounded-md px-3 py-2 text-sm"
                  >
                    {BLOOD_TYPE_VALUES.map((bt) => (
                      <option key={bt} value={bt}>{bt}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  {tr('التشخيص الأساسي *', 'Primary Diagnosis *')}
                </label>
                <input
                  type="text"
                  value={primaryDiagnosis}
                  onChange={(e) => setPrimaryDiagnosis(e.target.value)}
                  className="w-full border border-border rounded-md px-3 py-2 text-sm"
                  placeholder={tr('مثال: فشل كلوي مزمن', 'e.g. Chronic Kidney Disease')}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    {tr('رمز ICD-10', 'ICD Code')}
                  </label>
                  <input
                    type="text"
                    value={icdCode}
                    onChange={(e) => setIcdCode(e.target.value)}
                    className="w-full border border-border rounded-md px-3 py-2 text-sm"
                    placeholder="N18.6"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    {tr('درجة الأولوية', 'Urgency Status')}
                  </label>
                  <select
                    value={urgencyStatus}
                    onChange={(e) => setUrgencyStatus(e.target.value)}
                    className="w-full border border-border rounded-md px-3 py-2 text-sm"
                  >
                    {Object.entries(URGENCY_CONFIG).map(([k, v]) => (
                      <option key={k} value={k}>{tr(v.ar, v.en)}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    {tr('عمليات زراعة سابقة', 'Previous Transplants')}
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={previousTransplants}
                    onChange={(e) => setPreviousTransplants(Number(e.target.value))}
                    className="w-full border border-border rounded-md px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    {tr('مركز الزراعة', 'Transplant Center')}
                  </label>
                  <input
                    type="text"
                    value={transplantCenter}
                    onChange={(e) => setTransplantCenter(e.target.value)}
                    className="w-full border border-border rounded-md px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    {tr('المنطقة', 'Region')}
                  </label>
                  <input
                    type="text"
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    className="w-full border border-border rounded-md px-3 py-2 text-sm"
                    placeholder={tr('مثال: الرياض', 'e.g. Riyadh')}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  {tr('ملاحظات', 'Notes')}
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full border border-border rounded-md px-3 py-2 text-sm"
                />
              </div>
            </div>
          )}

          {/* ── Tab: Clinical Data ─────────────────────────────────── */}
          {dialogTab === 'clinical' && (
            <div className="space-y-5">
              {/* Liver specific: MELD */}
              {organType === 'LIVER' && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-3">
                  <h4 className="font-medium text-amber-800">{tr('بيانات الكبد', 'Liver Data')}</h4>
                  <div className="grid grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">
                        {tr('البيليروبين (mg/dL)', 'Bilirubin (mg/dL)')}
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={bilirubinInput}
                        onChange={(e) => setBilirubinInput(e.target.value)}
                        className="w-full border border-border rounded px-2 py-1.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">
                        {tr('الكرياتينين (mg/dL)', 'Creatinine (mg/dL)')}
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={creatinineInput}
                        onChange={(e) => setCreatinineInput(e.target.value)}
                        className="w-full border border-border rounded px-2 py-1.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">INR</label>
                      <input
                        type="number"
                        step="0.1"
                        value={inrInput}
                        onChange={(e) => setInrInput(e.target.value)}
                        className="w-full border border-border rounded px-2 py-1.5 text-sm"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        onClick={handleCalcMeld}
                        className="w-full px-3 py-1.5 text-sm bg-amber-600 text-white rounded hover:bg-amber-700"
                      >
                        {tr('حساب MELD', 'Calc MELD')}
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">
                        {tr('نقاط MELD', 'MELD Score')}
                      </label>
                      <input
                        type="number"
                        min={6}
                        max={40}
                        value={meldScore}
                        onChange={(e) => setMeldScore(e.target.value ? Number(e.target.value) : '')}
                        className="w-full border border-border rounded px-2 py-1.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">
                        {tr('تصنيف Child-Pugh', 'Child-Pugh Class')}
                      </label>
                      <select
                        value={childPughScore}
                        onChange={(e) => setChildPughScore(e.target.value)}
                        className="w-full border border-border rounded px-2 py-1.5 text-sm"
                      >
                        <option value="">{tr('اختر', 'Select')}</option>
                        {Object.entries(CHILD_PUGH_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>{tr(v.ar, v.en)}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Kidney specific: Dialysis */}
              {organType === 'KIDNEY' && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
                  <h4 className="font-medium text-blue-800">{tr('بيانات الكلية', 'Kidney Data')}</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">
                        {tr('تاريخ بدء الغسيل', 'Dialysis Start Date')}
                      </label>
                      <input
                        type="date"
                        value={dialysisStartDate}
                        onChange={(e) => setDialysisStartDate(e.target.value)}
                        className="w-full border border-border rounded px-2 py-1.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">
                        {tr('نوع الغسيل', 'Dialysis Type')}
                      </label>
                      <select
                        value={dialysisType}
                        onChange={(e) => setDialysisType(e.target.value)}
                        className="w-full border border-border rounded px-2 py-1.5 text-sm"
                      >
                        {Object.entries(DIALYSIS_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>{tr(v.ar, v.en)}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* PRA */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    {tr('نسبة PRA (%)', 'PRA (%)')}
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    value={pra}
                    onChange={(e) => setPra(e.target.value ? Number(e.target.value) : '')}
                    className="w-full border border-border rounded-md px-3 py-2 text-sm"
                    placeholder="0-100"
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={evaluationComplete}
                      onChange={(e) => setEvaluationComplete(e.target.checked)}
                      className="rounded border-border"
                    />
                    {tr('اكتمل التقييم', 'Evaluation Complete')}
                  </label>
                </div>
              </div>

              {/* HLA Typing */}
              <div className="p-4 bg-muted/50 border rounded-lg space-y-3">
                <h4 className="font-medium text-foreground">{tr('تصنيف HLA', 'HLA Typing')}</h4>
                <div>
                  <p className="text-xs text-muted-foreground mb-2">{tr('الصنف الأول', 'Class I')}</p>
                  <div className="grid grid-cols-6 gap-2">
                    {(['a1', 'a2', 'b1', 'b2', 'c1', 'c2'] as const).map((locus) => (
                      <div key={locus}>
                        <label className="block text-xs text-muted-foreground mb-0.5">{locus.toUpperCase()}</label>
                        <input
                          type="text"
                          value={hla.classI[locus]}
                          onChange={(e) =>
                            setHla({
                              ...hla,
                              classI: { ...hla.classI, [locus]: e.target.value },
                            })
                          }
                          className="w-full border border-border rounded px-2 py-1 text-xs"
                        />
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-2">{tr('الصنف الثاني', 'Class II')}</p>
                  <div className="grid grid-cols-4 gap-2">
                    {(['dr1', 'dr2', 'dq1', 'dq2'] as const).map((locus) => (
                      <div key={locus}>
                        <label className="block text-xs text-muted-foreground mb-0.5">{locus.toUpperCase()}</label>
                        <input
                          type="text"
                          value={hla.classII[locus]}
                          onChange={(e) =>
                            setHla({
                              ...hla,
                              classII: { ...hla.classII, [locus]: e.target.value },
                            })
                          }
                          className="w-full border border-border rounded px-2 py-1 text-xs"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Crossmatch History */}
              <div className="p-4 bg-muted/50 border rounded-lg space-y-3">
                <h4 className="font-medium text-foreground">{tr('سجل التصالب', 'Crossmatch History')}</h4>
                {crossmatches.length > 0 && (
                  <div className="space-y-1.5">
                    {crossmatches.map((cm, i) => {
                      const resConf = CROSSMATCH_RESULT_LABELS[cm.result];
                      return (
                        <div key={i} className="flex items-center gap-2 text-xs bg-card p-2 rounded border">
                          <span className="text-muted-foreground">{fmtDate(cm.date)}</span>
                          <span className="font-medium">{cm.donorId}</span>
                          <span className={resConf?.color || ''}>{resConf ? tr(resConf.ar, resConf.en) : cm.result}</span>
                          <button
                            onClick={() => setCrossmatches(crossmatches.filter((_, idx) => idx !== i))}
                            className="ml-auto text-muted-foreground hover:text-red-500"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <label className="block text-xs text-muted-foreground mb-0.5">{tr('معرف المتبرع', 'Donor ID')}</label>
                    <input
                      type="text"
                      value={cmDonorId}
                      onChange={(e) => setCmDonorId(e.target.value)}
                      className="w-full border border-border rounded px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-0.5">{tr('النتيجة', 'Result')}</label>
                    <select
                      value={cmResult}
                      onChange={(e) => setCmResult(e.target.value as typeof cmResult)}
                      className="border border-border rounded px-2 py-1.5 text-sm"
                    >
                      {Object.entries(CROSSMATCH_RESULT_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{tr(v.ar, v.en)}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={addCrossmatch}
                    className="px-3 py-1.5 text-sm bg-gray-700 text-white rounded hover:bg-gray-800"
                  >
                    {tr('إضافة', 'Add')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Tab: Priority & Review ─────────────────────────────── */}
          {dialogTab === 'priority' && (
            <div className="space-y-5">
              {/* Priority gauge */}
              <div className="p-4 bg-card border rounded-lg">
                <h4 className="font-medium text-foreground mb-3">
                  {tr('نقاط الأولوية المحسوبة', 'Calculated Priority Score')}
                </h4>
                <div className="flex items-center gap-4">
                  <div className="w-full h-4 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        (() => {
                          // Simple inline calculation for preview
                          const urgWeight =
                            urgencyStatus === 'EMERGENT' ? 100 : urgencyStatus === 'URGENT' ? 50 : 10;
                          const waitBonus = Math.min(Math.floor(waitDays / 30), 50);
                          const meldC = meldScore ? Number(meldScore) : 0;
                          const praB = pra ? Math.round((Number(pra) / 100) * 20) : 0;
                          const prior = previousTransplants * 5;
                          const score = Math.max(0, urgWeight + waitBonus + meldC + praB - prior);
                          const pct = Math.min((score / 150) * 100, 100);
                          return pct >= 66 ? 'bg-red-500' : pct >= 33 ? 'bg-orange-400' : 'bg-green-500';
                        })()
                      }`}
                      style={{
                        width: `${Math.min(
                          (Math.max(
                            0,
                            (urgencyStatus === 'EMERGENT' ? 100 : urgencyStatus === 'URGENT' ? 50 : 10) +
                              Math.min(Math.floor(waitDays / 30), 50) +
                              (meldScore ? Number(meldScore) : 0) +
                              (pra ? Math.round((Number(pra) / 100) * 20) : 0) -
                              previousTransplants * 5,
                          ) /
                            150) *
                            100,
                          100,
                        )}%`,
                      }}
                    />
                  </div>
                  <span className="text-lg font-bold text-foreground min-w-[60px] text-right">
                    {Math.max(
                      0,
                      Math.round(
                        (urgencyStatus === 'EMERGENT' ? 100 : urgencyStatus === 'URGENT' ? 50 : 10) +
                          Math.min(Math.floor(waitDays / 30), 50) +
                          (meldScore ? Number(meldScore) : 0) +
                          (pra ? Math.round((Number(pra) / 100) * 20) : 0) -
                          previousTransplants * 5,
                      ),
                    )}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-5 gap-2 text-xs text-muted-foreground">
                  <div>
                    {tr('الأولوية', 'Urgency')}: {urgencyStatus === 'EMERGENT' ? 100 : urgencyStatus === 'URGENT' ? 50 : 10}
                  </div>
                  <div>
                    {tr('انتظار', 'Wait')}: +{Math.min(Math.floor(waitDays / 30), 50)}
                  </div>
                  <div>MELD: +{meldScore || 0}</div>
                  <div>PRA: +{pra ? Math.round((Number(pra) / 100) * 20) : 0}</div>
                  <div>
                    {tr('سابقة', 'Prior')}: -{previousTransplants * 5}
                  </div>
                </div>
              </div>

              {/* Wait time */}
              <div className="p-4 bg-muted/50 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <span className="text-sm text-muted-foreground">{tr('مدة الانتظار:', 'Waiting Time:')}</span>
                    <span className="ml-2 text-lg font-bold">{waitDays} {tr('يوم', 'days')}</span>
                    <span className="ml-1 text-sm text-muted-foreground">({fmtWait(waitDays, language)})</span>
                  </div>
                </div>
              </div>

              {/* Review dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    {tr('تاريخ آخر مراجعة', 'Last Review Date')}
                  </label>
                  <input
                    type="date"
                    value={lastReviewDate}
                    onChange={(e) => setLastReviewDate(e.target.value)}
                    className="w-full border border-border rounded-md px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    {tr('تاريخ المراجعة التالية', 'Next Review Date')}
                  </label>
                  <input
                    type="date"
                    value={nextReviewDate}
                    onChange={(e) => setNextReviewDate(e.target.value)}
                    className="w-full border border-border rounded-md px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Dialog footer ──────────────────────────────────────────── */}
        <div className="px-6 py-4 border-t flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted/50"
          >
            {tr('إلغاء', 'Cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !patientMasterId || !primaryDiagnosis}
            className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving
              ? tr('جاري الحفظ...', 'Saving...')
              : isEdit
                ? tr('تحديث', 'Update')
                : tr('إضافة', 'Add to Waitlist')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── View Dialog ────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

function ViewDialog({
  entry,
  onClose,
  onEdit,
  onStatusChange,
  tr,
  language,
}: {
  entry: WaitlistEntry;
  onClose: () => void;
  onEdit: (e: WaitlistEntry) => void;
  onStatusChange: (e: WaitlistEntry) => void;
  tr: (ar: string, en: string) => string;
  language: string;
}) {
  const organLabel = ORGAN_LABELS[entry.organType];
  const urgConf = URGENCY_CONFIG[entry.urgencyStatus] || URGENCY_CONFIG.ROUTINE;
  const statConf = STATUS_CONFIG[entry.medicalStatus] || STATUS_CONFIG.ACTIVE;
  const dialysisLabel = entry.dialysisType ? DIALYSIS_LABELS[entry.dialysisType] : null;
  const cpLabel = entry.childPughScore ? CHILD_PUGH_LABELS[entry.childPughScore] : null;
  const history = Array.isArray(entry.statusHistory) ? entry.statusHistory : [];
  const crossmatches = Array.isArray(entry.crossmatchHistory) ? entry.crossmatchHistory : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-card rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">
              {tr('تفاصيل المريض في قائمة الانتظار', 'Waitlist Entry Details')}
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {entry.patientMasterId}
            </p>
          </div>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-muted-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Body ───────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Status + organ header */}
          <div className="flex items-center gap-4 flex-wrap">
            <span className={`px-3 py-1 text-sm font-medium rounded border ${statConf.bg} ${statConf.color}`}>
              {tr(statConf.ar, statConf.en)}
            </span>
            <span className={`px-3 py-1 text-sm font-medium rounded border ${urgConf.bg} ${urgConf.color}`}>
              {urgConf.pulse && <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse mr-1" />}
              {tr(urgConf.ar, urgConf.en)}
            </span>
            <span className="px-3 py-1 text-sm font-bold bg-red-50 text-red-700 rounded">{entry.bloodType}</span>
            <span className="px-3 py-1 text-sm bg-muted rounded">
              {organLabel ? tr(organLabel.ar, organLabel.en) : entry.organType}
            </span>
          </div>

          {/* Patient & clinical data */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
            <div>
              <span className="text-muted-foreground">{tr('التشخيص:', 'Diagnosis:')}</span>
              <span className="ml-2 font-medium">{entry.primaryDiagnosis}</span>
              {entry.icdCode && <span className="ml-1 text-muted-foreground">({entry.icdCode})</span>}
            </div>
            <div>
              <span className="text-muted-foreground">{tr('تاريخ الإدراج:', 'Listing Date:')}</span>
              <span className="ml-2 font-medium">{fmtDate(entry.listingDate)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{tr('أيام الانتظار:', 'Wait Days:')}</span>
              <span className="ml-2 font-bold">{entry.waitingDays} ({fmtWait(entry.waitingDays, language)})</span>
            </div>
            <div>
              <span className="text-muted-foreground">{tr('نقاط الأولوية:', 'Priority Score:')}</span>
              <span className="ml-2 font-bold">{entry.priorityScore?.toFixed(1) ?? '-'}</span>
            </div>
            {entry.meldScore != null && (
              <div>
                <span className="text-muted-foreground">{tr('نقاط MELD:', 'MELD Score:')}</span>
                <span className="ml-2 font-bold">{entry.meldScore}</span>
              </div>
            )}
            {cpLabel && (
              <div>
                <span className="text-muted-foreground">Child-Pugh:</span>
                <span className="ml-2 font-medium">{tr(cpLabel.ar, cpLabel.en)}</span>
              </div>
            )}
            {entry.pra != null && (
              <div>
                <span className="text-muted-foreground">PRA:</span>
                <span className="ml-2 font-bold">{entry.pra}%</span>
              </div>
            )}
            {dialysisLabel && (
              <div>
                <span className="text-muted-foreground">{tr('الغسيل:', 'Dialysis:')}</span>
                <span className="ml-2">{tr(dialysisLabel.ar, dialysisLabel.en)}</span>
                {entry.dialysisStartDate && (
                  <span className="ml-1 text-muted-foreground">({tr('منذ', 'since')} {fmtDate(entry.dialysisStartDate)})</span>
                )}
              </div>
            )}
            <div>
              <span className="text-muted-foreground">{tr('عمليات سابقة:', 'Previous Transplants:')}</span>
              <span className="ml-2">{entry.previousTransplants}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{tr('التقييم:', 'Evaluation:')}</span>
              <span className={`ml-2 font-medium ${entry.evaluationComplete ? 'text-green-600' : 'text-orange-600'}`}>
                {entry.evaluationComplete ? tr('مكتمل', 'Complete') : tr('غير مكتمل', 'Incomplete')}
              </span>
            </div>
            {entry.transplantCenter && (
              <div>
                <span className="text-muted-foreground">{tr('المركز:', 'Center:')}</span>
                <span className="ml-2">{entry.transplantCenter}</span>
              </div>
            )}
            {entry.region && (
              <div>
                <span className="text-muted-foreground">{tr('المنطقة:', 'Region:')}</span>
                <span className="ml-2">{entry.region}</span>
              </div>
            )}
            {entry.lastReviewDate && (
              <div>
                <span className="text-muted-foreground">{tr('آخر مراجعة:', 'Last Review:')}</span>
                <span className="ml-2">{fmtDate(entry.lastReviewDate)}</span>
              </div>
            )}
            {entry.nextReviewDate && (
              <div>
                <span className="text-muted-foreground">{tr('المراجعة التالية:', 'Next Review:')}</span>
                <span className="ml-2">{fmtDate(entry.nextReviewDate)}</span>
              </div>
            )}
          </div>

          {/* HLA Typing */}
          {entry.hlaTyping && (
            <div className="p-3 bg-muted/50 border rounded-lg">
              <h4 className="text-sm font-medium text-foreground mb-2">{tr('تصنيف HLA', 'HLA Typing')}</h4>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="text-muted-foreground mb-1">{tr('الصنف الأول', 'Class I')}</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(entry.hlaTyping.classI || {}).map(([k, v]) =>
                      v ? (
                        <span key={k} className="px-2 py-0.5 bg-card border rounded font-mono">
                          {k.toUpperCase()}: {v as string}
                        </span>
                      ) : null,
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">{tr('الصنف الثاني', 'Class II')}</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(entry.hlaTyping.classII || {}).map(([k, v]) =>
                      v ? (
                        <span key={k} className="px-2 py-0.5 bg-card border rounded font-mono">
                          {k.toUpperCase()}: {v as string}
                        </span>
                      ) : null,
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Crossmatch History */}
          {crossmatches.length > 0 && (
            <div className="p-3 bg-muted/50 border rounded-lg">
              <h4 className="text-sm font-medium text-foreground mb-2">{tr('سجل التصالب', 'Crossmatch History')}</h4>
              <div className="space-y-1.5">
                {crossmatches.map((cm, i) => {
                  const resConf = CROSSMATCH_RESULT_LABELS[cm.result];
                  return (
                    <div key={i} className="flex items-center gap-3 text-xs bg-card p-2 rounded border">
                      <CalendarDays className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-muted-foreground">{fmtDate(cm.date)}</span>
                      <span className="font-medium">{cm.donorId}</span>
                      <span className={resConf?.color || ''}>
                        {resConf ? tr(resConf.ar, resConf.en) : cm.result}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Status Change History */}
          {history.length > 0 && (
            <div className="p-3 bg-muted/50 border rounded-lg">
              <h4 className="text-sm font-medium text-foreground mb-2">{tr('سجل تغييرات الحالة', 'Status Change History')}</h4>
              <div className="space-y-2">
                {history.map((h, i) => {
                  const fromConf = STATUS_CONFIG[h.from] || { ar: h.from, en: h.from, color: 'text-muted-foreground' };
                  const toConf = STATUS_CONFIG[h.to] || { ar: h.to, en: h.to, color: 'text-muted-foreground' };
                  return (
                    <div key={i} className="flex items-center gap-2 text-xs bg-card p-2 rounded border">
                      <span className="text-muted-foreground min-w-[80px]">{fmtDate(h.date)}</span>
                      <span className={fromConf.color}>{tr(fromConf.ar, fromConf.en)}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className={toConf.color}>{tr(toConf.ar, toConf.en)}</span>
                      <span className="text-muted-foreground ml-auto max-w-[200px] truncate">{h.reason}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Notes */}
          {entry.notes && (
            <div className="p-3 bg-muted/50 border rounded-lg">
              <h4 className="text-sm font-medium text-foreground mb-1">{tr('ملاحظات', 'Notes')}</h4>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{entry.notes}</p>
            </div>
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────────────── */}
        <div className="px-6 py-4 border-t flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted/50"
          >
            {tr('إغلاق', 'Close')}
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => onStatusChange(entry)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-orange-300 text-orange-700 rounded-lg hover:bg-orange-50"
            >
              <Activity className="w-4 h-4" />
              {tr('تغيير الحالة', 'Update Status')}
            </button>
            <button
              onClick={() => onEdit(entry)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              <Edit className="w-4 h-4" />
              {tr('تعديل', 'Edit')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── Status Change Dialog ───────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

function StatusChangeDialog({
  entry,
  onClose,
  onSaved,
  tr,
  language,
}: {
  entry: WaitlistEntry;
  onClose: () => void;
  onSaved: () => void;
  tr: (ar: string, en: string) => string;
  language: string;
}) {
  const [newStatus, setNewStatus] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Valid transitions
  const validTransitions: Record<string, string[]> = {
    ACTIVE: ['TEMPORARILY_INACTIVE', 'PERMANENTLY_INACTIVE', 'TRANSPLANTED', 'DECEASED', 'REMOVED'],
    TEMPORARILY_INACTIVE: ['ACTIVE', 'PERMANENTLY_INACTIVE', 'DECEASED', 'REMOVED'],
    PERMANENTLY_INACTIVE: ['ACTIVE', 'DECEASED', 'REMOVED'],
    TRANSPLANTED: ['ACTIVE'],
    DECEASED: [],
    REMOVED: ['ACTIVE'],
  };

  const allowed = validTransitions[entry.medicalStatus] ?? [];
  const currentConf = STATUS_CONFIG[entry.medicalStatus] || STATUS_CONFIG.ACTIVE;

  async function handleSave() {
    if (!newStatus || !reason.trim()) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/transplant/waitlist', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          id: entry.id,
          medicalStatus: newStatus,
          statusReason: reason.trim(),
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || res.statusText);
      }
      onSaved();
    } catch (err: any) {
      setError(err.message || 'Failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-card rounded-xl shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold">{tr('تغيير الحالة الطبية', 'Change Medical Status')}</h2>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-muted-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">{error}</div>
          )}

          <div>
            <p className="text-sm text-muted-foreground mb-1">{tr('الحالة الحالية:', 'Current Status:')}</p>
            <span className={`inline-block px-3 py-1 text-sm font-medium rounded border ${currentConf.bg} ${currentConf.color}`}>
              {tr(currentConf.ar, currentConf.en)}
            </span>
          </div>

          {allowed.length === 0 ? (
            <div className="p-4 bg-muted/50 border rounded text-sm text-muted-foreground text-center">
              {tr('لا توجد تحولات متاحة من هذه الحالة', 'No transitions available from this status')}
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  {tr('الحالة الجديدة *', 'New Status *')}
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full border border-border rounded-md px-3 py-2 text-sm"
                >
                  <option value="">{tr('اختر الحالة', 'Select Status')}</option>
                  {allowed.map((s) => {
                    const conf = STATUS_CONFIG[s] || { ar: s, en: s };
                    return (
                      <option key={s} value={s}>{tr(conf.ar, conf.en)}</option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  {tr('سبب التغيير *', 'Reason for Change *')}
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  className="w-full border border-border rounded-md px-3 py-2 text-sm"
                  placeholder={tr('يرجى ذكر سبب تغيير الحالة', 'Please provide a reason for this status change')}
                />
              </div>
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted/50"
          >
            {tr('إلغاء', 'Cancel')}
          </button>
          {allowed.length > 0 && (
            <button
              onClick={handleSave}
              disabled={saving || !newStatus || !reason.trim()}
              className="px-4 py-2 text-sm text-white bg-orange-600 rounded-lg hover:bg-orange-700 disabled:opacity-50"
            >
              {saving ? tr('جاري الحفظ...', 'Saving...') : tr('تأكيد التغيير', 'Confirm Change')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
