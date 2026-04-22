'use client';

import useSWR from 'swr';
import { useState, ReactNode } from 'react';
import { useLang } from '@/hooks/use-lang';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, AlertTriangle, Info, CheckCircle2, Clock, Pill, User, Clipboard, Printer, Search, Lock, Loader2 } from 'lucide-react';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

type RxStatus = 'PENDING' | 'VERIFIED' | 'DISPENSED' | 'CANCELLED';

interface PrescriptionItem {
  id: string;
  patientName: string;
  patientId?: string;
  mrn: string;
  medication: string;
  medicationAr?: string;
  genericName?: string;
  strength: string;
  form?: string;
  route?: string;
  frequency: string;
  duration: string;
  quantity: number;
  instructions?: string;
  instructionsAr?: string;
  status: RxStatus;
  priority?: string;
  prescribedAt: string;
  doctorName?: string;
  verifiedAt?: string;
  verifiedBy?: string;
  verifierName?: string;
  verificationNotes?: string;
}

interface DrugInteractionResult {
  newDrug: string;
  currentMedications: string[];
  interactions: Array<{
    severity: string;
    drug1?: string;
    drug2?: string;
    description?: { ar: string; en: string };
    recommendation?: { ar: string; en: string };
  }>;
  summary: {
    total: number;
    critical: number;
    major: number;
    minor: number;
    overallSeverity: 'critical' | 'major' | 'minor' | 'none';
  };
}

const QUEUE_TABS: { value: RxStatus; labelAr: string; labelEn: string }[] = [
  { value: 'PENDING', labelAr: 'معلقة', labelEn: 'Pending' },
  { value: 'VERIFIED', labelAr: 'محققة', labelEn: 'Verified' },
  { value: 'DISPENSED', labelAr: 'مصروفة', labelEn: 'Dispensed' },
];

function priorityBadge(priority: string | undefined, language: string) {
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  if (priority === 'STAT' || priority === 'stat')
    return (
      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">
        {tr('عاجل', 'STAT')}
      </span>
    );
  if (priority === 'URGENT' || priority === 'urgent')
    return (
      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700">
        {tr('مستعجل', 'URGENT')}
      </span>
    );
  return null;
}

function statusBadge(status: RxStatus, language: string) {
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  switch (status) {
    case 'PENDING':
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">
          {tr('معلقة', 'Pending')}
        </span>
      );
    case 'VERIFIED':
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">
          {tr('محققة', 'Verified')}
        </span>
      );
    case 'DISPENSED':
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
          {tr('مصروفة', 'Dispensed')}
        </span>
      );
    case 'CANCELLED':
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">
          {tr('ملغية', 'Cancelled')}
        </span>
      );
    default:
      return null;
  }
}

function interactionSeverityClasses(severity: string) {
  switch (severity) {
    case 'critical':
      return 'bg-red-50 border-red-300 text-red-900';
    case 'major':
      return 'bg-orange-50 border-orange-300 text-orange-900';
    case 'minor':
      return 'bg-yellow-50 border-yellow-300 text-yellow-900';
    default:
      return 'bg-emerald-50 border-emerald-300 text-emerald-900';
  }
}

