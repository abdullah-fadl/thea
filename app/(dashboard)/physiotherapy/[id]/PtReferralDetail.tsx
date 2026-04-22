'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useParams, useRouter } from 'next/navigation';
import { useLang } from '@/hooks/use-lang';
import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  PlayCircle,
  Clock,
  Plus,
  Loader2,
  User,
  Calendar,
  ClipboardList,
  Dumbbell,
} from 'lucide-react';

const fetcher = (url: string) =>
  fetch(url, { credentials: 'include' }).then((r) => r.json());

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<
  string,
  { labelAr: string; labelEn: string; color: string; bg: string }
> = {
  PENDING: { labelAr: 'في الانتظار', labelEn: 'Pending', color: 'text-amber-700', bg: 'bg-amber-100' },
  ACCEPTED: { labelAr: 'مقبول', labelEn: 'Accepted', color: 'text-blue-700', bg: 'bg-blue-100' },
  IN_PROGRESS: { labelAr: 'جاري العلاج', labelEn: 'In Progress', color: 'text-indigo-700', bg: 'bg-indigo-100' },
  COMPLETED: { labelAr: 'مكتمل', labelEn: 'Completed', color: 'text-green-700', bg: 'bg-green-100' },
  CANCELLED: { labelAr: 'ملغي', labelEn: 'Cancelled', color: 'text-muted-foreground', bg: 'bg-muted' },
};

const URGENCY_CONFIG: Record<
  string,
  { labelAr: string; labelEn: string; color: string; bg: string }
> = {
  STAT: { labelAr: 'فوري', labelEn: 'STAT', color: 'text-red-700', bg: 'bg-red-100' },
  URGENT: { labelAr: 'عاجل', labelEn: 'Urgent', color: 'text-orange-700', bg: 'bg-orange-100' },
  ROUTINE: { labelAr: 'روتيني', labelEn: 'Routine', color: 'text-muted-foreground', bg: 'bg-muted/50' },
};

type ActiveTab = 'details' | 'sessions';

interface PtSession {
  id: string;
  sessionDate: string;
  duration?: number;
  interventions: string;
  progressNote: string;
  painBefore?: number;
  painAfter?: number;
}

interface PtReferral {
  id: string;
  patientMasterId: string;
  specialty: string;
  reason: string;
  urgency: string;
  status: string;
  notes?: string;
  createdAt: string;
}

