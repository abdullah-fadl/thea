'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useRouter } from 'next/navigation';
import {
  Microscope,
  RefreshCw,
  Plus,
  Search,
  ChevronRight,
  X,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { useLang } from '@/hooks/use-lang';

const fetcher = (url: string) =>
  fetch(url, { credentials: 'include' }).then((r) => r.json());

// ─── Types ──────────────────────────────────────────────────────────────────

interface PathologySpecimen {
  id: string;
  accessionNumber: string;
  patientMasterId: string;
  patientName?: string;
  mrn?: string;
  specimenType: string;
  site: string;
  clinicalHistory: string | null;
  clinicalDiagnosis: string | null;
  collectedBy: string | null;
  collectedAt: string | null;
  receivedAt: string;
  status: string;
  numberOfParts: number;
  fixative: string | null;
}

// ─── Config ──────────────────────────────────────────────────────────────────

const PIPELINE_STEPS: Array<{ key: string; labelAr: string; labelEn: string }> = [
  { key: 'RECEIVED',    labelAr: 'مستلم',       labelEn: 'Received' },
  { key: 'GROSSING',    labelAr: 'الفحص الظاهري', labelEn: 'Grossing' },
  { key: 'PROCESSING',  labelAr: 'المعالجة',    labelEn: 'Processing' },
  { key: 'EMBEDDING',   labelAr: 'التلبيس',     labelEn: 'Embedding' },
  { key: 'SECTIONING',  labelAr: 'التقطيع',     labelEn: 'Sectioning' },
  { key: 'STAINING',    labelAr: 'التلوين',      labelEn: 'Staining' },
  { key: 'REPORTING',   labelAr: 'التقرير',     labelEn: 'Reporting' },
  { key: 'FINALIZED',   labelAr: 'منتهٍ',       labelEn: 'Finalized' },
];

const STATUS_CONFIG: Record<
  string,
  { labelAr: string; labelEn: string; color: string; bg: string; border: string }
> = {
  RECEIVED:   { labelAr: 'مستلم',          labelEn: 'Received',    color: 'text-blue-700',    bg: 'bg-blue-50',    border: 'border-blue-200' },
  GROSSING:   { labelAr: 'الفحص الظاهري',  labelEn: 'Grossing',    color: 'text-indigo-700',  bg: 'bg-indigo-50',  border: 'border-indigo-200' },
  PROCESSING: { labelAr: 'المعالجة',       labelEn: 'Processing',  color: 'text-purple-700',  bg: 'bg-purple-50',  border: 'border-purple-200' },
  EMBEDDING:  { labelAr: 'التلبيس',        labelEn: 'Embedding',   color: 'text-violet-700',  bg: 'bg-violet-50',  border: 'border-violet-200' },
  SECTIONING: { labelAr: 'التقطيع',        labelEn: 'Sectioning',  color: 'text-fuchsia-700', bg: 'bg-fuchsia-50', border: 'border-fuchsia-200' },
  STAINING:   { labelAr: 'التلوين',         labelEn: 'Staining',    color: 'text-pink-700',    bg: 'bg-pink-50',    border: 'border-pink-200' },
  REPORTING:  { labelAr: 'التقرير',        labelEn: 'Reporting',   color: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200' },
  FINALIZED:  { labelAr: 'منتهٍ',          labelEn: 'Finalized',   color: 'text-green-700',   bg: 'bg-green-50',   border: 'border-green-200' },
  REJECTED:   { labelAr: 'مرفوض',          labelEn: 'Rejected',    color: 'text-red-700',     bg: 'bg-red-50',     border: 'border-red-200' },
};

// ─── Pipeline Visualization ───────────────────────────────────────────────────

function PipelineBar({ currentStatus, lang }: { currentStatus: string; lang: string }) {
  const currentIdx = PIPELINE_STEPS.findIndex((s) => s.key === currentStatus);
  return (
    <div className="flex items-center gap-0 overflow-x-auto py-1">
      {PIPELINE_STEPS.map((step, idx) => {
        const isDone = idx < currentIdx;
        const isCurrent = idx === currentIdx;
        const isPending = idx > currentIdx;
        return (
          <div key={step.key} className="flex items-center">
            <div
              className={`flex flex-col items-center min-w-[72px] px-1 ${
                isCurrent ? 'opacity-100' : isPending ? 'opacity-40' : 'opacity-70'
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                  isDone
                    ? 'bg-green-500 border-green-500 text-white'
                    : isCurrent
                    ? 'bg-indigo-600 border-indigo-600 text-white'
                    : 'bg-card border-border text-muted-foreground'
                }`}
              >
                {isDone ? '✓' : idx + 1}
              </div>
              <span
                className={`text-[10px] mt-0.5 text-center leading-tight ${
                  isCurrent ? 'text-indigo-700 font-semibold' : 'text-muted-foreground'
                }`}
              >
                {lang === 'ar' ? step.labelAr : step.labelEn}
              </span>
            </div>
            {idx < PIPELINE_STEPS.length - 1 && (
              <div
                className={`h-0.5 w-4 flex-shrink-0 ${
                  idx < currentIdx ? 'bg-green-400' : 'bg-muted'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Register Specimen Modal ──────────────────────────────────────────────────

interface RegisterSpecimenModalProps {
  onClose: () => void;
  onCreated: () => void;
  lang: string;
}

function RegisterSpecimenModal({ onClose, onCreated, lang }: RegisterSpecimenModalProps) {
  const tr = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const [form, setForm] = useState({
    patientMasterId: '',
    specimenType: '',
    site: '',
    clinicalHistory: '',
    clinicalDiagnosis: '',
    collectedBy: '',
    collectedAt: '',
    fixative: 'Formalin 10%',
    numberOfParts: 1,
    accessionNumber: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const FIXATIVES = [
    'Formalin 10%',
    'Neutral Buffered Formalin',
    'Bouin\'s Solution',
    'Alcohol',
    'Fresh (Unfixed)',
  ];

  const SPECIMEN_TYPES = [
    { ar: 'خزعة', en: 'Biopsy' },
    { ar: 'استئصال', en: 'Excision' },
    { ar: 'طموح إبرة دقيقة', en: 'Fine Needle Aspiration' },
    { ar: 'اختزال خلوي', en: 'Curettage' },
    { ar: 'عينة جراحية', en: 'Surgical Specimen' },
    { ar: 'عينة مسحة', en: 'Smear / Cytology' },
    { ar: 'نخاع العظم', en: 'Bone Marrow' },
    { ar: 'خزعة إبرة', en: 'Core Needle Biopsy' },
  ];

  const handleSubmit = async () => {
    setError('');
    if (!form.patientMasterId || !form.specimenType || !form.site) {
      setError(tr('يرجى تعبئة الحقول المطلوبة', 'Please fill in all required fields'));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/pathology/specimens', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          numberOfParts: Number(form.numberOfParts),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed');
      }
      onCreated();
    } catch (e: unknown) {
      setError(
        e instanceof Error
          ? e.message
          : tr('فشل في تسجيل العينة', 'Failed to register specimen')
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-foreground">
            {tr('تسجيل عينة نسيجية', 'Register Pathology Specimen')}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-muted-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {tr('معرّف المريض *', 'Patient ID *')}
            </label>
            <input
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              value={form.patientMasterId}
              onChange={(e) => setForm((f) => ({ ...f, patientMasterId: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {tr('نوع العينة *', 'Specimen Type *')}
            </label>
            <select
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              value={form.specimenType}
              onChange={(e) => setForm((f) => ({ ...f, specimenType: e.target.value }))}
            >
              <option value="">{tr('-- اختر --', '-- Select --')}</option>
              {SPECIMEN_TYPES.map((t) => (
                <option key={t.en} value={t.en}>
                  {lang === 'ar' ? t.ar : t.en}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {tr('الموقع التشريحي *', 'Anatomical Site *')}
            </label>
            <input
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              value={form.site}
              onChange={(e) => setForm((f) => ({ ...f, site: e.target.value }))}
              placeholder={tr('مثال: الجانب الأيمن للقولون', 'e.g. Right colon, ascending')}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {tr('التاريخ السريري', 'Clinical History')}
            </label>
            <textarea
              rows={2}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
              value={form.clinicalHistory}
              onChange={(e) => setForm((f) => ({ ...f, clinicalHistory: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {tr('التشخيص السريري', 'Clinical Diagnosis')}
            </label>
            <input
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              value={form.clinicalDiagnosis}
              onChange={(e) => setForm((f) => ({ ...f, clinicalDiagnosis: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                {tr('مادة الحفظ', 'Fixative')}
              </label>
              <select
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                value={form.fixative}
                onChange={(e) => setForm((f) => ({ ...f, fixative: e.target.value }))}
              >
                {FIXATIVES.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                {tr('عدد الأجزاء', 'Number of Parts')}
              </label>
              <input
                type="number"
                min={1}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                value={form.numberOfParts}
                onChange={(e) =>
                  setForm((f) => ({ ...f, numberOfParts: Number(e.target.value) }))
                }
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {tr('تاريخ الأخذ', 'Collection Date/Time')}
            </label>
            <input
              type="datetime-local"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              value={form.collectedAt}
              onChange={(e) => setForm((f) => ({ ...f, collectedAt: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {tr('رقم القيد (اختياري)', 'Accession Number (optional)')}
            </label>
            <input
              className="w-full border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400"
              value={form.accessionNumber}
              onChange={(e) => setForm((f) => ({ ...f, accessionNumber: e.target.value }))}
              placeholder="PATH-2026-XXXXXX"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-muted/50 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
          >
            {tr('إلغاء', 'Cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
            {tr('تسجيل العينة', 'Register Specimen')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Listing ─────────────────────────────────────────────────────────────

export default function PathologyListing() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const dir = language === 'ar' ? 'rtl' : 'ltr';
  const router = useRouter();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showRegister, setShowRegister] = useState(false);

  const queryParams = new URLSearchParams();
  if (search) queryParams.set('search', search);
  if (statusFilter) queryParams.set('status', statusFilter);

  const { data, mutate, isLoading } = useSWR(
    `/api/pathology/specimens?${queryParams.toString()}`,
    fetcher,
    { refreshInterval: 30000 }
  );

  const specimens: PathologySpecimen[] = Array.isArray(data?.specimens)
    ? data.specimens
    : [];

  // ── KPIs ──
  const total = specimens.length;
  const pendingProcessing = specimens.filter(
    (s) =>
      ['RECEIVED', 'GROSSING', 'PROCESSING', 'EMBEDDING', 'SECTIONING', 'STAINING'].includes(
        s.status
      )
  ).length;
  const awaitingReport = specimens.filter((s) => s.status === 'REPORTING').length;
  const finalized = specimens.filter((s) => s.status === 'FINALIZED').length;

  return (
    <div dir={dir} className="min-h-screen bg-muted/50">
      {/* Header */}
      <div className="bg-card border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center">
              <Microscope className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">
                {tr('المختبر النسيجي', 'Histopathology Laboratory')}
              </h1>
              <p className="text-xs text-muted-foreground">
                {tr('إدارة العينات والتقارير النسيجية', 'Specimen & Histopathology Report Management')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => mutate()}
              className="p-2 text-muted-foreground hover:text-muted-foreground rounded-lg hover:bg-muted"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowRegister(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
            >
              <Plus className="w-4 h-4" />
              {tr('تسجيل عينة', 'Register Specimen')}
            </button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="px-6 py-4 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
          <FileText className="w-6 h-6 text-muted-foreground" />
          <div>
            <p className="text-2xl font-bold text-foreground">{total}</p>
            <p className="text-xs text-muted-foreground">{tr('إجمالي العينات', 'Total Specimens')}</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
          <Clock className="w-6 h-6 text-purple-500" />
          <div>
            <p className="text-2xl font-bold text-foreground">{pendingProcessing}</p>
            <p className="text-xs text-muted-foreground">{tr('في المعالجة', 'Pending Processing')}</p>
          </div>
        </div>
        <div className="bg-card border border-amber-200 rounded-xl p-4 flex items-center gap-3 bg-amber-50">
          <AlertCircle className="w-6 h-6 text-amber-600" />
          <div>
            <p className="text-2xl font-bold text-foreground">{awaitingReport}</p>
            <p className="text-xs text-muted-foreground">{tr('في انتظار التقرير', 'Awaiting Report')}</p>
          </div>
        </div>
        <div className="bg-card border border-green-200 rounded-xl p-4 flex items-center gap-3 bg-green-50">
          <CheckCircle2 className="w-6 h-6 text-green-600" />
          <div>
            <p className="text-2xl font-bold text-foreground">{finalized}</p>
            <p className="text-xs text-muted-foreground">{tr('تقارير منتهية', 'Finalized')}</p>
          </div>
        </div>
      </div>

      {/* Pipeline Visualization */}
      <div className="px-6 pb-2">
        <div className="bg-card border border-border rounded-xl px-4 py-3">
          <p className="text-xs text-muted-foreground font-medium mb-2">
            {tr('مسار معالجة العينات', 'Specimen Processing Pipeline')}
          </p>
          <PipelineBar currentStatus="PROCESSING" lang={language} />
        </div>
      </div>

      {/* Filters */}
      <div className="px-6 pb-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            className="w-full border border-border rounded-lg ps-9 pe-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            placeholder={tr('بحث بالرقم أو النوع أو الموقع...', 'Search by accession, type, or site...')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-card"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">{tr('جميع الحالات', 'All Statuses')}</option>
          {PIPELINE_STEPS.map((s) => (
            <option key={s.key} value={s.key}>
              {language === 'ar' ? s.labelAr : s.labelEn}
            </option>
          ))}
          <option value="REJECTED">{tr('مرفوض', 'Rejected')}</option>
        </select>
      </div>

      {/* Table */}
      <div className="px-6 pb-6">
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-5 h-5 text-indigo-500 animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                      {tr('رقم القيد', 'Accession #')}
                    </th>
                    <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                      {tr('المريض', 'Patient')}
                    </th>
                    <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                      {tr('نوع العينة', 'Specimen Type')}
                    </th>
                    <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                      {tr('الموقع', 'Site')}
                    </th>
                    <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                      {tr('الحالة', 'Status')}
                    </th>
                    <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                      {tr('تاريخ الأخذ', 'Collected')}
                    </th>
                    <th className="px-4 py-3 text-start font-medium text-muted-foreground"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {specimens.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                        {tr('لا توجد عينات', 'No specimens found')}
                      </td>
                    </tr>
                  )}
                  {specimens.map((specimen) => {
                    const statusCfg = STATUS_CONFIG[specimen.status] || STATUS_CONFIG.RECEIVED;
                    return (
                      <tr
                        key={specimen.id}
                        className="hover:bg-indigo-50/40 cursor-pointer transition-colors"
                        onClick={() => router.push(`/pathology/${specimen.id}`)}
                      >
                        <td className="px-4 py-3">
                          <span className="font-mono font-medium text-indigo-700 text-xs">
                            {specimen.accessionNumber}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-foreground">
                            {specimen.patientName || specimen.patientMasterId}
                          </p>
                          {specimen.mrn && (
                            <p className="text-xs text-muted-foreground">{specimen.mrn}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-foreground">{specimen.specimenType}</td>
                        <td className="px-4 py-3 text-muted-foreground max-w-[140px] truncate">
                          {specimen.site}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${statusCfg.color} ${statusCfg.bg} ${statusCfg.border}`}
                          >
                            {language === 'ar' ? statusCfg.labelAr : statusCfg.labelEn}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                          {specimen.collectedAt
                            ? new Date(specimen.collectedAt).toLocaleDateString(
                                language === 'ar' ? 'ar-SA' : 'en-US',
                                { year: 'numeric', month: 'short', day: 'numeric' }
                              )
                            : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Register Modal */}
      {showRegister && (
        <RegisterSpecimenModal
          lang={language}
          onClose={() => setShowRegister(false)}
          onCreated={() => {
            setShowRegister(false);
            mutate();
          }}
        />
      )}
    </div>
  );
}
