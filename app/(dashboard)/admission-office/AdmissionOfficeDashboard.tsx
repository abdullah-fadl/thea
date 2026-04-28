'use client';

import { useState, useCallback, useMemo, ReactNode } from 'react';
import useSWR from 'swr';
import {
  ClipboardCheck,
  Plus,
  X,
  Search,
  Clock,
  Bed,
  Activity,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ArrowRightLeft,
  BarChart3,
  Filter,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  FileText,
  Shield,
  Users,
  Building2,
  Timer,
  TrendingUp,
  Banknote,
  Landmark,
} from 'lucide-react';
import { useLang } from '@/hooks/use-lang';
import AdmissionPaymentDialog from '@/components/admission/AdmissionPaymentDialog';

// ─── Types ───────────────────────────────────────────────────────────────────

interface AdmissionRequest {
  id: string;
  source: string;
  patientMasterId: string;
  patientName: string;
  mrn: string;
  requestingDoctorName: string;
  admittingDoctorName: string;
  targetDepartment: string;
  targetUnit: string;
  urgency: string;
  bedType: string;
  primaryDiagnosis: string;
  clinicalSummary: string;
  reasonForAdmission: string;
  status: string;
  isolationRequired: boolean;
  isolationType: string;
  expectedLOS: number | null;
  allergies: any[];
  pendingOrders: any[];
  episodeId: string | null;
  bedReservationId: string | null;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
  // Financial fields
  paymentType?: string | null;
  insuranceId?: string | null;
  insurerName?: string | null;
  policyNumber?: string | null;
  memberId?: string | null;
  eligibilityStatus?: string | null;
  eligibilityCheckedAt?: string | null;
  preauthStatus?: string | null;
  preauthNumber?: string | null;
  estimatedCost?: number | null;
  estimatedCostBreakdown?: any;
  depositRequired?: number | null;
  depositCollected?: number | null;
  depositMethod?: string | null;
  depositReceiptNumber?: string | null;
  depositCollectedAt?: string | null;
  billingEncounterCoreId?: string | null;
  payerContextId?: string | null;
}

interface ChecklistData {
  id: string;
  admissionRequestId: string;
  items: ChecklistItem[];
  completionPercentage: number;
  allRequiredComplete: boolean;
}

interface ChecklistItem {
  key: string;
  labelEn: string;
  labelAr: string;
  required: boolean;
  completed: boolean;
  completedBy?: string;
  completedAt?: string;
  notes?: string;
}

interface BedInfo {
  id: string;
  bedLabel: string;
  ward: string;
  room: string;
  unit: string;
  departmentName: string;
  isActive: boolean;
  status: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'INACTIVE';
  occupant: { patientName: string; episodeId: string } | null;
  reservation: { id: string; admissionRequestId: string; expiresAt: string } | null;
}

interface WardGroup {
  ward: string;
  beds: BedInfo[];
  available: number;
  occupied: number;
  reserved: number;
  inactive: number;
}

interface WardTransfer {
  id: string;
  episodeId: string;
  patientName: string;
  fromWard: string;
  fromBed: string;
  toWard: string;
  toUnit: string;
  reason: string;
  status: string;
  requestedAt: string;
  approvedAt: string | null;
  completedAt: string | null;
  transferType: string;
  urgency: string;
  targetUnitType: string | null;
  requiresApproval: boolean;
  rejectedAt: string | null;
  rejectionReason: string | null;
  escalationCriteria: any;
  acuityData: any;
  sbarData: any;
  icuEventId: string | null;
  ordersApplied: any[] | null;
}