export default function PtReferralDetail() {
  const params = useParams();
  const router = useRouter();
  const referralId = params?.id as string;

  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const dir = language === 'ar' ? 'rtl' : 'ltr';

  const [activeTab, setActiveTab] = useState<ActiveTab>('details');
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [showSessionForm, setShowSessionForm] = useState(false);
  const [sessionForm, setSessionForm] = useState({
    sessionDate: new Date().toISOString().slice(0, 10),
    duration: '',
    interventions: '',
    progressNote: '',
    painBefore: '',
    painAfter: '',
  });
  const [savingSession, setSavingSession] = useState(false);

  const { data, isLoading, mutate } = useSWR(
    referralId ? `/api/physiotherapy/referrals/${referralId}` : null,
    fetcher,
  );

  const referral: PtReferral | null = data?.referral ?? null;
  const sessions: PtSession[] = data?.sessions ?? [];

  // ─── Status actions ───────────────────────────────────────────────────────
  async function updateStatus(status: string) {
    if (!referral) return;
    setUpdatingStatus(true);
    try {
      await fetch(`/api/physiotherapy/referrals/${referralId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      mutate();
    } finally {
      setUpdatingStatus(false);
    }
  }

  // ─── Add session ──────────────────────────────────────────────────────────
  async function submitSession() {
    if (!sessionForm.interventions.trim() || !sessionForm.progressNote.trim()) return;
    setSavingSession(true);
    try {
      const res = await fetch(`/api/physiotherapy/referrals/${referralId}/sessions`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionDate: sessionForm.sessionDate,
          duration: sessionForm.duration ? Number(sessionForm.duration) : undefined,
          interventions: sessionForm.interventions,
          progressNote: sessionForm.progressNote,
          painBefore: sessionForm.painBefore ? Number(sessionForm.painBefore) : undefined,
          painAfter: sessionForm.painAfter ? Number(sessionForm.painAfter) : undefined,
        }),
      });
      if (res.ok) {
        setShowSessionForm(false);
        setSessionForm({
          sessionDate: new Date().toISOString().slice(0, 10),
          duration: '',
          interventions: '',
          progressNote: '',
          painBefore: '',
          painAfter: '',
        });
        mutate();
      }
    } finally {
      setSavingSession(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!referral) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-muted-foreground" dir={dir}>
        <Activity className="h-12 w-12 opacity-30" />
        <p>{tr('لم يتم العثور على الإحالة', 'Referral not found')}</p>
        <button
          onClick={() => router.back()}
          className="text-sm text-indigo-600 underline"
        >
          {tr('العودة', 'Go Back')}
        </button>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[referral.status] ?? STATUS_CONFIG.PENDING;
  const urgencyCfg = URGENCY_CONFIG[referral.urgency] ?? URGENCY_CONFIG.ROUTINE;

  return (
    <div className="min-h-screen bg-muted/50 p-4 sm:p-6" dir={dir}>
      {/* ── Back + Header ─────────────────────────────────────────── */}
      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={() => router.push('/physiotherapy')}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {tr('العودة', 'Back')}
        </button>
      </div>

      {/* ── Referral Card ──────────────────────────────────────────── */}
      <div className="mb-6 rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 shadow">
              <Activity className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">
                {tr('إحالة علاج طبيعي', 'Physiotherapy Referral')}
              </h1>
              <p className="font-mono text-xs text-muted-foreground">{referral.id}</p>
            </div>
          </div>

          {/* Status badge */}
          <span
            className={`rounded-full px-3 py-1 text-sm font-semibold ${statusCfg.bg} ${statusCfg.color}`}
          >
            {language === 'ar' ? statusCfg.labelAr : statusCfg.labelEn}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <InfoRow
            icon={<User className="h-4 w-4 text-muted-foreground" />}
            label={tr('المريض', 'Patient')}
            value={referral.patientMasterId.slice(0, 12) + '…'}
          />
          <InfoRow
            icon={<ClipboardList className="h-4 w-4 text-muted-foreground" />}
            label={tr('التخصص', 'Specialty')}
            value={referral.specialty}
          />
          <InfoRow
            icon={<Calendar className="h-4 w-4 text-muted-foreground" />}
            label={tr('التاريخ', 'Date')}
            value={new Date(referral.createdAt).toLocaleDateString(
              language === 'ar' ? 'ar-SA' : 'en-GB',
            )}
          />
          <div className="col-span-2 sm:col-span-1">
            <p className="mb-1 text-xs text-muted-foreground">{tr('الأولوية', 'Urgency')}</p>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${urgencyCfg.bg} ${urgencyCfg.color}`}
            >
              {language === 'ar' ? urgencyCfg.labelAr : urgencyCfg.labelEn}
            </span>
          </div>
        </div>

        {/* ── Action buttons ─────────────────────────────────────────── */}
        <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
          {referral.status === 'PENDING' && (
            <ActionBtn
              icon={<CheckCircle2 className="h-4 w-4" />}
              label={tr('قبول', 'Accept')}
              onClick={() => updateStatus('ACCEPTED')}
              loading={updatingStatus}
              variant="blue"
            />
          )}
          {(referral.status === 'PENDING' || referral.status === 'ACCEPTED') && (
            <ActionBtn
              icon={<PlayCircle className="h-4 w-4" />}
              label={tr('بدء العلاج', 'Start Treatment')}
              onClick={() => updateStatus('IN_PROGRESS')}
              loading={updatingStatus}
              variant="indigo"
            />
          )}
          {referral.status === 'IN_PROGRESS' && (
            <ActionBtn
              icon={<CheckCircle2 className="h-4 w-4" />}
              label={tr('إتمام', 'Complete')}
              onClick={() => updateStatus('COMPLETED')}
              loading={updatingStatus}
              variant="green"
            />
          )}
          {referral.status !== 'CANCELLED' && referral.status !== 'COMPLETED' && (
            <ActionBtn
              icon={<XCircle className="h-4 w-4" />}
              label={tr('إلغاء', 'Cancel')}
              onClick={() => updateStatus('CANCELLED')}
              loading={updatingStatus}
              variant="red"
            />
          )}
        </div>
      </div>

      {/* ── Tabs ──────────────────────────────────────────────────────── */}
      <div className="mb-4 flex gap-1 rounded-xl border border-border bg-card p-1 shadow-sm">
        <TabBtn
          active={activeTab === 'details'}
          onClick={() => setActiveTab('details')}
          icon={<ClipboardList className="h-4 w-4" />}
          label={tr('التفاصيل', 'Details')}
        />
        <TabBtn
          active={activeTab === 'sessions'}
          onClick={() => setActiveTab('sessions')}
          icon={<Dumbbell className="h-4 w-4" />}
          label={`${tr('الجلسات', 'Sessions')} (${sessions.length})`}
        />
      </div>

      {/* ── Tab Content ────────────────────────────────────────────────── */}
      {activeTab === 'details' && (
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-4 font-semibold text-foreground">
            {tr('تفاصيل الإحالة', 'Referral Details')}
          </h2>
          <div className="space-y-3">
            <FieldBlock label={tr('سبب الإحالة', 'Reason for Referral')} value={referral.reason} />
            {referral.notes && (
              <FieldBlock label={tr('ملاحظات', 'Notes')} value={referral.notes} />
            )}
          </div>
        </div>
      )}

      {activeTab === 'sessions' && (
        <div className="space-y-4">
          {/* Add session button */}
          <div className="flex justify-end">
            <button
              onClick={() => setShowSessionForm((v) => !v)}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" />
              {tr('إضافة جلسة', 'Add Session')}
            </button>
          </div>

          {/* Session form */}
          {showSessionForm && (
            <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5 shadow-sm">
              <h3 className="mb-4 font-semibold text-indigo-800">
                {tr('جلسة جديدة', 'New Session')}
              </h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FormField
                  label={tr('تاريخ الجلسة', 'Session Date')}
                  type="date"
                  value={sessionForm.sessionDate}
                  onChange={(v) => setSessionForm((f) => ({ ...f, sessionDate: v }))}
                />
                <FormField
                  label={tr('المدة (دقائق)', 'Duration (min)')}
                  type="number"
                  value={sessionForm.duration}
                  onChange={(v) => setSessionForm((f) => ({ ...f, duration: v }))}
                />
                <FormField
                  label={tr('الألم قبل (0-10)', 'Pain Before (0-10)')}
                  type="number"
                  value={sessionForm.painBefore}
                  onChange={(v) => setSessionForm((f) => ({ ...f, painBefore: v }))}
                />
                <FormField
                  label={tr('الألم بعد (0-10)', 'Pain After (0-10)')}
                  type="number"
                  value={sessionForm.painAfter}
                  onChange={(v) => setSessionForm((f) => ({ ...f, painAfter: v }))}
                />
              </div>
              <div className="mt-3">
                <TextareaField
                  label={tr('التدخلات', 'Interventions')}
                  value={sessionForm.interventions}
                  onChange={(v) => setSessionForm((f) => ({ ...f, interventions: v }))}
                  placeholder={tr('صف التدخلات المنفذة…', 'Describe interventions performed…')}
                />
              </div>
              <div className="mt-3">
                <TextareaField
                  label={tr('ملاحظات التقدم', 'Progress Note')}
                  value={sessionForm.progressNote}
                  onChange={(v) => setSessionForm((f) => ({ ...f, progressNote: v }))}
                  placeholder={tr('سجّل تقدم المريض…', 'Document patient progress…')}
                />
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={submitSession}
                  disabled={savingSession}
                  className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                  {savingSession && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {tr('حفظ الجلسة', 'Save Session')}
                </button>
                <button
                  onClick={() => setShowSessionForm(false)}
                  className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/50"
                >
                  {tr('إلغاء', 'Cancel')}
                </button>
              </div>
            </div>
          )}

          {/* Sessions list */}
          {sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card py-16 text-muted-foreground shadow-sm">
              <Dumbbell className="mb-3 h-10 w-10 opacity-30" />
              <p>{tr('لا توجد جلسات حتى الآن', 'No sessions recorded yet')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.map((s, i) => (
                <div
                  key={s.id}
                  className="rounded-2xl border border-border bg-card p-4 shadow-sm"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-semibold text-foreground">
                      {tr('الجلسة', 'Session')} #{sessions.length - i}
                    </span>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {s.duration && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {s.duration} {tr('دقيقة', 'min')}
                        </span>
                      )}
                      <span>
                        {new Date(s.sessionDate).toLocaleDateString(
                          language === 'ar' ? 'ar-SA' : 'en-GB',
                        )}
                      </span>
                    </div>
                  </div>

                  {(s.painBefore !== undefined || s.painAfter !== undefined) && (
                    <div className="mb-2 flex gap-4 text-xs">
                      {s.painBefore !== undefined && (
                        <span className="text-orange-600">
                          {tr('الألم قبل:', 'Pain Before:')} {s.painBefore}/10
                        </span>
                      )}
                      {s.painAfter !== undefined && (
                        <span className="text-green-600">
                          {tr('الألم بعد:', 'Pain After:')} {s.painAfter}/10
                        </span>
                      )}
                    </div>
                  )}

                  <FieldBlock
                    label={tr('التدخلات', 'Interventions')}
                    value={s.interventions}
                  />
                  <div className="mt-2">
                    <FieldBlock
                      label={tr('ملاحظات التقدم', 'Progress Note')}
                      value={s.progressNote}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Small helper components ──────────────────────────────────────────────────

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function FieldBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-0.5 text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground">{value}</p>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
        active ? 'bg-indigo-600 text-white shadow' : 'text-muted-foreground hover:bg-muted/50'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function ActionBtn({
  icon,
  label,
  onClick,
  loading,
  variant,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  loading: boolean;
  variant: 'blue' | 'indigo' | 'green' | 'red';
}) {
  const variantCls = {
    blue: 'bg-blue-600 hover:bg-blue-700 text-white',
    indigo: 'bg-indigo-600 hover:bg-indigo-700 text-white',
    green: 'bg-green-600 hover:bg-green-700 text-white',
    red: 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200',
  }[variant];

  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium shadow-sm disabled:opacity-60 ${variantCls}`}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : icon}
      {label}
    </button>
  );
}

function FormField({
  label,
  type,
  value,
  onChange,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
      />
    </div>
  );
}

function TextareaField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      <textarea
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder-gray-300 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
      />
    </div>
  );
}
