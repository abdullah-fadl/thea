'use client';

import useSWR, { mutate } from 'swr';
import { useState, useMemo } from 'react';
import { useLang } from '@/hooks/use-lang';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/components/ui/confirm-modal';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

type VerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';

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
  status: string;
  priority?: string;
  prescribedAt: string;
  doctorName?: string;
  verifiedAt?: string;
  verifiedBy?: string;
  verifierName?: string;
  verificationNotes?: string;
  rejectionReason?: string;
  encounterId?: string;
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

interface AllergyAlert {
  allergen: string;
  severity: string;
  reaction?: string;
}

const TABS: { value: VerificationStatus | 'ALL'; labelAr: string; labelEn: string }[] = [
  { value: 'PENDING', labelAr: 'معلقة', labelEn: 'Pending' },
  { value: 'VERIFIED', labelAr: 'محققة', labelEn: 'Verified' },
  { value: 'REJECTED', labelAr: 'مرفوضة', labelEn: 'Rejected' },
  { value: 'ALL', labelAr: 'الكل', labelEn: 'All' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Status Badge
// ─────────────────────────────────────────────────────────────────────────────

function statusBadge(status: string, language: string) {
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
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
          {tr('محققة', 'Verified')}
        </span>
      );
    case 'REJECTED':
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">
          {tr('مرفوضة', 'Rejected')}
        </span>
      );
    default:
      return null;
  }
}

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

// ─────────────────────────────────────────────────────────────────────────────
// Verify Dialog
// ─────────────────────────────────────────────────────────────────────────────