interface Stats {
  todayAdmissions: number;
  pendingCount: number;
  avgWaitHours: number;
  overallOccupancy: number;
  occupancy: Array<{
    department: string;
    totalBeds: number;
    occupied: number;
    available: number;
    occupancyRate: number;
  }>;
  sourceBreakdown: Record<string, number>;
  trend: Array<{ date: string; count: number }>;
  alos: Array<{ department: string; avgDays: number; count: number }>;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

const STATUS_CONFIG: Record<string, { labelEn: string; labelAr: string; color: string; bg: string }> = {
  PENDING:          { labelEn: 'Pending',          labelAr: 'بانتظار المراجعة', color: 'text-amber-700',  bg: 'bg-amber-50 border-amber-200' },
  INSURANCE_REVIEW: { labelEn: 'Insurance Review', labelAr: 'مراجعة التأمين',   color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200' },
  VERIFIED:         { labelEn: 'Verified',         labelAr: 'تم التحقق',        color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200' },
  BED_ASSIGNED:     { labelEn: 'Bed Assigned',     labelAr: 'سرير معيّن',       color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
  ADMITTED:         { labelEn: 'Admitted',          labelAr: 'تم القبول',        color: 'text-green-700',  bg: 'bg-green-50 border-green-200' },
  CANCELLED:        { labelEn: 'Cancelled',         labelAr: 'ملغى',            color: 'text-muted-foreground',   bg: 'bg-muted/50 border-border' },
};

const URGENCY_CONFIG: Record<string, { labelEn: string; labelAr: string; color: string; bg: string }> = {
  ELECTIVE:  { labelEn: 'Elective',  labelAr: 'اختياري', color: 'text-green-700',  bg: 'bg-green-50 border-green-200' },
  URGENT:    { labelEn: 'Urgent',    labelAr: 'عاجل',   color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' },
  EMERGENCY: { labelEn: 'Emergency', labelAr: 'طارئ',   color: 'text-red-700',    bg: 'bg-red-50 border-red-200' },
};

const SOURCE_CONFIG: Record<string, { labelEn: string; labelAr: string; color: string }> = {
  OPD:          { labelEn: 'OPD',          labelAr: 'عيادات',    color: 'bg-blue-100 text-blue-800' },
  ER:           { labelEn: 'ER',           labelAr: 'طوارئ',     color: 'bg-red-100 text-red-800' },
  SCHEDULED_OR: { labelEn: 'Scheduled OR', labelAr: 'عملية مجدولة', color: 'bg-purple-100 text-purple-800' },
  EXTERNAL:     { labelEn: 'External',     labelAr: 'تحويل خارجي', color: 'bg-teal-100 text-teal-800' },
  DIRECT:       { labelEn: 'Direct',       labelAr: 'مباشر',     color: 'bg-muted text-foreground' },
};

const TRANSFER_STATUS: Record<string, { labelEn: string; labelAr: string; color: string; bg: string }> = {
  REQUESTED:    { labelEn: 'Requested',    labelAr: 'مطلوب',       color: 'text-amber-700',  bg: 'bg-amber-50 border-amber-200' },
  APPROVED:     { labelEn: 'Approved',     labelAr: 'موافق عليه',  color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200' },
  BED_ASSIGNED: { labelEn: 'Bed Assigned', labelAr: 'سرير معيّن',  color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
  COMPLETED:    { labelEn: 'Completed',    labelAr: 'مكتمل',       color: 'text-green-700',  bg: 'bg-green-50 border-green-200' },
  CANCELLED:    { labelEn: 'Cancelled',    labelAr: 'ملغى',        color: 'text-muted-foreground',   bg: 'bg-muted/50 border-border' },
  REJECTED:     { labelEn: 'Rejected',     labelAr: 'مرفوض',       color: 'text-red-700',    bg: 'bg-red-50 border-red-200' },
};

const TRANSFER_TYPE_CONFIG: Record<string, { labelEn: string; labelAr: string; color: string; bg: string }> = {
  ESCALATION: { labelEn: 'Escalation', labelAr: 'تصعيد', color: 'text-red-700', bg: 'bg-red-50 border border-red-200' },
  STEP_DOWN:  { labelEn: 'Step-Down',  labelAr: 'تنازلي', color: 'text-blue-700', bg: 'bg-blue-50 border border-blue-200' },
  REGULAR:    { labelEn: 'Regular',    labelAr: 'عادي',   color: 'text-muted-foreground', bg: 'bg-muted/50 border border-border' },
};

const TRANSFER_URGENCY_CONFIG: Record<string, { labelEn: string; labelAr: string; color: string; bg: string }> = {
  ROUTINE:   { labelEn: 'Routine',   labelAr: 'روتيني', color: 'text-green-700',  bg: 'bg-green-50 border border-green-200' },
  URGENT:    { labelEn: 'Urgent',    labelAr: 'عاجل',   color: 'text-orange-700', bg: 'bg-orange-50 border border-orange-200' },
  EMERGENCY: { labelEn: 'Emergency', labelAr: 'طارئ',   color: 'text-red-700',    bg: 'bg-red-50 border border-red-200' },
};

const BED_STATUS_COLORS: Record<string, string> = {
  AVAILABLE: 'bg-green-100 border-green-300 text-green-800',
  OCCUPIED:  'bg-blue-100 border-blue-300 text-blue-800',
  RESERVED:  'bg-amber-100 border-amber-300 text-amber-800',
  INACTIVE:  'bg-muted border-border text-muted-foreground',
};

const PAYMENT_TYPE_CONFIG: Record<string, { label: (tr: any) => string; color: string; icon: ReactNode }> = {
  CASH: { label: (tr: any) => tr('نقدي', 'Cash'), color: 'bg-yellow-50 border-yellow-200 text-yellow-700', icon: <Banknote className="h-4 w-4 inline" /> },
  INSURANCE: { label: (tr: any) => tr('تأمين', 'Insurance'), color: 'bg-blue-50 border-blue-200 text-blue-700', icon: <Shield className="h-4 w-4 inline" /> },
  GOVERNMENT: { label: (tr: any) => tr('حكومي', 'Government'), color: 'bg-teal-50 border-teal-200 text-teal-700', icon: <Landmark className="h-4 w-4 inline" /> },
};

// ─── Helper Components ───────────────────────────────────────────────────────

function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${className || ''}`}>
      {children}
    </span>
  );
}

function StatusBadge({ status, lang }: { status: string; lang: string }) {
  const cfg = STATUS_CONFIG[status] || { labelEn: status, labelAr: status, color: 'text-muted-foreground', bg: 'bg-muted/50 border-border' };
  return <Badge className={`${cfg.bg} ${cfg.color}`}>{lang === 'ar' ? cfg.labelAr : cfg.labelEn}</Badge>;
}

function UrgencyBadge({ urgency, lang }: { urgency: string; lang: string }) {
  const cfg = URGENCY_CONFIG[urgency] || { labelEn: urgency, labelAr: urgency, color: 'text-muted-foreground', bg: 'bg-muted/50' };
  return <Badge className={`${cfg.bg} ${cfg.color}`}>{lang === 'ar' ? cfg.labelAr : cfg.labelEn}</Badge>;
}

function SourceBadge({ source, lang }: { source: string; lang: string }) {
  const cfg = SOURCE_CONFIG[source] || { labelEn: source, labelAr: source, color: 'bg-muted text-foreground' };
  return <Badge className={cfg.color}>{lang === 'ar' ? cfg.labelAr : cfg.labelEn}</Badge>;
}

function KpiCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string | number; accent?: string }) {
  return (
    <div className={`rounded-xl border p-4 flex items-center gap-3 ${accent || 'bg-card border-border'}`}>
      <div className="flex-shrink-0">{icon}</div>
      <div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex justify-center py-12">
      <RefreshCw className="w-6 h-6 text-muted-foreground animate-spin" />
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-12">
      <ClipboardCheck className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
      <p className="text-muted-foreground">{message}</p>
    </div>
  );
}

function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-center justify-between">
      <p className="text-red-700 text-sm">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="text-red-600 hover:text-red-800 text-sm font-medium">
          <RefreshCw className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

function getWaitTime(createdAt: string, lang: string): string {
  const diff = Date.now() - new Date(createdAt).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return lang === 'ar' ? `${mins} دقيقة` : `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remainMins = mins % 60;
  if (hrs < 24) return lang === 'ar' ? `${hrs} ساعة ${remainMins} د` : `${hrs}h ${remainMins}m`;
  const days = Math.floor(hrs / 24);
  return lang === 'ar' ? `${days} يوم` : `${days}d`;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function AdmissionOfficeDashboard() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const [activeTab, setActiveTab] = useState<'board' | 'new' | 'beds' | 'transfers' | 'analytics'>('board');

  const tabs = [
    { key: 'board' as const, labelAr: 'لوحة القبول', labelEn: 'Admission Board', icon: ClipboardCheck },
    { key: 'new' as const, labelAr: 'طلب جديد', labelEn: 'New Request', icon: Plus },
    { key: 'beds' as const, labelAr: 'خريطة الأسرّة', labelEn: 'Bed Map', icon: Bed },
    { key: 'transfers' as const, labelAr: 'تحويلات', labelEn: 'Ward Transfers', icon: ArrowRightLeft },
    { key: 'analytics' as const, labelAr: 'إحصائيات', labelEn: 'Analytics', icon: BarChart3 },
  ];

  return (
    <div className="p-6 space-y-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ClipboardCheck className="w-8 h-8 text-indigo-600" />
          <h1 className="text-2xl font-bold text-foreground">
            {tr('مكتب القبول', 'Admission Office')}
          </h1>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2.5 border-b-2 font-medium text-sm transition whitespace-nowrap ${
                  activeTab === tab.key
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="w-4 h-4" />
                {language === 'ar' ? tab.labelAr : tab.labelEn}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'board' && <AdmissionBoardTab language={language} tr={tr} />}
      {activeTab === 'new' && <NewRequestTab language={language} tr={tr} onCreated={() => setActiveTab('board')} />}
      {activeTab === 'beds' && <BedMapTab language={language} tr={tr} />}
      {activeTab === 'transfers' && <WardTransfersTab language={language} tr={tr} />}
      {activeTab === 'analytics' && <AnalyticsTab language={language} tr={tr} />}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// TAB 1: ADMISSION BOARD
// ═════════════════════════════════════════════════════════════════════════════

function AdmissionBoardTab({ language, tr }: { language: string; tr: (ar: string, en: string) => string }) {
  const [search, setSearch] = useState('');
  const [filterUrgency, setFilterUrgency] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading, error, mutate } = useSWR('/api/admission/requests?status=ALL', fetcher, {
    refreshInterval: 30000,
  });

  const requests: AdmissionRequest[] = data?.items || [];
  const stats = data?.stats || {};

  // Filter
  const filtered = useMemo(() => {
    return requests.filter((r) => {
      if (search) {
        const q = search.toLowerCase();
        if (!r.patientName.toLowerCase().includes(q) && !(r.mrn || '').toLowerCase().includes(q)) return false;
      }
      if (filterUrgency && r.urgency !== filterUrgency) return false;
      if (filterSource && r.source !== filterSource) return false;
      return true;
    });
  }, [requests, search, filterUrgency, filterSource]);

  // Group by status columns (exclude ADMITTED and CANCELLED)
  const columns = ['PENDING', 'INSURANCE_REVIEW', 'VERIFIED', 'BED_ASSIGNED'] as const;
  const grouped = useMemo(() => {
    const map: Record<string, AdmissionRequest[]> = {};
    for (const col of columns) map[col] = [];
    for (const r of filtered) {
      if (map[r.status]) map[r.status].push(r);
    }
    return map;
  }, [filtered]);

  if (isLoading) return <Spinner />;
  if (error) return <ErrorBanner message={tr('خطأ في تحميل الطلبات', 'Error loading requests')} onRetry={() => mutate()} />;

  return (
    <div className="space-y-4">
      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          icon={<Clock className="w-5 h-5 text-amber-600" />}
          label={tr('بانتظار', 'Pending')}
          value={stats.pendingCount || 0}
          accent="bg-amber-50 border-amber-200"
        />
        <KpiCard
          icon={<Timer className="w-5 h-5 text-blue-600" />}
          label={tr('متوسط الانتظار', 'Avg Wait')}
          value={`${stats.avgWaitMinutes || 0} ${tr('دقيقة', 'min')}`}
          accent="bg-blue-50 border-blue-200"
        />
        <KpiCard
          icon={<CheckCircle2 className="w-5 h-5 text-green-600" />}
          label={tr('تم قبولهم اليوم', 'Admitted Today')}
          value={stats.byStatus?.ADMITTED || 0}
          accent="bg-green-50 border-green-200"
        />
        <KpiCard
          icon={<XCircle className="w-5 h-5 text-red-600" />}
          label={tr('ملغى', 'Cancelled')}
          value={stats.byStatus?.CANCELLED || 0}
          accent="bg-red-50 border-red-200"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute top-2.5 left-3 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            className="w-full pl-10 pr-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            placeholder={tr('بحث بالاسم أو رقم الملف...', 'Search by name or MRN...')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="border border-border rounded-lg px-3 py-2 text-sm bg-card"
          value={filterUrgency}
          onChange={(e) => setFilterUrgency(e.target.value)}
        >
          <option value="">{tr('كل الأولويات', 'All Urgencies')}</option>
          <option value="EMERGENCY">{tr('طارئ', 'Emergency')}</option>
          <option value="URGENT">{tr('عاجل', 'Urgent')}</option>
          <option value="ELECTIVE">{tr('اختياري', 'Elective')}</option>
        </select>
        <select
          className="border border-border rounded-lg px-3 py-2 text-sm bg-card"
          value={filterSource}
          onChange={(e) => setFilterSource(e.target.value)}
        >
          <option value="">{tr('كل المصادر', 'All Sources')}</option>
          <option value="OPD">{tr('عيادات', 'OPD')}</option>
          <option value="ER">{tr('طوارئ', 'ER')}</option>
          <option value="SCHEDULED_OR">{tr('عملية مجدولة', 'Scheduled OR')}</option>
          <option value="EXTERNAL">{tr('تحويل خارجي', 'External')}</option>
          <option value="DIRECT">{tr('مباشر', 'Direct')}</option>
        </select>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {columns.map((colStatus) => {
          const cfg = STATUS_CONFIG[colStatus];
          const colItems = grouped[colStatus] || [];
          return (
            <div key={colStatus} className="bg-muted/50 rounded-xl p-3 min-h-[300px]">
              <div className="flex items-center justify-between mb-3">
                <h3 className={`text-sm font-semibold ${cfg.color}`}>
                  {language === 'ar' ? cfg.labelAr : cfg.labelEn}
                </h3>
                <span className="bg-card rounded-full px-2 py-0.5 text-xs font-medium text-muted-foreground border">
                  {colItems.length}
                </span>
              </div>
              <div className="space-y-2">
                {colItems.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    {tr('لا يوجد طلبات', 'No requests')}
                  </p>
                )}
                {colItems.map((req) => (
                  <button
                    key={req.id}
                    onClick={() => setSelectedId(req.id)}
                    className="w-full text-left bg-card rounded-lg border border-border p-3 hover:shadow-md transition cursor-pointer"
                  >
                    <div className="flex items-start justify-between mb-1">
                      <p className="font-medium text-sm text-foreground truncate">{req.patientName}</p>
                      <UrgencyBadge urgency={req.urgency} lang={language} />
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">
                      {req.mrn ? `MRN: ${req.mrn}` : ''} · {req.targetDepartment}
                    </p>
                    <div className="flex items-center justify-between">
                      <SourceBadge source={req.source} lang={language} />
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {getWaitTime(req.createdAt, language)}
                      </span>
                    </div>
                    {req.isolationRequired && (
                      <div className="mt-2 flex items-center gap-1 text-xs text-red-600">
                        <Shield className="w-3 h-3" />
                        {tr('يحتاج عزل', 'Isolation Required')}
                      </div>
                    )}
                    {/* Financial Badge */}
                    {req.paymentType && PAYMENT_TYPE_CONFIG[req.paymentType] && (
                      <span className={`mt-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${PAYMENT_TYPE_CONFIG[req.paymentType].color}`}>
                        {PAYMENT_TYPE_CONFIG[req.paymentType].icon} {PAYMENT_TYPE_CONFIG[req.paymentType].label(tr)}
                        {req.paymentType === 'INSURANCE' && req.insurerName && ` - ${req.insurerName}`}
                        {req.paymentType === 'CASH' && req.depositCollected ? ` - ${Number(req.depositCollected).toLocaleString()} ${tr('ر.س', 'SAR')}` : ''}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Detail Drawer */}
      {selectedId && (
        <RequestDetailDrawer
          requestId={selectedId}
          language={language}
          tr={tr}
          onClose={() => setSelectedId(null)}
          onAction={() => { mutate(); setSelectedId(null); }}
        />
      )}
    </div>
  );
}

// ─── Request Detail Drawer ───────────────────────────────────────────────────

function RequestDetailDrawer({
  requestId,
  language,
  tr,
  onClose,
  onAction,
}: {
  requestId: string;
  language: string;
  tr: (ar: string, en: string) => string;
  onClose: () => void;
  onAction: () => void;
}) {
  const { data, isLoading, mutate } = useSWR(`/api/admission/requests/${requestId}`, fetcher);
  const [acting, setActing] = useState('');
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);

  const request: AdmissionRequest | null = data?.request || null;
  const checklist: ChecklistData | null = data?.checklist || null;
  const availableBedCount: number = data?.availableBedCount || 0;

  const doAction = useCallback(
    async (action: string, url: string, body?: Record<string, unknown>) => {
      setActing(action);
      try {
        const res = await fetch(url, {
          method: body ? 'POST' : 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body || {}),
        });
        if (res.ok) {
          onAction();
        } else {
          const err = await res.json().catch(() => ({}));
          alert(err.error || tr('فشل تنفيذ الإجراء', 'Action failed'));
          mutate();
        }
      } catch {
        alert(tr('فشل تنفيذ الإجراء', 'Action failed'));
      } finally {
        setActing('');
      }
    },
    [onAction, mutate, tr]
  );

  const toggleChecklistItem = useCallback(
    async (itemKey: string, completed: boolean) => {
      if (!checklist) return;
      await fetch(`/api/admission/checklist/${checklist.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemKey, completed }),
      });
      mutate();
    },
    [checklist, mutate]
  );

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex justify-end">
      <div className="bg-card w-full max-w-xl shadow-2xl overflow-y-auto" dir={language === 'ar' ? 'rtl' : 'ltr'}>
        {/* Header */}
        <div className="sticky top-0 bg-card border-b px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-semibold text-foreground">
            {tr('تفاصيل طلب القبول', 'Admission Request Details')}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-muted-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        {isLoading && <Spinner />}

        {request && (
          <div className="p-6 space-y-6">
            {/* Patient Info */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-foreground">{request.patientName}</h3>
                <StatusBadge status={request.status} lang={language} />
              </div>
              {request.mrn && <p className="text-sm text-muted-foreground">MRN: {request.mrn}</p>}
              <div className="flex flex-wrap gap-2">
                <SourceBadge source={request.source} lang={language} />
                <UrgencyBadge urgency={request.urgency} lang={language} />
                {request.isolationRequired && (
                  <Badge className="bg-red-50 border-red-200 text-red-700">
                    <Shield className="w-3 h-3 mr-1" />
                    {tr('عزل', 'Isolation')}: {request.isolationType || tr('نعم', 'Yes')}
                  </Badge>
                )}
              </div>
            </div>

            {/* Clinical Details */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">{tr('القسم المستهدف', 'Target Dept')}</p>
                <p className="font-medium">{request.targetDepartment}</p>
              </div>
              <div>
                <p className="text-muted-foreground">{tr('نوع السرير', 'Bed Type')}</p>
                <p className="font-medium">{request.bedType}</p>
              </div>
              <div>
                <p className="text-muted-foreground">{tr('الطبيب الطالب', 'Requesting Dr')}</p>
                <p className="font-medium">{request.requestingDoctorName || '-'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">{tr('طبيب القبول', 'Admitting Dr')}</p>
                <p className="font-medium">{request.admittingDoctorName || '-'}</p>
              </div>
              {request.primaryDiagnosis && (
                <div className="col-span-2">
                  <p className="text-muted-foreground">{tr('التشخيص الأولي', 'Primary Diagnosis')}</p>
                  <p className="font-medium">{request.primaryDiagnosis}</p>
                </div>
              )}
              {request.reasonForAdmission && (
                <div className="col-span-2">
                  <p className="text-muted-foreground">{tr('سبب القبول', 'Reason for Admission')}</p>
                  <p className="font-medium">{request.reasonForAdmission}</p>
                </div>
              )}
              {request.clinicalSummary && (
                <div className="col-span-2">
                  <p className="text-muted-foreground">{tr('الملخص السريري', 'Clinical Summary')}</p>
                  <p className="text-foreground text-xs bg-muted/50 rounded p-2">{request.clinicalSummary}</p>
                </div>
              )}
            </div>

            {/* Allergies */}
            {Array.isArray(request.allergies) && request.allergies.length > 0 && (
              <div>
                <p className="text-sm font-medium text-red-600 mb-1">
                  <AlertTriangle className="w-4 h-4 inline mr-1" />
                  {tr('الحساسية', 'Allergies')}
                </p>
                <div className="flex flex-wrap gap-1">
                  {request.allergies.map((a: any, i: number) => (
                    <Badge key={i} className="bg-red-50 border-red-200 text-red-700">
                      {a.allergen} {a.severity ? `(${a.severity})` : ''}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Checklist */}
            {checklist && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-foreground">
                    {tr('قائمة التحقق', 'Pre-Admission Checklist')}
                  </h4>
                  <span className="text-xs text-muted-foreground">
                    {checklist.completionPercentage}%
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-1.5 mb-3">
                  <div
                    className="bg-indigo-500 h-1.5 rounded-full transition-all"
                    style={{ width: `${checklist.completionPercentage}%` }}
                  />
                </div>
                <div className="space-y-1">
                  {checklist.items.map((item: ChecklistItem) => (
                    <label
                      key={item.key}
                      className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted/50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={item.completed}
                        onChange={(e) => toggleChecklistItem(item.key, e.target.checked)}
                        className="rounded border-border text-indigo-600 focus:ring-indigo-500"
                        disabled={request.status === 'ADMITTED' || request.status === 'CANCELLED'}
                      />
                      <span className={`text-sm flex-1 ${item.completed ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                        {language === 'ar' ? item.labelAr : item.labelEn}
                        {item.required && <span className="text-red-500 ml-1">*</span>}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* ── Financial Details ─────────────────────────────────── */}
            {request?.paymentType && (
              <div className="space-y-3 rounded-lg border p-4">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  {PAYMENT_TYPE_CONFIG[request.paymentType]?.icon}
                  {tr('التفاصيل المالية', 'Financial Details')}
                </h4>

                {/* Insurance */}
                {request.paymentType === 'INSURANCE' && (
                  <div className="space-y-2 text-sm">
                    {request.insurerName && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{tr('شركة التأمين', 'Insurer')}</span>
                        <span className="font-medium">{request.insurerName}</span>
                      </div>
                    )}
                    {request.policyNumber && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{tr('رقم البوليصة', 'Policy #')}</span>
                        <span>{request.policyNumber}</span>
                      </div>
                    )}
                    {request.memberId && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{tr('رقم العضوية', 'Member ID')}</span>
                        <span>{request.memberId}</span>
                      </div>
                    )}
                    {/* Eligibility */}
                    <div className="flex justify-between items-center border-t pt-2 mt-2">
                      <span className="text-muted-foreground">{tr('الأهلية', 'Eligibility')}</span>
                      <div className="flex items-center gap-2">
                        {request.eligibilityStatus === 'ELIGIBLE' && (
                          <span className="inline-flex items-center rounded-full bg-green-50 border border-green-200 px-2 py-0.5 text-xs text-green-700">{tr('مؤهل', 'Eligible')}</span>
                        )}
                        {request.eligibilityStatus === 'NOT_ELIGIBLE' && (
                          <span className="inline-flex items-center rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-xs text-red-700">{tr('غير مؤهل', 'Not Eligible')}</span>
                        )}
                        {!request.eligibilityStatus && (
                          <button
                            className="px-3 py-1 border border-border rounded-lg text-xs font-medium hover:bg-muted/50 transition"
                            onClick={async () => {
                              try {
                                await fetch(`/api/admission/requests/${request.id}/verify-insurance`, { method: 'POST', credentials: 'include' });
                                mutate();
                              } catch {}
                            }}
                          >
                            {tr('التحقق', 'Verify')}
                          </button>
                        )}
                      </div>
                    </div>
                    {/* Pre-auth */}
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">{tr('الموافقة المسبقة', 'Pre-Auth')}</span>
                      <div className="flex items-center gap-2">
                        {request.preauthStatus === 'APPROVED' && (
                          <span className="inline-flex items-center rounded-full bg-green-50 border border-green-200 px-2 py-0.5 text-xs text-green-700">{request.preauthNumber || tr('موافق', 'Approved')}</span>
                        )}
                        {request.preauthStatus === 'DENIED' && (
                          <span className="inline-flex items-center rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-xs text-red-700">{tr('مرفوض', 'Denied')}</span>
                        )}
                        {request.eligibilityStatus === 'ELIGIBLE' && !request.preauthStatus && (
                          <button
                            className="px-3 py-1 border border-border rounded-lg text-xs font-medium hover:bg-muted/50 transition"
                            onClick={async () => {
                              try {
                                await fetch(`/api/admission/requests/${request.id}/request-preauth`, {
                                  method: 'POST',
                                  credentials: 'include',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({}),
                                });
                                mutate();
                              } catch {}
                            }}
                          >
                            {tr('طلب موافقة', 'Request')}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Cash */}
                {request.paymentType === 'CASH' && (
                  <div className="space-y-2 text-sm">
                    {request.estimatedCost != null && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{tr('التكلفة التقديرية', 'Estimated Cost')}</span>
                        <span>{Number(request.estimatedCost).toLocaleString()} {tr('ر.س', 'SAR')}</span>
                      </div>
                    )}
                    {request.depositRequired != null && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{tr('الإيداع المطلوب', 'Deposit Required')}</span>
                          <span className="font-medium">{Number(request.depositRequired).toLocaleString()} {tr('ر.س', 'SAR')}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{tr('تم تحصيله', 'Collected')}</span>
                          <span className={Number(request.depositCollected || 0) >= Number(request.depositRequired) ? 'text-green-600 font-medium' : 'text-orange-600 font-medium'}>
                            {Number(request.depositCollected || 0).toLocaleString()} {tr('ر.س', 'SAR')}
                          </span>
                        </div>
                        {/* Progress bar */}
                        <div className="w-full bg-muted rounded-full h-2 mt-1">
                          <div
                            className={`h-2 rounded-full transition-all ${Number(request.depositCollected || 0) >= Number(request.depositRequired) ? 'bg-green-500' : 'bg-orange-400'}`}
                            style={{ width: `${Math.min(100, (Number(request.depositCollected || 0) / Number(request.depositRequired)) * 100)}%` }}
                          />
                        </div>
                      </>
                    )}
                    {/* Collect deposit button */}
                    {request.status !== 'ADMITTED' && request.status !== 'CANCELLED' && (
                      <button
                        className="w-full mt-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition"
                        onClick={() => setShowPaymentDialog(true)}
                      >
                        {tr('تحصيل إيداع', 'Collect Deposit')}
                      </button>
                    )}
                    {request.depositReceiptNumber && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {tr('إيصال', 'Receipt')}: {request.depositReceiptNumber}
                      </div>
                    )}
                  </div>
                )}

                {/* Government */}
                {request.paymentType === 'GOVERNMENT' && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="inline-flex items-center rounded-full bg-teal-50 border border-teal-200 px-2 py-0.5 text-xs text-teal-700">{tr('مموّل حكومياً — تمت الموافقة تلقائياً', 'Government-funded — Auto-approved')}</span>
                  </div>
                )}
              </div>
            )}

            {/* Bed Info */}
            {request.status !== 'ADMITTED' && request.status !== 'CANCELLED' && (
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-sm text-muted-foreground">
                  <Bed className="w-4 h-4 inline mr-1" />
                  {tr('أسرّة متاحة في القسم', 'Available beds in dept')}: <strong>{availableBedCount}</strong>
                </p>
              </div>
            )}

            {/* Actions */}
            {request.status !== 'ADMITTED' && request.status !== 'CANCELLED' && (
              <div className="flex flex-wrap gap-2 pt-4 border-t">
                {(request.status === 'PENDING' || request.status === 'INSURANCE_REVIEW') && (
                  <button
                    onClick={() => doAction('verify', `/api/admission/requests/${request.id}/verify`)}
                    disabled={!!acting}
                    className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {acting === 'verify' ? tr('جاري...', 'Verifying...') : tr('تحقق وموافقة', 'Verify')}
                  </button>
                )}
                {(request.status === 'VERIFIED' || request.status === 'BED_ASSIGNED') && (
                  <button
                    onClick={() => doAction('admit', `/api/admission/requests/${request.id}/admit`)}
                    disabled={!!acting}
                    className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                  >
                    {acting === 'admit' ? tr('جاري...', 'Admitting...') : tr('قبول المريض', 'Admit Patient')}
                  </button>
                )}
                <button
                  onClick={() => {
                    const reason = prompt(tr('سبب الإلغاء:', 'Cancel reason:'));
                    if (reason !== null) {
                      doAction('cancel', `/api/admission/requests/${request.id}/cancel`, { cancelReason: reason });
                    }
                  }}
                  disabled={!!acting}
                  className="px-4 py-2 border border-red-300 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 disabled:opacity-50"
                >
                  {tr('إلغاء', 'Cancel')}
                </button>
              </div>
            )}

            {request.status === 'ADMITTED' && request.episodeId && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                <CheckCircle2 className="w-6 h-6 text-green-600 mx-auto mb-1" />
                <p className="text-sm text-green-700 font-medium">{tr('تم قبول المريض بنجاح', 'Patient admitted successfully')}</p>
                <a
                  href={`/ipd/episode/${request.episodeId}`}
                  className="text-sm text-indigo-600 hover:underline mt-1 inline-block"
                >
                  {tr('عرض الحلقة', 'View Episode')} →
                </a>
              </div>
            )}

            {request.status === 'CANCELLED' && (
              <div className="bg-muted/50 border border-border rounded-lg p-3 text-center">
                <XCircle className="w-6 h-6 text-muted-foreground mx-auto mb-1" />
                <p className="text-sm text-muted-foreground">{tr('تم الإلغاء', 'Cancelled')}</p>
                {request.cancelReason && (
                  <p className="text-xs text-muted-foreground mt-1">{request.cancelReason}</p>
                )}
              </div>
            )}

            {/* Payment Dialog */}
            {showPaymentDialog && request && (
              <AdmissionPaymentDialog
                open={showPaymentDialog}
                onOpenChange={setShowPaymentDialog}
                requestId={request.id}
                patientName={request.patientName}
                mrn={request.mrn}
                estimatedCost={request.estimatedCost ? Number(request.estimatedCost) : undefined}
                depositRequired={request.depositRequired ? Number(request.depositRequired) : undefined}
                depositCollected={request.depositCollected ? Number(request.depositCollected) : undefined}
                onSuccess={() => mutate()}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// TAB 2: NEW REQUEST
// ═════════════════════════════════════════════════════════════════════════════

function NewRequestTab({
  language,
  tr,
  onCreated,
}: {
  language: string;
  tr: (ar: string, en: string) => string;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    source: 'DIRECT',
    patientMasterId: '',
    patientName: '',
    mrn: '',
    requestingDoctorId: '',
    requestingDoctorName: '',
    admittingDoctorId: '',
    admittingDoctorName: '',
    targetDepartment: '',
    targetUnit: '',
    urgency: 'ELECTIVE',
    bedType: 'GENERAL',
    primaryDiagnosis: '',
    primaryDiagnosisCode: '',
    clinicalSummary: '',
    reasonForAdmission: '',
    isolationRequired: false,
    isolationType: '',
    expectedLOS: '',
    paymentType: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Patient search
  const [patientSearch, setPatientSearch] = useState('');
  const { data: patientResults } = useSWR(
    patientSearch.length >= 2 ? `/api/patients/search?q=${encodeURIComponent(patientSearch)}&limit=10` : null,
    fetcher
  );

  // Doctor search
  const [doctorSearch, setDoctorSearch] = useState('');
  const { data: doctorResults } = useSWR(
    doctorSearch.length >= 2 ? `/api/admin/users?search=${encodeURIComponent(doctorSearch)}&limit=10` : null,
    fetcher
  );

  const set = (key: string, val: unknown) => setForm((f) => ({ ...f, [key]: val }));

  const handleSubmit = async () => {
    setError('');
    if (!form.patientMasterId) {
      setError(tr('يرجى اختيار المريض', 'Please select a patient'));
      return;
    }
    if (!form.requestingDoctorId) {
      setError(tr('يرجى اختيار الطبيب الطالب', 'Please select requesting doctor'));
      return;
    }
    if (!form.targetDepartment) {
      setError(tr('يرجى تحديد القسم', 'Please select target department'));
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/admission/requests', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          expectedLOS: form.expectedLOS ? parseInt(form.expectedLOS, 10) : null,
          patientName: form.patientName,
          mrn: form.mrn,
          requestingDoctorName: form.requestingDoctorName,
          admittingDoctorName: form.admittingDoctorName,
          paymentType: form.paymentType || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed');
      }
      onCreated();
    } catch (err: any) {
      setError(err.message || tr('فشل في إنشاء الطلب', 'Failed to create request'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-card rounded-xl border p-6 space-y-5">
      <h2 className="text-lg font-semibold text-foreground">
        {tr('طلب قبول جديد', 'New Admission Request')}
      </h2>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>
      )}

      {/* Source */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">{tr('مصدر الطلب', 'Request Source')}</label>
        <div className="flex flex-wrap gap-2">
          {Object.entries(SOURCE_CONFIG).map(([key, cfg]) => (
            <button
              key={key}
              type="button"
              onClick={() => set('source', key)}
              className={`px-3 py-1.5 rounded-lg text-sm border transition ${
                form.source === key
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-card text-muted-foreground border-border hover:bg-muted/50'
              }`}
            >
              {language === 'ar' ? cfg.labelAr : cfg.labelEn}
            </button>
          ))}
        </div>
      </div>

      {/* Patient Search */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">{tr('المريض *', 'Patient *')}</label>
        {form.patientMasterId ? (
          <div className="flex items-center justify-between bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2">
            <span className="text-sm text-indigo-800 font-medium">{form.patientName} {form.mrn ? `(${form.mrn})` : ''}</span>
            <button onClick={() => { set('patientMasterId', ''); set('patientName', ''); set('mrn', ''); }} className="text-indigo-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="relative">
            <input
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              placeholder={tr('ابحث بالاسم أو رقم الملف...', 'Search by name or MRN...')}
              value={patientSearch}
              onChange={(e) => setPatientSearch(e.target.value)}
            />
            {patientResults?.items?.length > 0 && (
              <div className="absolute z-20 w-full mt-1 bg-card border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {patientResults.items.map((p: any) => (
                  <button
                    key={p.id}
                    className="w-full text-left px-3 py-2 hover:bg-muted/50 text-sm border-b last:border-0"
                    onClick={() => {
                      set('patientMasterId', p.id);
                      set('patientName', p.fullName || p.firstName || '');
                      set('mrn', p.mrn || '');
                      setPatientSearch('');
                    }}
                  >
                    <span className="font-medium">{p.fullName || p.firstName}</span>
                    {p.mrn && <span className="text-muted-foreground ml-2">MRN: {p.mrn}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Doctor Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">{tr('الطبيب الطالب *', 'Requesting Doctor *')}</label>
          {form.requestingDoctorId ? (
            <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
              <span className="text-sm text-blue-800">{form.requestingDoctorName}</span>
              <button onClick={() => { set('requestingDoctorId', ''); set('requestingDoctorName', ''); }} className="text-blue-600">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="relative">
              <input
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                placeholder={tr('ابحث عن طبيب...', 'Search doctor...')}
                value={doctorSearch}
                onChange={(e) => setDoctorSearch(e.target.value)}
              />
              {doctorResults?.items?.length > 0 && (
                <div className="absolute z-20 w-full mt-1 bg-card border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {doctorResults.items.map((d: any) => (
                    <button
                      key={d.id}
                      className="w-full text-left px-3 py-2 hover:bg-muted/50 text-sm border-b last:border-0"
                      onClick={() => {
                        set('requestingDoctorId', d.id);
                        set('requestingDoctorName', d.displayName || `${d.firstName || ''} ${d.lastName || ''}`.trim());
                        setDoctorSearch('');
                      }}
                    >
                      {d.displayName || d.firstName} {d.lastName || ''}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">{tr('طبيب القبول', 'Admitting Doctor')}</label>
          <input
            className="w-full border border-border rounded-lg px-3 py-2 text-sm"
            placeholder={tr('اسم طبيب القبول', 'Admitting doctor name')}
            value={form.admittingDoctorName}
            onChange={(e) => set('admittingDoctorName', e.target.value)}
          />
        </div>
      </div>

      {/* Department + Urgency + Bed Type */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">{tr('القسم المستهدف *', 'Target Department *')}</label>
          <input
            className="w-full border border-border rounded-lg px-3 py-2 text-sm"
            placeholder={tr('مثال: الباطنة', 'e.g., Internal Medicine')}
            value={form.targetDepartment}
            onChange={(e) => set('targetDepartment', e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">{tr('الاستعجال', 'Urgency')}</label>
          <select
            className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card"
            value={form.urgency}
            onChange={(e) => set('urgency', e.target.value)}
          >
            <option value="ELECTIVE">{tr('اختياري', 'Elective')}</option>
            <option value="URGENT">{tr('عاجل', 'Urgent')}</option>
            <option value="EMERGENCY">{tr('طارئ', 'Emergency')}</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">{tr('نوع السرير', 'Bed Type')}</label>
          <select
            className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card"
            value={form.bedType}
            onChange={(e) => set('bedType', e.target.value)}
          >
            <option value="GENERAL">{tr('عادي', 'General')}</option>
            <option value="ICU">{tr('عناية مركزة', 'ICU')}</option>
            <option value="ISOLATION">{tr('عزل', 'Isolation')}</option>
            <option value="VIP">VIP</option>
            <option value="NICU">{tr('حضانة', 'NICU')}</option>
            <option value="PICU">{tr('عناية أطفال', 'PICU')}</option>
          </select>
        </div>
      </div>

      {/* Diagnosis */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">{tr('التشخيص الأولي', 'Primary Diagnosis')}</label>
        <input
          className="w-full border border-border rounded-lg px-3 py-2 text-sm"
          placeholder={tr('التشخيص المبدئي', 'Initial diagnosis')}
          value={form.primaryDiagnosis}
          onChange={(e) => set('primaryDiagnosis', e.target.value)}
        />
      </div>

      {/* Reason + Clinical Summary */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">{tr('سبب القبول', 'Reason for Admission')}</label>
        <textarea
          className="w-full border border-border rounded-lg px-3 py-2 text-sm"
          rows={2}
          placeholder={tr('سبب التنويم', 'Why is admission needed?')}
          value={form.reasonForAdmission}
          onChange={(e) => set('reasonForAdmission', e.target.value)}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">{tr('الملخص السريري', 'Clinical Summary')}</label>
        <textarea
          className="w-full border border-border rounded-lg px-3 py-2 text-sm"
          rows={3}
          placeholder={tr('ملخص الحالة السريرية', 'Clinical summary of the case')}
          value={form.clinicalSummary}
          onChange={(e) => set('clinicalSummary', e.target.value)}
        />
      </div>

      {/* Isolation + LOS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-foreground">
            <input
              type="checkbox"
              checked={form.isolationRequired}
              onChange={(e) => set('isolationRequired', e.target.checked)}
              className="rounded border-border text-indigo-600"
            />
            {tr('يحتاج عزل', 'Isolation Required')}
          </label>
          {form.isolationRequired && (
            <input
              className="w-full border border-border rounded-lg px-3 py-2 text-sm mt-2"
              placeholder={tr('نوع العزل', 'Isolation type')}
              value={form.isolationType}
              onChange={(e) => set('isolationType', e.target.value)}
            />
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">{tr('مدة الإقامة المتوقعة (أيام)', 'Expected LOS (days)')}</label>
          <input
            type="number"
            min="1"
            className="w-full border border-border rounded-lg px-3 py-2 text-sm"
            value={form.expectedLOS}
            onChange={(e) => set('expectedLOS', e.target.value)}
          />
        </div>
      </div>

      {/* ── Payment Type ────────────────────────────────────────── */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-foreground">{tr('نوع الدفع', 'Payment Type')}</label>
        <div className="grid grid-cols-3 gap-2">
          {(['CASH', 'INSURANCE', 'GOVERNMENT'] as const).map((pt) => {
            const config = PAYMENT_TYPE_CONFIG[pt];
            return (
              <button
                key={pt}
                type="button"
                onClick={() => set('paymentType', pt)}
                className={`flex flex-col items-center gap-1 rounded-lg border-2 p-3 text-xs transition-colors ${
                  form.paymentType === pt
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-semibold'
                    : 'border-border hover:border-border'
                }`}
              >
                <span className="text-lg">{config.icon}</span>
                {config.label(tr)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={saving}
        className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition"
      >
        {saving ? tr('جاري الإنشاء...', 'Creating...') : tr('إنشاء طلب القبول', 'Create Admission Request')}
      </button>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// TAB 3: BED MAP
// ═════════════════════════════════════════════════════════════════════════════

function BedMapTab({ language, tr }: { language: string; tr: (ar: string, en: string) => string }) {
  const [filterWard, setFilterWard] = useState('');
  const { data, isLoading, error, mutate } = useSWR(
    `/api/admission/available-beds${filterWard ? `?ward=${encodeURIComponent(filterWard)}` : ''}`,
    fetcher,
    { refreshInterval: 15000 }
  );

  const wards: WardGroup[] = data?.wards || [];
  const summary = data?.summary || { total: 0, available: 0, occupied: 0, reserved: 0, inactive: 0, occupancyRate: 0 };

  // For reservation
  const [reservingBedId, setReservingBedId] = useState<string | null>(null);
  const { data: pendingRequests } = useSWR(
    reservingBedId ? '/api/admission/requests?status=VERIFIED' : null,
    fetcher
  );

  const handleReserve = async (admissionRequestId: string) => {
    if (!reservingBedId) return;
    try {
      const res = await fetch('/api/admission/bed-reservation', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admissionRequestId, bedId: reservingBedId }),
      });
      if (res.ok) {
        setReservingBedId(null);
        mutate();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || tr('فشل', 'Failed'));
      }
    } catch {
      alert(tr('فشل حجز السرير', 'Bed reservation failed'));
    }
  };

  if (isLoading) return <Spinner />;
  if (error) return <ErrorBanner message={tr('خطأ في تحميل الأسرّة', 'Error loading beds')} onRetry={() => mutate()} />;

  const allWardNames = wards.map((w) => w.ward);

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard icon={<Bed className="w-5 h-5 text-muted-foreground" />} label={tr('إجمالي', 'Total')} value={summary.total} />
        <KpiCard icon={<CheckCircle2 className="w-5 h-5 text-green-600" />} label={tr('متاح', 'Available')} value={summary.available} accent="bg-green-50 border-green-200" />
        <KpiCard icon={<Users className="w-5 h-5 text-blue-600" />} label={tr('مشغول', 'Occupied')} value={summary.occupied} accent="bg-blue-50 border-blue-200" />
        <KpiCard icon={<Clock className="w-5 h-5 text-amber-600" />} label={tr('محجوز', 'Reserved')} value={summary.reserved} accent="bg-amber-50 border-amber-200" />
        <KpiCard icon={<Activity className="w-5 h-5 text-indigo-600" />} label={tr('نسبة الإشغال', 'Occupancy')} value={`${summary.occupancyRate}%`} accent="bg-indigo-50 border-indigo-200" />
      </div>

      {/* Ward Filter */}
      <div className="flex items-center gap-3">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <select
          className="border border-border rounded-lg px-3 py-2 text-sm bg-card"
          value={filterWard}
          onChange={(e) => setFilterWard(e.target.value)}
        >
          <option value="">{tr('كل الأجنحة', 'All Wards')}</option>
          {allWardNames.map((w) => (
            <option key={w} value={w}>{w}</option>
          ))}
        </select>
      </div>

      {/* Ward Sections */}
      {wards.length === 0 && <EmptyState message={tr('لا توجد أسرّة', 'No beds found')} />}
      {wards.map((ward) => (
        <div key={ward.ward} className="border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-500" />
              {ward.ward}
            </h3>
            <div className="flex gap-3 text-xs text-muted-foreground">
              <span className="text-green-600">{tr('متاح', 'Avail')}: {ward.available}</span>
              <span className="text-blue-600">{tr('مشغول', 'Occ')}: {ward.occupied}</span>
              <span className="text-amber-600">{tr('محجوز', 'Res')}: {ward.reserved}</span>
            </div>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
            {ward.beds.map((bed) => (
              <button
                key={bed.id}
                onClick={() => {
                  if (bed.status === 'AVAILABLE') setReservingBedId(bed.id);
                }}
                disabled={bed.status !== 'AVAILABLE'}
                className={`rounded-lg border p-2 text-center transition ${BED_STATUS_COLORS[bed.status]} ${
                  bed.status === 'AVAILABLE' ? 'hover:shadow-md cursor-pointer' : 'cursor-default'
                }`}
              >
                <p className="text-xs font-bold">{bed.bedLabel || bed.id.slice(0, 6)}</p>
                <p className="text-[10px] mt-0.5">
                  {bed.status === 'OCCUPIED' && bed.occupant
                    ? bed.occupant.patientName.split(' ')[0]
                    : bed.status === 'RESERVED'
                    ? tr('محجوز', 'Reserved')
                    : bed.status === 'INACTIVE'
                    ? tr('معطل', 'Off')
                    : tr('متاح', 'Open')}
                </p>
                {bed.room && <p className="text-[10px] text-muted-foreground">{bed.room}</p>}
              </button>
            ))}
          </div>
        </div>
      ))}

      {/* Reservation Dialog */}
      {reservingBedId && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-lg font-semibold">{tr('حجز سرير', 'Reserve Bed')}</h3>
              <button onClick={() => setReservingBedId(null)} className="text-muted-foreground hover:text-muted-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-3">
              <p className="text-sm text-muted-foreground">{tr('اختر طلب القبول لربط السرير به:', 'Select admission request to link:')}</p>
              {pendingRequests?.items?.length > 0 ? (
                pendingRequests.items.map((req: any) => (
                  <button
                    key={req.id}
                    onClick={() => handleReserve(req.id)}
                    className="w-full text-left border rounded-lg p-3 hover:bg-indigo-50 transition"
                  >
                    <p className="font-medium text-sm">{req.patientName}</p>
                    <p className="text-xs text-muted-foreground">{req.targetDepartment} · {req.urgency}</p>
                  </button>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">{tr('لا توجد طلبات محققة للربط', 'No verified requests to link')}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// TAB 4: WARD TRANSFERS
// ═════════════════════════════════════════════════════════════════════════════

function WardTransfersTab({ language, tr }: { language: string; tr: (ar: string, en: string) => string }) {
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [urgencyFilter, setUrgencyFilter] = useState('ALL');
  const [acting, setActing] = useState('');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [expandedSbar, setExpandedSbar] = useState<Record<string, boolean>>({});

  const transferUrl = `/api/admission/ward-transfer?status=ALL${typeFilter !== 'ALL' ? `&transferType=${typeFilter}` : ''}${urgencyFilter !== 'ALL' ? `&urgency=${urgencyFilter}` : ''}`;
  const { data, isLoading, error, mutate } = useSWR(transferUrl, fetcher);
  const transfers: WardTransfer[] = data?.items || [];

  const doTransferAction = async (transferId: string, action: string, extra?: Record<string, unknown>) => {
    setActing(`${transferId}-${action}`);
    try {
      const res = await fetch(`/api/admission/ward-transfer/${transferId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      });
      if (res.ok) {
        mutate();
        setRejectingId(null);
        setRejectReason('');
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || tr('فشل', 'Failed'));
      }
    } catch {
      alert(tr('فشل تنفيذ الإجراء', 'Action failed'));
    } finally {
      setActing('');
    }
  };

  const toggleSbar = (id: string) => {
    setExpandedSbar((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (isLoading) return <Spinner />;
  if (error) return <ErrorBanner message={tr('خطأ في تحميل التحويلات', 'Error loading transfers')} onRetry={() => mutate()} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-semibold text-foreground">{tr('طلبات التحويل', 'Transfer Requests')}</h2>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Transfer Type Filter */}
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-muted-foreground font-medium">{tr('النوع', 'Type')}</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="text-sm border border-border rounded-md px-2 py-1.5 bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-300"
            >
              <option value="ALL">{tr('الكل', 'All')}</option>
              <option value="ESCALATION">{tr('تصعيد', 'Escalation')}</option>
              <option value="STEP_DOWN">{tr('تنازلي', 'Step-Down')}</option>
              <option value="REGULAR">{tr('عادي', 'Regular')}</option>
            </select>
          </div>
          {/* Urgency Filter */}
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-muted-foreground font-medium">{tr('الأولوية', 'Urgency')}</label>
            <select
              value={urgencyFilter}
              onChange={(e) => setUrgencyFilter(e.target.value)}
              className="text-sm border border-border rounded-md px-2 py-1.5 bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-300"
            >
              <option value="ALL">{tr('الكل', 'All')}</option>
              <option value="ROUTINE">{tr('روتيني', 'Routine')}</option>
              <option value="URGENT">{tr('عاجل', 'Urgent')}</option>
              <option value="EMERGENCY">{tr('طارئ', 'Emergency')}</option>
            </select>
          </div>
        </div>
      </div>

      {transfers.length === 0 && <EmptyState message={tr('لا توجد تحويلات', 'No transfer requests')} />}

      <div className="space-y-3">
        {transfers.map((t) => {
          const statusCfg = TRANSFER_STATUS[t.status] || TRANSFER_STATUS.REQUESTED;
          const typeCfg = TRANSFER_TYPE_CONFIG[t.transferType] || TRANSFER_TYPE_CONFIG.REGULAR;
          const urgCfg = TRANSFER_URGENCY_CONFIG[t.urgency] || TRANSFER_URGENCY_CONFIG.ROUTINE;

          return (
            <div key={t.id} className="bg-card border rounded-lg p-4">
              {/* Header row: patient name + badges */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-foreground">{t.patientName}</p>
                    {/* Transfer Type badge */}
                    <Badge className={`${typeCfg.bg} ${typeCfg.color}`}>
                      {language === 'ar' ? typeCfg.labelAr : typeCfg.labelEn}
                    </Badge>
                    {/* Urgency badge */}
                    <Badge className={`${urgCfg.bg} ${urgCfg.color}`}>
                      {language === 'ar' ? urgCfg.labelAr : urgCfg.labelEn}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t.fromWard || '?'} {t.fromBed ? `(${t.fromBed})` : ''} → {t.toWard} {t.toUnit ? `(${t.toUnit})` : ''}
                  </p>
                </div>
                <Badge className={`${statusCfg.bg} ${statusCfg.color}`}>
                  {language === 'ar' ? statusCfg.labelAr : statusCfg.labelEn}
                </Badge>
              </div>

              <p className="text-sm text-muted-foreground mb-3">{t.reason}</p>

              {/* Acuity scores for ESCALATION / STEP_DOWN */}
              {t.acuityData && (t.transferType === 'ESCALATION' || t.transferType === 'STEP_DOWN') && (
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <span className="text-xs text-muted-foreground font-medium">{tr('مؤشرات الحدة', 'Acuity')}:</span>
                  {t.acuityData.sofa != null && (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                      t.acuityData.sofa >= 6 ? 'bg-red-100 text-red-800' : t.acuityData.sofa >= 3 ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'
                    }`}>
                      SOFA: {t.acuityData.sofa}
                    </span>
                  )}
                  {t.acuityData.mews != null && (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                      t.acuityData.mews >= 5 ? 'bg-red-100 text-red-800' : t.acuityData.mews >= 3 ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'
                    }`}>
                      MEWS: {t.acuityData.mews}
                    </span>
                  )}
                  {t.acuityData.gcs != null && (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                      t.acuityData.gcs <= 8 ? 'bg-red-100 text-red-800' : t.acuityData.gcs <= 12 ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'
                    }`}>
                      GCS: {t.acuityData.gcs}
                    </span>
                  )}
                </div>
              )}

              {/* SBAR summary (collapsible) */}
              {t.sbarData && (
                <div className="mb-3">
                  <button
                    onClick={() => toggleSbar(t.id)}
                    className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800"
                  >
                    {expandedSbar[t.id] ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    SBAR
                  </button>
                  {expandedSbar[t.id] && (
                    <div className="mt-1.5 bg-indigo-50 border border-indigo-200 rounded-md p-3 text-sm text-foreground space-y-1">
                      {t.sbarData.situation && (
                        <p><span className="font-semibold text-indigo-700">{tr('الموقف', 'Situation')}:</span> {t.sbarData.situation}</p>
                      )}
                      {t.sbarData.background && (
                        <p><span className="font-semibold text-indigo-700">{tr('الخلفية', 'Background')}:</span> {t.sbarData.background}</p>
                      )}
                      {t.sbarData.assessment && (
                        <p><span className="font-semibold text-indigo-700">{tr('التقييم', 'Assessment')}:</span> {t.sbarData.assessment}</p>
                      )}
                      {t.sbarData.recommendation && (
                        <p><span className="font-semibold text-indigo-700">{tr('التوصية', 'Recommendation')}:</span> {t.sbarData.recommendation}</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Rejection reason for REJECTED status */}
              {t.status === 'REJECTED' && t.rejectionReason && (
                <div className="mb-3 bg-red-50 border border-red-200 rounded-md p-3">
                  <p className="text-xs font-semibold text-red-700 mb-0.5">{tr('سبب الرفض', 'Rejection Reason')}</p>
                  <p className="text-sm text-red-600">{t.rejectionReason}</p>
                </div>
              )}

              {/* Timeline */}
              <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3 flex-wrap">
                <span>{tr('طلب', 'Req')}: {new Date(t.requestedAt).toLocaleDateString()}</span>
                {t.approvedAt && (
                  <>
                    <ChevronRight className="w-3 h-3" />
                    <span>{tr('موافقة', 'Appr')}: {new Date(t.approvedAt).toLocaleDateString()}</span>
                  </>
                )}
                {t.rejectedAt && (
                  <>
                    <ChevronRight className="w-3 h-3" />
                    <span className="text-red-500">{tr('رفض', 'Rej')}: {new Date(t.rejectedAt).toLocaleDateString()}</span>
                  </>
                )}
                {t.completedAt && (
                  <>
                    <ChevronRight className="w-3 h-3" />
                    <span>{tr('اكتمل', 'Done')}: {new Date(t.completedAt).toLocaleDateString()}</span>
                  </>
                )}
              </div>

              {/* Actions */}
              {t.status !== 'COMPLETED' && t.status !== 'CANCELLED' && t.status !== 'REJECTED' && (
                <div className="space-y-2">
                  <div className="flex gap-2 flex-wrap">
                    {t.status === 'REQUESTED' && (
                      <>
                        <button
                          onClick={() => doTransferAction(t.id, 'approve')}
                          disabled={!!acting}
                          className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
                        >
                          {acting === `${t.id}-approve` ? '...' : tr('موافقة', 'Approve')}
                        </button>
                        <button
                          onClick={() => {
                            setRejectingId(rejectingId === t.id ? null : t.id);
                            setRejectReason('');
                          }}
                          disabled={!!acting}
                          className="px-3 py-1.5 border border-red-300 text-red-600 rounded text-sm hover:bg-red-50 disabled:opacity-50"
                        >
                          {tr('رفض', 'Reject')}
                        </button>
                      </>
                    )}
                    {(t.status === 'APPROVED' || t.status === 'BED_ASSIGNED') && (
                      <button
                        onClick={() => {
                          const summary = prompt(tr('ملخص التحويل:', 'Transfer summary:')) || '';
                          doTransferAction(t.id, 'complete', { transferSummary: summary });
                        }}
                        disabled={!!acting}
                        className="px-3 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"
                      >
                        {acting === `${t.id}-complete` ? '...' : tr('إتمام التحويل', 'Complete Transfer')}
                      </button>
                    )}
                    <button
                      onClick={() => doTransferAction(t.id, 'cancel')}
                      disabled={!!acting}
                      className="px-3 py-1.5 border border-border text-muted-foreground rounded text-sm hover:bg-muted/50 disabled:opacity-50"
                    >
                      {tr('إلغاء', 'Cancel')}
                    </button>
                  </div>

                  {/* Reject reason textarea */}
                  {rejectingId === t.id && (
                    <div className="flex flex-col gap-2 bg-red-50 border border-red-200 rounded-md p-3">
                      <textarea
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder={tr('سبب الرفض...', 'Rejection reason...')}
                        rows={2}
                        className="w-full text-sm border border-red-300 rounded-md px-3 py-2 bg-card focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => doTransferAction(t.id, 'reject', { rejectionReason: rejectReason })}
                          disabled={!!acting || !rejectReason.trim()}
                          className="px-3 py-1.5 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:opacity-50"
                        >
                          {acting === `${t.id}-reject` ? '...' : tr('تأكيد الرفض', 'Confirm Reject')}
                        </button>
                        <button
                          onClick={() => { setRejectingId(null); setRejectReason(''); }}
                          className="px-3 py-1.5 text-muted-foreground text-sm hover:text-foreground"
                        >
                          {tr('إلغاء', 'Cancel')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// TAB 5: ANALYTICS
// ═════════════════════════════════════════════════════════════════════════════

function AnalyticsTab({ language, tr }: { language: string; tr: (ar: string, en: string) => string }) {
  const { data, isLoading, error, mutate } = useSWR('/api/admission/stats', fetcher);
  const stats: Stats | null = data || null;

  if (isLoading) return <Spinner />;
  if (error) return <ErrorBanner message={tr('خطأ في تحميل الإحصائيات', 'Error loading stats')} onRetry={() => mutate()} />;
  if (!stats) return <EmptyState message={tr('لا توجد بيانات', 'No data')} />;

  const maxTrend = Math.max(...(stats.trend?.map((t) => t.count) || [1]), 1);
  const sourceTotal = Object.values(stats.sourceBreakdown || {}).reduce((s, v) => s + v, 0) || 1;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          icon={<TrendingUp className="w-5 h-5 text-green-600" />}
          label={tr('قبول اليوم', 'Today\'s Admissions')}
          value={stats.todayAdmissions}
          accent="bg-green-50 border-green-200"
        />
        <KpiCard
          icon={<Clock className="w-5 h-5 text-amber-600" />}
          label={tr('طلبات معلقة', 'Pending Requests')}
          value={stats.pendingCount}
          accent="bg-amber-50 border-amber-200"
        />
        <KpiCard
          icon={<Timer className="w-5 h-5 text-blue-600" />}
          label={tr('متوسط الانتظار', 'Avg Wait Time')}
          value={`${stats.avgWaitHours} ${tr('ساعة', 'hrs')}`}
          accent="bg-blue-50 border-blue-200"
        />
        <KpiCard
          icon={<Activity className="w-5 h-5 text-indigo-600" />}
          label={tr('نسبة الإشغال', 'Occupancy Rate')}
          value={`${stats.overallOccupancy}%`}
          accent="bg-indigo-50 border-indigo-200"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Source Breakdown */}
        <div className="bg-card border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">{tr('مصادر القبول (آخر 30 يوم)', 'Admission Sources (Last 30 Days)')}</h3>
          <div className="space-y-3">
            {Object.entries(stats.sourceBreakdown || {}).map(([src, count]) => {
              const pct = Math.round((count / sourceTotal) * 100);
              const cfg = SOURCE_CONFIG[src] || { labelEn: src, labelAr: src, color: 'bg-muted' };
              return (
                <div key={src}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-foreground">{language === 'ar' ? cfg.labelAr : cfg.labelEn}</span>
                    <span className="text-muted-foreground">{count} ({pct}%)</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            {Object.keys(stats.sourceBreakdown || {}).length === 0 && (
              <p className="text-sm text-muted-foreground">{tr('لا توجد بيانات', 'No data')}</p>
            )}
          </div>
        </div>

        {/* 7-Day Trend */}
        <div className="bg-card border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">{tr('اتجاه القبول (آخر 7 أيام)', 'Admission Trend (Last 7 Days)')}</h3>
          <div className="flex items-end gap-2 h-40">
            {(stats.trend || []).map((day) => {
              const heightPct = maxTrend > 0 ? (day.count / maxTrend) * 100 : 0;
              return (
                <div key={day.date} className="flex-1 flex flex-col items-center justify-end h-full">
                  <span className="text-xs text-muted-foreground mb-1">{day.count}</span>
                  <div
                    className="w-full bg-indigo-400 rounded-t transition-all"
                    style={{ height: `${Math.max(heightPct, 4)}%` }}
                  />
                  <span className="text-[10px] text-muted-foreground mt-1">
                    {new Date(day.date).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en', { weekday: 'short' })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Department Occupancy Table */}
      <div className="bg-card border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">{tr('إشغال الأقسام', 'Department Occupancy')}</h3>
        {(stats.occupancy || []).length === 0 ? (
          <p className="text-sm text-muted-foreground">{tr('لا توجد بيانات', 'No data')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground border-b">
                  <th className="text-left py-2 font-medium">{tr('القسم', 'Department')}</th>
                  <th className="text-center py-2 font-medium">{tr('إجمالي', 'Total')}</th>
                  <th className="text-center py-2 font-medium">{tr('مشغول', 'Occupied')}</th>
                  <th className="text-center py-2 font-medium">{tr('متاح', 'Available')}</th>
                  <th className="text-center py-2 font-medium">{tr('الإشغال', 'Rate')}</th>
                </tr>
              </thead>
              <tbody>
                {stats.occupancy.map((dept) => (
                  <tr key={dept.department} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="py-2 font-medium text-foreground">{dept.department}</td>
                    <td className="py-2 text-center">{dept.totalBeds}</td>
                    <td className="py-2 text-center text-blue-600">{dept.occupied}</td>
                    <td className="py-2 text-center text-green-600">{dept.available}</td>
                    <td className="py-2 text-center">
                      <span className={`font-medium ${
                        dept.occupancyRate >= 90 ? 'text-red-600' : dept.occupancyRate >= 70 ? 'text-amber-600' : 'text-green-600'
                      }`}>
                        {dept.occupancyRate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ALOS Table */}
      <div className="bg-card border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">{tr('متوسط مدة الإقامة (آخر 90 يوم)', 'Average Length of Stay (Last 90 Days)')}</h3>
        {(stats.alos || []).length === 0 ? (
          <p className="text-sm text-muted-foreground">{tr('لا توجد بيانات', 'No data')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground border-b">
                  <th className="text-left py-2 font-medium">{tr('القسم', 'Department')}</th>
                  <th className="text-center py-2 font-medium">{tr('متوسط الأيام', 'Avg Days')}</th>
                  <th className="text-center py-2 font-medium">{tr('عدد الحالات', 'Cases')}</th>
                </tr>
              </thead>
              <tbody>
                {stats.alos.map((a) => (
                  <tr key={a.department} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="py-2 font-medium text-foreground">{a.department}</td>
                    <td className="py-2 text-center font-medium text-indigo-600">{a.avgDays} {tr('يوم', 'days')}</td>
                    <td className="py-2 text-center text-muted-foreground">{a.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
