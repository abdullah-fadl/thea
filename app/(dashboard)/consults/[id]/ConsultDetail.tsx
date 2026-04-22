'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useParams, useRouter } from 'next/navigation';
import { useLang } from '@/hooks/use-lang';
import {
  MessageSquare,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  User,
  Calendar,
  Stethoscope,
  AlertTriangle,
  FileText,
  Send,
  ChevronRight,
} from 'lucide-react';

const fetcher = (url: string) =>
  fetch(url, { credentials: 'include' }).then((r) => r.json());

// ─── Status configuration ─────────────────────────────────────────────────────
const STATUS_CONFIG: Record<
  string,
  { labelAr: string; labelEn: string; color: string; bg: string; icon: React.ReactNode }
> = {
  PENDING: {
    labelAr: 'في الانتظار',
    labelEn: 'Pending',
    color: 'text-amber-700',
    bg: 'bg-amber-100',
    icon: <Clock className="h-4 w-4" />,
  },
  ACKNOWLEDGED: {
    labelAr: 'تم الاستلام',
    labelEn: 'Acknowledged',
    color: 'text-blue-700',
    bg: 'bg-blue-100',
    icon: <CheckCircle2 className="h-4 w-4" />,
  },
  IN_PROGRESS: {
    labelAr: 'قيد المراجعة',
    labelEn: 'In Progress',
    color: 'text-indigo-700',
    bg: 'bg-indigo-100',
    icon: <AlertTriangle className="h-4 w-4" />,
  },
  COMPLETED: {
    labelAr: 'مكتمل',
    labelEn: 'Completed',
    color: 'text-green-700',
    bg: 'bg-green-100',
    icon: <CheckCircle2 className="h-4 w-4" />,
  },
  CANCELLED: {
    labelAr: 'ملغي',
    labelEn: 'Cancelled',
    color: 'text-muted-foreground',
    bg: 'bg-muted',
    icon: <XCircle className="h-4 w-4" />,
  },
};

const URGENCY_CONFIG: Record<
  string,
  { labelAr: string; labelEn: string; color: string; bg: string }
> = {
  STAT: { labelAr: 'فوري', labelEn: 'STAT', color: 'text-red-700', bg: 'bg-red-100' },
  URGENT: { labelAr: 'عاجل', labelEn: 'Urgent', color: 'text-orange-700', bg: 'bg-orange-100' },
  ROUTINE: { labelAr: 'روتيني', labelEn: 'Routine', color: 'text-muted-foreground', bg: 'bg-muted/50' },
};

// ─── Timeline step ────────────────────────────────────────────────────────────
const TIMELINE_STEPS = [
  { status: 'PENDING', labelAr: 'الطلب', labelEn: 'Requested' },
  { status: 'ACKNOWLEDGED', labelAr: 'الاستلام', labelEn: 'Acknowledged' },
  { status: 'IN_PROGRESS', labelAr: 'المراجعة', labelEn: 'In Review' },
  { status: 'COMPLETED', labelAr: 'مكتمل', labelEn: 'Completed' },
];

const STATUS_ORDER = ['PENDING', 'ACKNOWLEDGED', 'IN_PROGRESS', 'COMPLETED'];

interface ConsultRequest {
  id: string;
  patientMasterId: string;
  specialty: string;
  urgency: string;
  clinicalQuestion: string;
  clinicalSummary?: string;
  status: string;
  requestedBy?: string;
  consultantId?: string;
  acknowledgedAt?: string;
  completedAt?: string;
  createdAt: string;
}

interface ConsultResponse {
  id: string;
  findings: string;
  impression: string;
  recommendations: string;
  followUpNeeded: boolean;
  followUpDate?: string;
  createdAt: string;
}