function VerifyDialog({
  prescription,
  onConfirm,
  onClose,
  loading,
  language,
}: {
  prescription: PrescriptionItem;
  onConfirm: (notes: string, overriddenInteractions: string[]) => void;
  onClose: () => void;
  loading: boolean;
  language: string;
}) {
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const [notes, setNotes] = useState('');
  const [overriddenInteractions, setOverriddenInteractions] = useState<string[]>([]);
  const [interactionData, setInteractionData] = useState<DrugInteractionResult | null>(null);
  const [interactionsLoading, setInteractionsLoading] = useState(true);
  const [allergyAlerts, setAllergyAlerts] = useState<AllergyAlert[]>([]);

  // Fetch drug interactions on mount
  useState(() => {
    const fetchInteractions = async () => {
      try {
        const res = await fetch('/api/pharmacy/drug-interactions', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            newDrug: prescription.genericName || prescription.medication,
            patientMrn: prescription.mrn,
            excludeId: prescription.id,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setInteractionData(data);
        }
      } catch {
        // Non-blocking
      }

      // Fetch allergy alerts
      if (prescription.patientId) {
        try {
          const res = await fetch(
            `/api/patients/${prescription.patientId}/allergies`,
            { credentials: 'include' }
          );
          if (res.ok) {
            const data = await res.json();
            setAllergyAlerts(
              (data.allergies || data.items || []).map((a: any) => ({
                allergen: a.allergen || a.substance || '',
                severity: a.severity || 'unknown',
                reaction: a.reaction || a.manifestation || '',
              }))
            );
          }
        } catch {
          // Non-blocking
        }
      }

      setInteractionsLoading(false);
    };
    fetchInteractions();
  });

  const toggleOverride = (interactionKey: string) => {
    setOverriddenInteractions((prev) =>
      prev.includes(interactionKey)
        ? prev.filter((k) => k !== interactionKey)
        : [...prev, interactionKey]
    );
  };

  const hasCritical = interactionData?.summary?.critical ? interactionData.summary.critical > 0 : false;
  const hasMajor = interactionData?.summary?.major ? interactionData.summary.major > 0 : false;
  const hasInteractions = (interactionData?.interactions?.length || 0) > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 overflow-auto">
      <div
        className="bg-card rounded-2xl shadow-2xl border border-border w-full max-w-2xl mx-4 my-8 max-h-[90vh] overflow-y-auto"
        dir={language === 'ar' ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-border sticky top-0 bg-card rounded-t-2xl z-10">
          <h3 className="text-base font-bold text-foreground">
            {tr('التحقق من الوصفة', 'Verify Prescription')}
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            {prescription.medication} {prescription.strength} - {prescription.patientName}
          </p>
        </div>

        <div className="p-6 space-y-5">
          {/* Prescription Details */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">{tr('الدواء', 'Medication')}</span>
              <p className="font-medium text-foreground">
                {language === 'ar' && prescription.medicationAr
                  ? prescription.medicationAr
                  : prescription.medication}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">{tr('الجرعة', 'Dose')}</span>
              <p className="font-medium text-foreground">{prescription.strength}</p>
            </div>
            <div>
              <span className="text-muted-foreground">{tr('الطريق', 'Route')}</span>
              <p className="font-medium text-foreground">{prescription.route || '-'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">{tr('التكرار', 'Frequency')}</span>
              <p className="font-medium text-foreground">{prescription.frequency}</p>
            </div>
            <div>
              <span className="text-muted-foreground">{tr('المدة', 'Duration')}</span>
              <p className="font-medium text-foreground">{prescription.duration}</p>
            </div>
            <div>
              <span className="text-muted-foreground">{tr('الكمية', 'Quantity')}</span>
              <p className="font-medium text-foreground">{prescription.quantity}</p>
            </div>
            <div>
              <span className="text-muted-foreground">{tr('الواصف', 'Prescriber')}</span>
              <p className="font-medium text-foreground">{prescription.doctorName || '-'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">{tr('التعليمات', 'Instructions')}</span>
              <p className="font-medium text-foreground">
                {language === 'ar' && prescription.instructionsAr
                  ? prescription.instructionsAr
                  : prescription.instructions || '-'}
              </p>
            </div>
          </div>

          {/* Loading */}
          {interactionsLoading && (
            <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
              <span className="animate-spin mr-2">...</span>
              {tr('جارٍ فحص التفاعلات الدوائية...', 'Checking drug interactions...')}
            </div>
          )}

          {/* Allergy Alerts */}
          {allergyAlerts.length > 0 && (
            <div className="border border-red-300 bg-red-50 rounded-xl p-4">
              <h4 className="text-sm font-bold text-red-800 mb-2">
                {tr('تنبيهات الحساسية', 'Allergy Alerts')}
              </h4>
              <div className="space-y-1">
                {allergyAlerts.map((alert, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm text-red-700">
                    <span className="font-medium">{alert.allergen}</span>
                    <span className="text-red-500">({alert.severity})</span>
                    {alert.reaction && <span>- {alert.reaction}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Drug Interactions */}
          {!interactionsLoading && hasInteractions && interactionData && (
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-foreground">
                {tr('التفاعلات الدوائية', 'Drug Interactions')} ({interactionData.summary.total})
              </h4>
              {interactionData.interactions.map((interaction, idx) => {
                const key = `${interaction.drug1}-${interaction.drug2}-${idx}`;
                const isOverridden = overriddenInteractions.includes(key);
                return (
                  <div
                    key={key}
                    className={`border rounded-xl p-3 ${interactionSeverityClasses(interaction.severity)}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold uppercase">{interaction.severity}</span>
                          <span className="text-sm font-medium">
                            {interaction.drug1} + {interaction.drug2}
                          </span>
                        </div>
                        <p className="text-xs">
                          {language === 'ar'
                            ? interaction.description?.ar || interaction.description?.en || ''
                            : interaction.description?.en || ''}
                        </p>
                        {interaction.recommendation && (
                          <p className="text-xs mt-1 italic">
                            {language === 'ar'
                              ? interaction.recommendation.ar || interaction.recommendation.en || ''
                              : interaction.recommendation.en || ''}
                          </p>
                        )}
                      </div>
                      {(interaction.severity === 'critical' || interaction.severity === 'major') && (
                        <button
                          onClick={() => toggleOverride(key)}
                          className={`px-2 py-1 text-[10px] font-bold rounded-lg border transition-colors ${
                            isOverridden
                              ? 'bg-amber-200 border-amber-400 text-amber-800'
                              : 'bg-white/60 border-current hover:bg-card'
                          }`}
                        >
                          {isOverridden
                            ? tr('تم التجاوز', 'Overridden')
                            : tr('تجاوز', 'Override')}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* No interactions */}
          {!interactionsLoading && !hasInteractions && (
            <div className="border border-emerald-300 bg-emerald-50 rounded-xl p-4 text-sm text-emerald-700 font-medium text-center">
              {tr('لا توجد تفاعلات دوائية مكتشفة', 'No drug interactions detected')}
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {tr('ملاحظات التحقق (اختياري)', 'Verification Notes (optional)')}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
              placeholder={tr('أدخل ملاحظات...', 'Enter notes...')}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 flex justify-end gap-3 sticky bottom-0 bg-card border-t border-border pt-4">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm border border-border rounded-xl hover:bg-muted transition-colors disabled:opacity-50"
          >
            {tr('إلغاء', 'Cancel')}
          </button>
          <button
            onClick={() => onConfirm(notes, overriddenInteractions)}
            disabled={
              loading ||
              interactionsLoading ||
              ((hasCritical || hasMajor) &&
                overriddenInteractions.length <
                  (interactionData?.interactions?.filter(
                    (i) => i.severity === 'critical' || i.severity === 'major'
                  ).length || 0))
            }
            className="px-5 py-2 text-sm bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {loading && <span className="animate-spin text-xs">...</span>}
            {tr('تأكيد التحقق', 'Confirm Verification')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Reject Dialog
// ─────────────────────────────────────────────────────────────────────────────

function RejectDialog({
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
    { ar: 'جرعة غير مناسبة', en: 'Inappropriate dose' },
    { ar: 'تفاعل دوائي خطير', en: 'Serious drug interaction' },
    { ar: 'حساسية معروفة', en: 'Known allergy' },
    { ar: 'تكرار وصفة', en: 'Duplicate prescription' },
    { ar: 'خطأ في الدواء', en: 'Wrong medication' },
    { ar: 'مخالفة للبروتوكول', en: 'Protocol violation' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div
        className="bg-card rounded-2xl shadow-2xl border border-border w-full max-w-md mx-4"
        dir={language === 'ar' ? 'rtl' : 'ltr'}
      >
        <div className="px-6 py-4 border-b border-border">
          <h3 className="text-base font-bold text-foreground">
            {tr('رفض الوصفة', 'Reject Prescription')}
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            {tr('يرجى تحديد سبب الرفض', 'Please specify a rejection reason')}
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
            {loading && <span className="animate-spin text-xs">...</span>}
            {tr('تأكيد الرفض', 'Confirm Rejection')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export default function PharmacyVerification() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { toast } = useToast();
  const { confirm: showConfirm } = useConfirm();

  const [activeTab, setActiveTab] = useState<VerificationStatus | 'ALL'>('PENDING');
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [verifyTarget, setVerifyTarget] = useState<PrescriptionItem | null>(null);
  const [rejectTarget, setRejectTarget] = useState<PrescriptionItem | null>(null);

  // Data fetching
  const statusParam = activeTab === 'ALL' ? '' : activeTab;
  const searchParam = search ? `&search=${encodeURIComponent(search)}` : '';
  const apiUrl = `/api/pharmacy/prescriptions?status=${statusParam}${searchParam}`;

  const { data, isLoading, mutate: mutateList } = useSWR(apiUrl, fetcher, {
    refreshInterval: 15000,
  });

  // Stats
  const { data: statsData } = useSWR('/api/pharmacy/stats', fetcher, {
    refreshInterval: 30000,
  });
  const stats = statsData || {};

  const items: PrescriptionItem[] = useMemo(() => {
    const raw = data?.items || [];
    if (activeTab === 'ALL') return raw;
    // Filter in case API returns broader set
    return raw.filter((i: PrescriptionItem) => {
      if (activeTab === 'REJECTED') return i.status === 'REJECTED' || i.status === 'CANCELLED';
      return i.status === activeTab;
    });
  }, [data, activeTab]);

  const pendingItems = useMemo(
    () => items.filter((i) => i.status === 'PENDING'),
    [items]
  );

  // ── Actions ──

  async function handleVerify(notes: string, overriddenInteractions: string[]) {
    if (!verifyTarget) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/pharmacy/verify', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prescriptionId: verifyTarget.id,
          action: 'verify',
          notes: notes || undefined,
          overriddenInteractions: overriddenInteractions.length > 0 ? overriddenInteractions : undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed');
      }
      toast({ title: tr('تم التحقق بنجاح', 'Verification successful') });
      setVerifyTarget(null);
      mutateList();
      mutate('/api/pharmacy/stats');
    } catch (err: any) {
      toast({ title: tr('فشل التحقق', 'Verification failed'), description: err.message, variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReject(reason: string) {
    if (!rejectTarget) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/pharmacy/verify', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prescriptionId: rejectTarget.id,
          action: 'reject',
          notes: reason,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed');
      }
      toast({ title: tr('تم رفض الوصفة', 'Prescription rejected') });
      setRejectTarget(null);
      mutateList();
      mutate('/api/pharmacy/stats');
    } catch (err: any) {
      toast({ title: tr('فشل الرفض', 'Rejection failed'), description: err.message, variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleBulkVerify() {
    const ids = selectedIds.length > 0 ? selectedIds : pendingItems.map((i) => i.id);
    if (ids.length === 0) return;

    const confirmed = await showConfirm(
      tr(
        `هل تريد التحقق من ${ids.length} وصفة؟`,
        `Verify ${ids.length} prescription(s)?`
      )
    );
    if (!confirmed) return;

    setActionLoading(true);
    let successCount = 0;
    let failCount = 0;

    for (const id of ids) {
      try {
        const res = await fetch('/api/pharmacy/verify', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prescriptionId: id, action: 'verify' }),
        });
        if (res.ok) successCount++;
        else failCount++;
      } catch {
        failCount++;
      }
    }

    toast({
      title: tr('اكتمل التحقق الجماعي', 'Bulk verification complete'),
      description: tr(
        `تم التحقق: ${successCount}، فشل: ${failCount}`,
        `Verified: ${successCount}, Failed: ${failCount}`
      ),
    });
    setSelectedIds([]);
    mutateList();
    mutate('/api/pharmacy/stats');
    setActionLoading(false);
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }

  function toggleSelectAll() {
    if (selectedIds.length === pendingItems.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(pendingItems.map((i) => i.id));
    }
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="min-h-screen bg-background p-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {tr('التحقق الصيدلاني', 'Pharmacist Verification')}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {tr('مراجعة الوصفات الطبية والتحقق منها أو رفضها', 'Review prescriptions and verify or reject them')}
            </p>
          </div>
          {activeTab === 'PENDING' && pendingItems.length > 0 && (
            <button
              onClick={handleBulkVerify}
              disabled={actionLoading}
              className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center gap-2 shrink-0"
            >
              {actionLoading && <span className="animate-spin text-xs">...</span>}
              {tr(
                `تحقق الكل (${selectedIds.length > 0 ? selectedIds.length : pendingItems.length})`,
                `Verify All (${selectedIds.length > 0 ? selectedIds.length : pendingItems.length})`
              )}
            </button>
          )}
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-card border border-border rounded-2xl p-4">
            <p className="text-xs text-muted-foreground">{tr('معلقة', 'Pending')}</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">{stats.pending ?? 0}</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4">
            <p className="text-xs text-muted-foreground">{tr('تم التحقق اليوم', 'Verified Today')}</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{stats.verifiedToday ?? 0}</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4">
            <p className="text-xs text-muted-foreground">{tr('مرفوضة اليوم', 'Rejected Today')}</p>
            <p className="text-2xl font-bold text-red-600 mt-1">{stats.rejectedToday ?? 0}</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4">
            <p className="text-xs text-muted-foreground">{tr('متوسط وقت التحقق', 'Avg Verification Time')}</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">
              {stats.avgVerificationMinutes != null
                ? `${Math.round(stats.avgVerificationMinutes)} ${tr('د', 'min')}`
                : '-'}
            </p>
          </div>
        </div>

        {/* Search + Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tr('بحث بالاسم أو الدواء...', 'Search by patient or medication...')}
            className="flex-1 px-4 py-2.5 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <div className="flex gap-1 bg-muted/40 p-1 rounded-xl">
            {TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => {
                  setActiveTab(tab.value);
                  setSelectedIds([]);
                }}
                className={`px-3.5 py-1.5 text-sm rounded-lg transition-colors ${
                  activeTab === tab.value
                    ? 'bg-card text-foreground font-semibold shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tr(tab.labelAr, tab.labelEn)}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
              {tr('جارٍ التحميل...', 'Loading...')}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <p className="text-lg font-medium">{tr('لا توجد وصفات', 'No prescriptions found')}</p>
              <p className="text-sm mt-1">
                {tr('لا توجد وصفات تطابق المعايير الحالية', 'No prescriptions match the current criteria')}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {activeTab === 'PENDING' && (
                      <th className="px-4 py-3 text-start">
                        <input
                          type="checkbox"
                          checked={selectedIds.length === pendingItems.length && pendingItems.length > 0}
                          onChange={toggleSelectAll}
                          className="rounded"
                        />
                      </th>
                    )}
                    <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                      {tr('المريض', 'Patient')}
                    </th>
                    <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                      {tr('الدواء', 'Medication')}
                    </th>
                    <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                      {tr('الجرعة', 'Dose')}
                    </th>
                    <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                      {tr('الطريق', 'Route')}
                    </th>
                    <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                      {tr('التكرار', 'Frequency')}
                    </th>
                    <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                      {tr('الواصف', 'Prescriber')}
                    </th>
                    <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                      {tr('التاريخ', 'Date')}
                    </th>
                    <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                      {tr('الحالة', 'Status')}
                    </th>
                    <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                      {tr('إجراءات', 'Actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map((rx) => (
                    <tr key={rx.id} className="hover:bg-muted/20 transition-colors">
                      {activeTab === 'PENDING' && (
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(rx.id)}
                            onChange={() => toggleSelect(rx.id)}
                            className="rounded"
                          />
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{rx.patientName}</div>
                        <div className="text-xs text-muted-foreground">{rx.mrn}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">
                          {language === 'ar' && rx.medicationAr ? rx.medicationAr : rx.medication}
                        </div>
                        {rx.genericName && (
                          <div className="text-xs text-muted-foreground">{rx.genericName}</div>
                        )}
                        {priorityBadge(rx.priority, language)}
                      </td>
                      <td className="px-4 py-3 text-foreground">{rx.strength}</td>
                      <td className="px-4 py-3 text-foreground">{rx.route || '-'}</td>
                      <td className="px-4 py-3 text-foreground">{rx.frequency}</td>
                      <td className="px-4 py-3 text-foreground">{rx.doctorName || '-'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(rx.prescribedAt)}</td>
                      <td className="px-4 py-3">{statusBadge(rx.status, language)}</td>
                      <td className="px-4 py-3">
                        {rx.status === 'PENDING' && (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => setVerifyTarget(rx)}
                              disabled={actionLoading}
                              className="px-3 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                            >
                              {tr('تحقق', 'Verify')}
                            </button>
                            <button
                              onClick={() => setRejectTarget(rx)}
                              disabled={actionLoading}
                              className="px-3 py-1.5 text-xs font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                            >
                              {tr('رفض', 'Reject')}
                            </button>
                          </div>
                        )}
                        {rx.status === 'VERIFIED' && rx.verifierName && (
                          <div className="text-xs text-muted-foreground">
                            {tr('بواسطة', 'By')} {rx.verifierName}
                          </div>
                        )}
                        {(rx.status === 'REJECTED' || rx.status === 'CANCELLED') && rx.rejectionReason && (
                          <div className="text-xs text-red-600 max-w-[200px] truncate" title={rx.rejectionReason}>
                            {rx.rejectionReason}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Dialogs */}
      {verifyTarget && (
        <VerifyDialog
          prescription={verifyTarget}
          onConfirm={handleVerify}
          onClose={() => setVerifyTarget(null)}
          loading={actionLoading}
          language={language}
        />
      )}
      {rejectTarget && (
        <RejectDialog
          onConfirm={handleReject}
          onClose={() => setRejectTarget(null)}
          loading={actionLoading}
          language={language}
        />
      )}
    </div>
  );
}