function interactionIcon(severity: string): ReactNode {
  switch (severity) {
    case 'critical':
      return <AlertCircle className="h-5 w-5 text-red-600" />;
    case 'major':
      return <AlertTriangle className="h-5 w-5 text-amber-600" />;
    case 'minor':
      return <Info className="h-5 w-5 text-blue-600" />;
    default:
      return <CheckCircle2 className="h-5 w-5 text-emerald-600" />;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Cancel Dialog
// ─────────────────────────────────────────────────────────────────────────────

function CancelDialog({
  onConfirm,
  onClose,
  loading,
  language,
}: {
  onConfirm: (reason: string) => void;
  onClose: () => void;
  loading: boolean;
  language: string;
}) {
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const [reason, setReason] = useState('');
  const REASONS = [
    { ar: 'طلب المريض', en: 'Patient request' },
    { ar: 'خطأ في الوصفة', en: 'Prescription error' },
    { ar: 'تفاعل دوائي', en: 'Drug interaction' },
    { ar: 'دواء غير متوفر', en: 'Medication unavailable' },
    { ar: 'تغيير في حالة المريض', en: 'Change in patient condition' },
    { ar: 'أمر الطبيب', en: 'Physician order' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div
        className="bg-card rounded-2xl shadow-2xl border border-border w-full max-w-md mx-4"
        dir={language === 'ar' ? 'rtl' : 'ltr'}
      >
        <div className="px-6 py-4 border-b border-border">
          <h3 className="text-base font-bold text-foreground">
            {tr('إلغاء الوصفة', 'Cancel Prescription')}
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            {tr('يرجى تحديد سبب الإلغاء', 'Please specify a cancellation reason')}
          </p>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {REASONS.map((r) => (
              <button
                key={r.en}
                onClick={() => setReason(language === 'ar' ? r.ar : r.en)}
                className={`px-3 py-2 text-sm rounded-xl border text-start transition-colors ${
                  reason === (language === 'ar' ? r.ar : r.en)
                    ? 'border-red-400 bg-red-50 text-red-800'
                    : 'border-border hover:bg-muted/50 text-foreground'
                }`}
              >
                {tr(r.ar, r.en)}
              </button>
            ))}
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {tr('سبب آخر (اختياري)', 'Other reason (optional)')}
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
              placeholder={tr('أدخل السبب...', 'Enter reason...')}
            />
          </div>
        </div>
        <div className="px-6 pb-5 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm border border-border rounded-xl hover:bg-muted transition-colors disabled:opacity-50"
          >
            {tr('تراجع', 'Back')}
          </button>
          <button
            onClick={() => reason.trim() && onConfirm(reason.trim())}
            disabled={!reason.trim() || loading}
            className="px-4 py-2 text-sm bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {loading && <Loader2 className="h-3 w-3 animate-spin" />}
            {tr('تأكيد الإلغاء', 'Confirm Cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Critical Interaction Override Dialog
// ─────────────────────────────────────────────────────────────────────────────

function CriticalOverrideDialog({
  onConfirm,
  onClose,
  language,
}: {
  onConfirm: (override: string) => void;
  onClose: () => void;
  language: string;
}) {
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const [reason, setReason] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div
        className="bg-card rounded-2xl shadow-2xl border border-red-300 w-full max-w-md mx-4"
        dir={language === 'ar' ? 'rtl' : 'ltr'}
      >
        <div className="px-6 py-4 border-b border-red-200 bg-red-50 rounded-t-2xl">
          <h3 className="text-base font-bold text-red-900">
            <AlertCircle className="h-5 w-5 inline text-red-600" /> {tr('تجاوز تفاعل دوائي حرج', 'Override Critical Drug Interaction')}
          </h3>
          <p className="text-sm text-red-700 mt-1">
            {tr(
              'يتطلب هذا الإجراء توثيق سبب طبي واضح وموافقة الطبيب المعالج',
              'This action requires documented medical justification and prescriber approval'
            )}
          </p>
        </div>
        <div className="p-6 space-y-3">
          <label className="block text-sm font-medium text-foreground">
            {tr('المبرر السريري *', 'Clinical justification *')}
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-red-300 rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
            placeholder={tr(
              'مثال: المريض يعاني من ألم حاد وغير قادر على تناول الأسيتامينوفين...',
              'e.g. Patient has acute pain and cannot take acetaminophen due to liver disease...'
            )}
          />
          <p className="text-xs text-red-600">
            {tr(
              'سيتم تسجيل هذا التجاوز في سجل التدقيق',
              'This override will be recorded in the audit log'
            )}
          </p>
        </div>
        <div className="px-6 pb-5 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-border rounded-xl hover:bg-muted transition-colors"
          >
            {tr('إلغاء', 'Cancel')}
          </button>
          <button
            onClick={() => reason.trim() && onConfirm(reason.trim())}
            disabled={!reason.trim()}
            className="px-4 py-2 text-sm bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {tr('تجاوز والمتابعة', 'Override & Continue')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export default function PharmacyDispensing() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<RxStatus>('PENDING');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<PrescriptionItem | null>(null);
  const [notes, setNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [interactionResult, setInteractionResult] = useState<DrugInteractionResult | null>(null);
  const [checkingInteractions, setCheckingInteractions] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showCriticalOverride, setShowCriticalOverride] = useState(false);
  const [interactionOverrideReason, setInteractionOverrideReason] = useState('');

  const searchQuery = search.trim() ? `&search=${encodeURIComponent(search.trim())}` : '';
  const { data, mutate } = useSWR(
    `/api/pharmacy/prescriptions?status=${activeTab}${searchQuery}`,
    fetcher,
    { refreshInterval: 30000 }
  );
  const items: PrescriptionItem[] = Array.isArray(data?.items) ? data.items : [];

  // ── Check drug interactions when a prescription is selected ──────────────
  const handleSelect = async (item: PrescriptionItem) => {
    setSelected(item);
    setNotes('');
    setError('');
    setInteractionResult(null);
    setInteractionOverrideReason('');

    if (item.genericName || item.medication) {
      setCheckingInteractions(true);
      try {
        const res = await fetch('/api/pharmacy/drug-interactions', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            newDrug: item.genericName || item.medication,
            patientMrn: item.mrn,
            excludeId: item.id,
          }),
        });
        if (res.ok) {
          const d: DrugInteractionResult = await res.json();
          setInteractionResult(d);
        }
      } catch {
        // Non-blocking — interaction check failure shouldn't block dispensing
      } finally {
        setCheckingInteractions(false);
      }
    }
  };

  // ── Verify ────────────────────────────────────────────────────────────────
  const handleVerify = async (overrideReason?: string) => {
    if (!selected) return;
    setActionLoading(true);
    setError('');
    try {
      const res = await fetch('/api/pharmacy/dispense', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prescriptionId: selected.id,
          action: 'verify',
          notes: notes || undefined,
          interactionOverrideReason: overrideReason || undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error || tr('فشل التحقق من الوصفة', 'Verification failed'));
      }
      toast({
        title: tr('تم التحقق من الوصفة', 'Prescription verified'),
        description: `${selected.medication} — ${selected.patientName}`,
      });
      mutate();
      setSelected(null);
      setNotes('');
      setInteractionResult(null);
      setInteractionOverrideReason('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  // ── Dispense ──────────────────────────────────────────────────────────────
  const handleDispense = async () => {
    if (!selected) return;
    setActionLoading(true);
    setError('');
    try {
      const res = await fetch('/api/pharmacy/dispense', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prescriptionId: selected.id,
          action: 'dispense',
          notes: notes || undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error || tr('فشل صرف الدواء', 'Dispense failed'));
      }
      printMedicationLabel(selected);
      toast({
        title: tr('تم صرف الدواء بنجاح', 'Medication dispensed'),
        description: `${selected.medication} — ${selected.patientName}`,
      });
      mutate();
      setSelected(null);
      setNotes('');
      setInteractionResult(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  // ── Cancel ────────────────────────────────────────────────────────────────
  const handleCancelConfirm = async (reason: string) => {
    if (!selected) return;
    setActionLoading(true);
    setError('');
    try {
      const res = await fetch('/api/pharmacy/dispense', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prescriptionId: selected.id,
          action: 'cancel',
          cancellationReason: reason,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error || tr('فشل إلغاء الوصفة', 'Cancellation failed'));
      }
      toast({
        title: tr('تم إلغاء الوصفة', 'Prescription cancelled'),
        description: reason,
        variant: 'destructive',
      });
      mutate();
      setShowCancelDialog(false);
      setSelected(null);
      setInteractionResult(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  // ── Print medication label ────────────────────────────────────────────────
  const printMedicationLabel = (item: PrescriptionItem) => {
    const printWindow = window.open('', '_blank', 'width=420,height=340');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
      <head>
        <meta charset="utf-8">
        <title>Medication Label</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 12px; direction: rtl; }
          .label { border: 2px solid #000; padding: 12px; width: 280px; border-radius: 6px; }
          .hospital { font-size: 11px; color: #555; margin-bottom: 6px; }
          .drug { font-size: 15px; font-weight: bold; margin-bottom: 4px; }
          .detail { font-size: 12px; margin: 2px 0; color: #333; }
          .warning { font-size: 11px; color: #c00; margin-top: 8px; border-top: 1px solid #eee; padding-top: 4px; }
          hr { border: none; border-top: 1px dashed #ccc; margin: 6px 0; }
        </style>
      </head>
      <body>
        <div class="label">
          <div class="hospital">Thea EHR — الصيدلية</div>
          <hr>
          <div class="drug">${item.medication}${item.strength ? ' ' + item.strength : ''}</div>
          ${item.genericName ? `<div class="detail">المادة الفعالة: ${item.genericName}</div>` : ''}
          <hr>
          <div class="detail">${item.patientName}</div>
          <div class="detail">رقم الملف: ${item.mrn}</div>
          ${item.doctorName ? `<div class="detail">الطبيب: ${item.doctorName}</div>` : ''}
          <hr>
          <div class="detail">${item.frequency} — ${item.duration}</div>
          <div class="detail">الكمية: ${item.quantity} ${item.form || ''}</div>
          ${item.instructions ? `<div class="detail">تعليمات: ${item.instructions}</div>` : ''}
          <div class="detail">تاريخ الصرف: ${new Date().toLocaleDateString('ar-SA')}</div>
          <div class="warning">&#9888; يُحفظ بعيداً عن متناول الأطفال</div>
        </div>
        <script>window.print(); window.close();<\/script>
      </body>
      </html>
    `);
  };

  const overallSeverity = interactionResult?.summary?.overallSeverity ?? 'none';
  const hasCriticalInteraction = overallSeverity === 'critical';

  return (
    <div className="min-h-screen bg-background p-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">
            {tr('صرف الأدوية', 'Pharmacy Dispensing')}
          </h1>
          <p className="text-muted-foreground text-sm">
            {tr('التحقق من الوصفات وصرف الأدوية وفحص التفاعلات الدوائية', 'Verify prescriptions, dispense medications, and check drug interactions')}
          </p>
        </div>

        {/* Tab Bar + Search */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
          <div className="flex gap-2 flex-wrap">
            {QUEUE_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => {
                  setActiveTab(tab.value);
                  setSelected(null);
                  setInteractionResult(null);
                  setError('');
                }}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  activeTab === tab.value
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {tr(tab.labelAr, tab.labelEn)}
              </button>
            ))}
          </div>
          <div className="flex-1 max-w-xs">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={tr('بحث باسم المريض، الرقم، أو الدواء...', 'Search by patient, MRN, or medication...')}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* ── Left: Queue ─────────────────────────────────────────────── */}
          <div className="lg:col-span-2">
            <div className="bg-card rounded-2xl border border-border overflow-hidden">
              <div className="p-4 border-b border-border bg-muted/30 flex items-center justify-between">
                <h2 className="font-semibold text-foreground">
                  {tr('قائمة الانتظار', 'Queue')}
                </h2>
                {items.length > 0 && (
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">
                    {items.length}
                  </span>
                )}
              </div>
              <div className="divide-y divide-border/50 max-h-[620px] overflow-y-auto">
                {items.length === 0 ? (
                  <div className="p-8 text-center">
                    <div className="flex justify-center mb-2"><Pill className="h-8 w-8 text-muted-foreground" /></div>
                    <p className="text-sm text-muted-foreground">
                      {search
                        ? tr('لا توجد نتائج للبحث', 'No results for search')
                        : tr('لا توجد وصفات في هذه الحالة', 'No prescriptions in this queue')}
                    </p>
                  </div>
                ) : (
                  items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleSelect(item)}
                      className={`w-full p-4 text-start transition-colors hover:bg-muted/40 ${
                        selected?.id === item.id
                          ? language === 'ar'
                            ? 'bg-blue-50 border-l-4 border-blue-500'
                            : 'bg-blue-50 border-r-4 border-blue-500'
                          : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-foreground text-sm truncate">
                            {item.patientName}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {tr('ملف:', 'MRN:')} {item.mrn}
                          </div>
                          <div className="text-xs font-medium text-foreground mt-1 truncate">
                            {language === 'ar'
                              ? item.medicationAr || item.medication
                              : item.medication}
                            {item.strength ? ` ${item.strength}` : ''}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {item.frequency} · {item.duration}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          {priorityBadge(item.priority, language)}
                          {statusBadge(item.status, language)}
                          <div className="text-[10px] text-muted-foreground">
                            {new Date(item.prescribedAt).toLocaleTimeString(
                              language === 'ar' ? 'ar-SA' : 'en-US',
                              { hour: '2-digit', minute: '2-digit' }
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* ── Right: Detail Panel ──────────────────────────────────────── */}
          <div className="lg:col-span-3">
            {selected ? (
              <div className="bg-card rounded-2xl border border-border overflow-hidden flex flex-col">
                {/* Patient header */}
                <div
                  className={`px-5 py-4 ${
                    hasCriticalInteraction
                      ? 'bg-gradient-to-r from-red-600 to-red-700'
                      : 'bg-gradient-to-r from-blue-600 to-blue-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-bold text-white">{selected.patientName}</h2>
                      <p className="text-blue-100 text-sm">
                        {tr('رقم الملف:', 'MRN:')} {selected.mrn}
                        {selected.doctorName
                          ? ` · ${tr('د.', 'Dr.')} ${selected.doctorName}`
                          : ''}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {priorityBadge(selected.priority, language)}
                      {hasCriticalInteraction && (
                        <span className="text-white text-xs font-bold bg-red-800/60 px-2 py-0.5 rounded-lg">
                          {tr('تفاعل حرج', 'Critical Interaction')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Body */}
                <div className="p-5 space-y-4 flex-1 overflow-y-auto">
                  {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-2 text-sm">
                      {error}
                    </div>
                  )}

                  {/* Medication card */}
                  <div className="bg-muted/40 rounded-xl p-4">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                      {tr('تفاصيل الوصفة', 'Prescription Details')}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="text-xs text-muted-foreground">
                          {tr('الدواء', 'Medication')}
                        </div>
                        <div className="font-semibold text-foreground">
                          {language === 'ar'
                            ? selected.medicationAr || selected.medication
                            : selected.medication}
                        </div>
                        {selected.genericName && (
                          <div className="text-xs text-muted-foreground">{selected.genericName}</div>
                        )}
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">
                          {tr('التركيز', 'Strength')}
                        </div>
                        <div className="font-semibold text-foreground">
                          {selected.strength || '—'}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">
                          {tr('الجرعة والتكرار', 'Frequency')}
                        </div>
                        <div className="font-medium text-foreground">{selected.frequency}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">{tr('المدة', 'Duration')}</div>
                        <div className="font-medium text-foreground">{selected.duration}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">
                          {tr('الكمية', 'Quantity')}
                        </div>
                        <div className="font-bold text-foreground text-lg">{selected.quantity}</div>
                      </div>
                      {selected.route && (
                        <div>
                          <div className="text-xs text-muted-foreground">
                            {tr('طريقة الإعطاء', 'Route')}
                          </div>
                          <div className="font-medium text-foreground">{selected.route}</div>
                        </div>
                      )}
                    </div>
                    {(selected.instructions || selected.instructionsAr) && (
                      <div className="mt-3 pt-3 border-t border-border/50">
                        <div className="text-xs text-muted-foreground">
                          {tr('تعليمات', 'Instructions')}
                        </div>
                        <div className="text-sm text-foreground mt-0.5">
                          {language === 'ar'
                            ? selected.instructionsAr || selected.instructions
                            : selected.instructions}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Drug Interaction Result */}
                  {checkingInteractions ? (
                    <div className="bg-muted/30 rounded-xl p-3 flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {tr('جاري فحص التفاعلات الدوائية...', 'Checking drug interactions...')}
                    </div>
                  ) : (
                    interactionResult && (
                      <div
                        className={`rounded-xl p-4 border ${interactionSeverityClasses(overallSeverity)}`}
                      >
                        <div className="flex items-start gap-2 mb-2">
                          <span className="text-lg mt-0.5">{interactionIcon(overallSeverity)}</span>
                          <div className="flex-1">
                            <span className="font-semibold text-sm">
                              {overallSeverity === 'none'
                                ? tr('لا توجد تفاعلات دوائية معروفة', 'No known drug interactions')
                                : overallSeverity === 'critical'
                                ? tr('تحذير حرج: تفاعل دوائي خطير', 'Critical Alert: Dangerous Drug Interaction')
                                : overallSeverity === 'major'
                                ? tr('تنبيه: تفاعل دوائي مهم', 'Alert: Major Drug Interaction')
                                : tr('تفاعل دوائي بسيط', 'Minor Drug Interaction')}
                            </span>
                            {interactionResult.currentMedications.length > 0 && (
                              <div className="text-xs mt-0.5 opacity-70">
                                {tr('فُحص ضد:', 'Checked against:')} {interactionResult.currentMedications.join(', ')}
                              </div>
                            )}
                          </div>
                        </div>
                        {interactionResult.interactions.map((interaction, i) => (
                          <div key={i} className="mt-2 text-sm border-t border-current/10 pt-2">
                            <div className="font-medium">
                              {interaction.description
                                ? language === 'ar'
                                  ? interaction.description.ar
                                  : interaction.description.en
                                : `${interaction.drug1} + ${interaction.drug2}`}
                            </div>
                            {interaction.recommendation && (
                              <div className="text-xs mt-0.5 opacity-80">
                                {tr('التوصية:', 'Recommendation:')}{' '}
                                {language === 'ar'
                                  ? interaction.recommendation.ar
                                  : interaction.recommendation.en}
                              </div>
                            )}
                          </div>
                        ))}
                        {/* Override button for critical interactions (pharmacist override flow) */}
                        {hasCriticalInteraction && selected.status === 'PENDING' && (
                          <div className="mt-3 pt-3 border-t border-red-200">
                            {interactionOverrideReason ? (
                              <div className="text-xs text-red-700 bg-red-100 rounded-lg px-3 py-2">
                                ✓ {tr('تم توثيق المبرر السريري', 'Clinical justification documented')}:{' '}
                                {interactionOverrideReason}
                                <button
                                  onClick={() => setInteractionOverrideReason('')}
                                  className="mr-2 text-red-400 hover:text-red-600"
                                >
                                  ×
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setShowCriticalOverride(true)}
                                className="text-xs text-red-600 hover:text-red-800 underline"
                              >
                                {tr(
                                  'للمتابعة رغم التحذير — أدخل المبرر السريري',
                                  'To proceed despite warning — enter clinical justification'
                                )}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  )}

                  {/* Verification Notes (if already verified) */}
                  {selected.status === 'VERIFIED' && selected.verificationNotes && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                      <div className="text-xs font-semibold text-blue-700 mb-1">
                        {tr('ملاحظات التحقق', 'Verification Notes')}
                      </div>
                      <div className="text-sm text-blue-800">{selected.verificationNotes}</div>
                      {selected.verifierName && (
                        <div className="text-xs text-blue-500 mt-1">
                          {tr('بواسطة:', 'By:')} {selected.verifierName}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Pharmacist Notes input */}
                  {selected.status !== 'DISPENSED' && selected.status !== 'CANCELLED' && (
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">
                        {tr('ملاحظات الصيدلي', 'Pharmacist Notes')}
                        <span className="text-muted-foreground font-normal ms-1">
                          {tr('(اختياري)', '(optional)')}
                        </span>
                      </label>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        placeholder={tr('ملاحظات أو تحذيرات للمريض...', 'Notes or patient warnings...')}
                      />
                    </div>
                  )}
                </div>

                {/* Action Footer */}
                <div className="px-5 py-4 border-t border-border bg-muted/30 flex items-center gap-3 justify-between">
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setSelected(null);
                        setInteractionResult(null);
                        setError('');
                        setInteractionOverrideReason('');
                      }}
                      className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground border border-border rounded-xl hover:bg-muted transition-colors"
                    >
                      {tr('إغلاق', 'Close')}
                    </button>
                    {selected.status !== 'DISPENSED' && selected.status !== 'CANCELLED' && (
                      <button
                        onClick={() => setShowCancelDialog(true)}
                        disabled={actionLoading}
                        className="px-4 py-2 text-sm text-red-600 hover:text-red-700 border border-red-200 rounded-xl hover:bg-red-50 transition-colors disabled:opacity-50"
                      >
                        {tr('إلغاء الوصفة', 'Cancel Rx')}
                      </button>
                    )}
                  </div>

                  <div className="flex gap-3">
                    {selected.status === 'PENDING' && (
                      <button
                        onClick={() => {
                          // If critical interaction without override, require justification first
                          if (hasCriticalInteraction && !interactionOverrideReason) {
                            setShowCriticalOverride(true);
                            return;
                          }
                          handleVerify(interactionOverrideReason || undefined);
                        }}
                        disabled={actionLoading}
                        className={`px-5 py-2 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2 ${
                          hasCriticalInteraction && !interactionOverrideReason
                            ? 'bg-red-500 hover:bg-red-600'
                            : 'bg-blue-600 hover:bg-blue-700'
                        }`}
                      >
                        {actionLoading ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-3 w-3" />
                        )}
                        {tr('تحقق من الوصفة', 'Verify Prescription')}
                      </button>
                    )}

                    {selected.status === 'VERIFIED' && (
                      <button
                        onClick={handleDispense}
                        disabled={actionLoading}
                        className="px-5 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                      >
                        {actionLoading ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Pill className="h-3 w-3" />
                        )}
                        {tr('صرف وطباعة ملصق', 'Dispense & Print Label')}
                      </button>
                    )}

                    {selected.status === 'DISPENSED' && (
                      <button
                        onClick={() => printMedicationLabel(selected)}
                        className="px-5 py-2 bg-muted text-foreground rounded-xl text-sm font-medium hover:bg-muted/80 transition-colors flex items-center gap-2"
                      >
                        <Printer className="h-4 w-4" /> {tr('إعادة طباعة الملصق', 'Reprint Label')}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* Empty state */
              <div className="bg-card rounded-2xl border border-border h-full min-h-[400px] flex flex-col items-center justify-center text-center p-12">
                <div className="flex justify-center mb-4"><Pill className="h-12 w-12 text-muted-foreground" /></div>
                <h3 className="text-lg font-semibold text-foreground mb-1">
                  {tr('اختر وصفة من القائمة', 'Select a prescription')}
                </h3>
                <p className="text-sm text-muted-foreground max-w-xs">
                  {tr(
                    'اختر وصفة من القائمة لمراجعة التفاصيل والتحقق وصرف الدواء',
                    'Choose a prescription from the queue to review, verify, and dispense'
                  )}
                </p>

                {/* Workflow guide */}
                <div className="mt-8 flex items-center gap-3 text-xs text-muted-foreground">
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                      1
                    </div>
                    <span>{tr('معلقة', 'Pending')}</span>
                  </div>
                  <div className="text-muted-foreground/50">→</div>
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                      2
                    </div>
                    <span>{tr('تحقق', 'Verify')}</span>
                  </div>
                  <div className="text-muted-foreground/50">→</div>
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                      3
                    </div>
                    <span>{tr('صرف', 'Dispense')}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Cancel Dialog ─────────────────────────────────────────────────── */}
      {showCancelDialog && selected && (
        <CancelDialog
          language={language}
          loading={actionLoading}
          onClose={() => setShowCancelDialog(false)}
          onConfirm={handleCancelConfirm}
        />
      )}

      {/* ── Critical Override Dialog ──────────────────────────────────────── */}
      {showCriticalOverride && (
        <CriticalOverrideDialog
          language={language}
          onClose={() => setShowCriticalOverride(false)}
          onConfirm={(reason) => {
            setInteractionOverrideReason(reason);
            setShowCriticalOverride(false);
          }}
        />
      )}
    </div>
  );
}