export default function ConsultDetail() {
  const params = useParams();
  const router = useRouter();
  const consultId = params?.id as string;

  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const dir = language === 'ar' ? 'rtl' : 'ltr';

  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [submittingResponse, setSubmittingResponse] = useState(false);
  const [responseForm, setResponseForm] = useState({
    findings: '',
    impression: '',
    recommendations: '',
    followUpNeeded: false,
    followUpDate: '',
  });

  const { data, isLoading, mutate } = useSWR(
    consultId ? `/api/consults/${consultId}` : null,
    fetcher,
  );

  const consult: ConsultRequest | null = data?.consult ?? null;
  const response: ConsultResponse | null = data?.response ?? null;

  // Pre-fill form if response already exists
  const initialised = !!response;
  if (response && !responseForm.findings && !initialised) {
    setResponseForm({
      findings: response.findings,
      impression: response.impression,
      recommendations: response.recommendations,
      followUpNeeded: response.followUpNeeded,
      followUpDate: response.followUpDate
        ? new Date(response.followUpDate).toISOString().slice(0, 10)
        : '',
    });
  }

  // ─── Status update ────────────────────────────────────────────────────────
  async function updateStatus(status: string) {
    setUpdatingStatus(true);
    try {
      await fetch(`/api/consults/${consultId}`, {
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

  // ─── Submit response ──────────────────────────────────────────────────────
  async function submitResponse() {
    if (!responseForm.findings.trim() || !responseForm.impression.trim() || !responseForm.recommendations.trim()) {
      return;
    }
    setSubmittingResponse(true);
    try {
      const res = await fetch(`/api/consults/${consultId}/respond`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          findings: responseForm.findings,
          impression: responseForm.impression,
          recommendations: responseForm.recommendations,
          followUpNeeded: responseForm.followUpNeeded,
          followUpDate: responseForm.followUpDate || undefined,
        }),
      });
      if (res.ok) mutate();
    } finally {
      setSubmittingResponse(false);
    }
  }

  // ─── Loading / Not found ──────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-violet-500" />
      </div>
    );
  }

  if (!consult) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-muted-foreground" dir={dir}>
        <MessageSquare className="h-12 w-12 opacity-30" />
        <p>{tr('لم يتم العثور على الاستشارة', 'Consultation not found')}</p>
        <button onClick={() => router.back()} className="text-sm text-violet-600 underline">
          {tr('العودة', 'Go Back')}
        </button>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[consult.status] ?? STATUS_CONFIG.PENDING;
  const urgencyCfg = URGENCY_CONFIG[consult.urgency] ?? URGENCY_CONFIG.ROUTINE;
  const currentStep = STATUS_ORDER.indexOf(consult.status);

  return (
    <div className="min-h-screen bg-muted/50 p-4 sm:p-6" dir={dir}>
      {/* ── Back ─────────────────────────────────────────────────── */}
      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={() => router.push('/consults')}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {tr('العودة إلى الاستشارات', 'Back to Consults')}
        </button>
      </div>

      {/* ── Status Timeline ───────────────────────────────────────── */}
      {consult.status !== 'CANCELLED' && (
        <div className="mb-6 overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-muted-foreground">
            {tr('مسار الاستشارة', 'Consultation Timeline')}
          </h3>
          <div className="flex items-center">
            {TIMELINE_STEPS.map((step, i) => {
              const done = i <= currentStep;
              const active = i === currentStep;
              return (
                <div key={step.status} className="flex flex-1 items-center">
                  <div className="flex flex-col items-center">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors ${
                        done
                          ? 'border-violet-600 bg-violet-600 text-white'
                          : 'border-border bg-card text-muted-foreground'
                      } ${active ? 'ring-2 ring-violet-300 ring-offset-1' : ''}`}
                    >
                      {done ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                    </div>
                    <span className={`mt-1 whitespace-nowrap text-xs ${done ? 'font-medium text-violet-700' : 'text-muted-foreground'}`}>
                      {language === 'ar' ? step.labelAr : step.labelEn}
                    </span>
                  </div>
                  {i < TIMELINE_STEPS.length - 1 && (
                    <div
                      className={`mx-1 h-0.5 flex-1 transition-colors ${
                        i < currentStep ? 'bg-violet-500' : 'bg-muted'
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Two-column layout ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* ── Left Panel: Request Details ────────────────────────── */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            {/* Title row */}
            <div className="mb-4 flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600">
                  <MessageSquare className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h2 className="font-bold text-foreground">
                    {tr('تفاصيل الطلب', 'Request Details')}
                  </h2>
                  <p className="font-mono text-xs text-muted-foreground">{consult.id.slice(0, 12)}…</p>
                </div>
              </div>
              <span
                className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${statusCfg.bg} ${statusCfg.color}`}
              >
                {statusCfg.icon}
                {language === 'ar' ? statusCfg.labelAr : statusCfg.labelEn}
              </span>
            </div>

            {/* Meta grid */}
            <div className="grid grid-cols-2 gap-3">
              <MetaBlock
                icon={<User className="h-4 w-4 text-muted-foreground" />}
                label={tr('المريض', 'Patient')}
                value={consult.patientMasterId.slice(0, 12) + '…'}
              />
              <MetaBlock
                icon={<Stethoscope className="h-4 w-4 text-muted-foreground" />}
                label={tr('التخصص', 'Specialty')}
                value={consult.specialty}
              />
              <MetaBlock
                icon={<Calendar className="h-4 w-4 text-muted-foreground" />}
                label={tr('تاريخ الطلب', 'Requested On')}
                value={new Date(consult.createdAt).toLocaleDateString(
                  language === 'ar' ? 'ar-SA' : 'en-GB',
                )}
              />
              <div>
                <p className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <AlertTriangle className="h-4 w-4" />
                  {tr('الأولوية', 'Urgency')}
                </p>
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${urgencyCfg.bg} ${urgencyCfg.color}`}
                >
                  {language === 'ar' ? urgencyCfg.labelAr : urgencyCfg.labelEn}
                </span>
              </div>
              {consult.acknowledgedAt && (
                <MetaBlock
                  icon={<CheckCircle2 className="h-4 w-4 text-blue-400" />}
                  label={tr('تاريخ الاستلام', 'Acknowledged At')}
                  value={new Date(consult.acknowledgedAt).toLocaleString(
                    language === 'ar' ? 'ar-SA' : 'en-GB',
                  )}
                />
              )}
              {consult.completedAt && (
                <MetaBlock
                  icon={<CheckCircle2 className="h-4 w-4 text-green-400" />}
                  label={tr('تاريخ الإتمام', 'Completed At')}
                  value={new Date(consult.completedAt).toLocaleString(
                    language === 'ar' ? 'ar-SA' : 'en-GB',
                  )}
                />
              )}
            </div>

            <div className="mt-4 space-y-3 border-t border-border pt-4">
              <FieldBlock
                label={tr('السؤال السريري', 'Clinical Question')}
                value={consult.clinicalQuestion}
              />
              {consult.clinicalSummary && (
                <FieldBlock
                  label={tr('الملخص السريري', 'Clinical Summary')}
                  value={consult.clinicalSummary}
                />
              )}
            </div>
          </div>

          {/* ── Action Buttons ─────────────────────────────────────── */}
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
              {tr('الإجراءات', 'Actions')}
            </h3>
            <div className="flex flex-wrap gap-2">
              {consult.status === 'PENDING' && (
                <ActionBtn
                  icon={<CheckCircle2 className="h-4 w-4" />}
                  label={tr('استلام الطلب', 'Acknowledge')}
                  onClick={() => updateStatus('ACKNOWLEDGED')}
                  loading={updatingStatus}
                  variant="blue"
                />
              )}
              {consult.status === 'ACKNOWLEDGED' && (
                <ActionBtn
                  icon={<ChevronRight className="h-4 w-4" />}
                  label={tr('بدء المراجعة', 'Start Review')}
                  onClick={() => updateStatus('IN_PROGRESS')}
                  loading={updatingStatus}
                  variant="indigo"
                />
              )}
              {consult.status !== 'COMPLETED' && consult.status !== 'CANCELLED' && (
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
        </div>

        {/* ── Right Panel: Response ──────────────────────────────── */}
        <div>
          {/* Show existing response if available */}
          {response ? (
            <div className="rounded-2xl border border-green-200 bg-green-50 p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5 text-green-700" />
                <h2 className="font-bold text-green-800">
                  {tr('رد الاستشارة', 'Consultation Response')}
                </h2>
              </div>
              <div className="space-y-3">
                <ResponseBlock label={tr('الموجودات', 'Findings')} value={response.findings} />
                <ResponseBlock
                  label={tr('الانطباع السريري', 'Impression')}
                  value={response.impression}
                />
                <ResponseBlock
                  label={tr('التوصيات', 'Recommendations')}
                  value={response.recommendations}
                />
                {response.followUpNeeded && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <p className="text-xs font-semibold text-amber-700">
                      {tr('يلزم متابعة', 'Follow-up Required')}
                      {response.followUpDate &&
                        `: ${new Date(response.followUpDate).toLocaleDateString(
                          language === 'ar' ? 'ar-SA' : 'en-GB',
                        )}`}
                    </p>
                  </div>
                )}
                <p className="mt-2 text-xs text-muted-foreground">
                  {tr('تاريخ الرد:', 'Responded on:')} {new Date(response.createdAt).toLocaleString(language === 'ar' ? 'ar-SA' : 'en-GB')}
                </p>
              </div>
            </div>
          ) : (
            /* Response form */
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <Send className="h-5 w-5 text-violet-600" />
                <h2 className="font-bold text-foreground">
                  {tr('إضافة رد', 'Add Response')}
                </h2>
              </div>

              <div className="space-y-3">
                <TextareaField
                  label={tr('الموجودات', 'Findings')}
                  value={responseForm.findings}
                  onChange={(v) => setResponseForm((f) => ({ ...f, findings: v }))}
                  placeholder={tr('صف الموجودات السريرية…', 'Describe clinical findings…')}
                  rows={3}
                />
                <TextareaField
                  label={tr('الانطباع السريري', 'Impression')}
                  value={responseForm.impression}
                  onChange={(v) => setResponseForm((f) => ({ ...f, impression: v }))}
                  placeholder={tr('الانطباع التشخيصي…', 'Diagnostic impression…')}
                  rows={2}
                />
                <TextareaField
                  label={tr('التوصيات', 'Recommendations')}
                  value={responseForm.recommendations}
                  onChange={(v) => setResponseForm((f) => ({ ...f, recommendations: v }))}
                  placeholder={tr('التوصيات العلاجية…', 'Treatment recommendations…')}
                  rows={3}
                />

                {/* Follow-up toggle */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="followUpNeeded"
                    checked={responseForm.followUpNeeded}
                    onChange={(e) =>
                      setResponseForm((f) => ({ ...f, followUpNeeded: e.target.checked }))
                    }
                    className="h-4 w-4 rounded border-border text-violet-600"
                  />
                  <label htmlFor="followUpNeeded" className="text-sm text-muted-foreground">
                    {tr('يلزم متابعة', 'Follow-up required')}
                  </label>
                </div>

                {responseForm.followUpNeeded && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      {tr('تاريخ المتابعة', 'Follow-up Date')}
                    </label>
                    <input
                      type="date"
                      value={responseForm.followUpDate}
                      onChange={(e) =>
                        setResponseForm((f) => ({ ...f, followUpDate: e.target.value }))
                      }
                      className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
                    />
                  </div>
                )}

                <button
                  onClick={submitResponse}
                  disabled={
                    submittingResponse ||
                    !responseForm.findings.trim() ||
                    !responseForm.impression.trim() ||
                    !responseForm.recommendations.trim()
                  }
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 py-2.5 text-sm font-medium text-white shadow hover:bg-violet-700 disabled:opacity-60"
                >
                  {submittingResponse ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  {tr('إرسال الرد', 'Submit Response')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Helper components ────────────────────────────────────────────────────────

function MetaBlock({
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
      <p className="mb-0.5 flex items-center gap-1 text-xs text-muted-foreground">
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
      <p className="whitespace-pre-wrap text-sm text-foreground">{value}</p>
    </div>
  );
}

function ResponseBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-0.5 text-xs font-semibold text-green-700">{label}</p>
      <p className="whitespace-pre-wrap text-sm text-foreground">{value}</p>
    </div>
  );
}

function TextareaField({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  rows?: number;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      <textarea
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder-gray-300 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
      />
    </div>
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
