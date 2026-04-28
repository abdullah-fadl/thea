'use client';

import { useState, useCallback } from 'react';
import useSWR from 'swr';
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  FileCheck,
  Play,
  Syringe,
  Stethoscope,
  User,
  X,
  Clipboard,
  Square,
  AlertCircle,
} from 'lucide-react';
import { ConsentForm, type ConsentData } from '@/components/consent/ConsentForm';
import { getAge, formatGender } from '@/lib/opd/ui-helpers';
import { useLang } from '@/hooks/use-lang';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

// ── Time-Out checklist structure ─────────────────────────────────────────────

const TIMEOUT_PHASES = [
  {
    key: 'signIn',
    label: { ar: 'المرحلة 1: التسجيل (قبل التخدير)', en: 'Phase 1: Sign In (Pre-Anesthesia)' },
    items: [
      { key: 'patientIdentified', ar: 'تم التعرف على المريض', en: 'Patient identified' },
      { key: 'procedureConfirmed', ar: 'تم تأكيد الإجراء', en: 'Procedure confirmed' },
      { key: 'siteMarked', ar: 'تم وضع علامة الموقع', en: 'Site marked' },
      { key: 'consentSigned', ar: 'تم توقيع الموافقة', en: 'Consent signed' },
      { key: 'allergiesReviewed', ar: 'تم مراجعة الحساسية', en: 'Allergies reviewed' },
    ],
  },
  {
    key: 'timeOut',
    label: { ar: 'المرحلة 2: التحقق الزمني (قبل الإجراء)', en: 'Phase 2: Time Out (Pre-Procedure)' },
    items: [
      { key: 'teamConfirmed', ar: 'تم تأكيد الفريق', en: 'Team confirmed' },
      { key: 'patientProcedureConfirmed', ar: 'تم تأكيد المريض والإجراء', en: 'Patient & procedure confirmed' },
      { key: 'antibioticsGiven', ar: 'تم إعطاء المضادات', en: 'Antibiotics given' },
      { key: 'imagingReviewed', ar: 'تم مراجعة الأشعة', en: 'Imaging reviewed' },
      { key: 'anticipatedEvents', ar: 'تم مراجعة التوقعات', en: 'Anticipated events reviewed' },
    ],
  },
  {
    key: 'signOut',
    label: { ar: 'المرحلة 3: التسجيل (بعد الإجراء)', en: 'Phase 3: Sign Out (Post-Procedure)' },
    items: [
      { key: 'procedureRecorded', ar: 'تم تسجيل الإجراء', en: 'Procedure recorded' },
      { key: 'instrumentCount', ar: 'تم عد الأدوات', en: 'Instrument count correct' },
      { key: 'specimenLabeled', ar: 'تم تسمية العينات', en: 'Specimen labeled' },
      { key: 'equipmentIssues', ar: 'تم مراجعة المعدات', en: 'Equipment issues reviewed' },
      { key: 'recoveryPlan', ar: 'تم وضع خطة التعافي', en: 'Recovery plan documented' },
    ],
  },
];

// ── Props ────────────────────────────────────────────────────────────────────

interface ProcedureDetailPanelProps {
  item: any;
  onClose: () => void;
  onComplete: () => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export function ProcedureDetailPanel({
  item,
  onClose,
  onComplete,
}: ProcedureDetailPanelProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const [activeSection, setActiveSection] = useState<'consent' | 'timeout' | 'execute'>('consent');
  const [showConsentForm, setShowConsentForm] = useState(false);
  const [timeoutChecklist, setTimeoutChecklist] = useState<Record<string, boolean>>({});
  const [procedureNotes, setProcedureNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const isPending = item.opdFlowState === 'PROCEDURE_PENDING';
  const isStarted = isPending && item.procedureStartAt;
  const isDone = item.opdFlowState === 'PROCEDURE_DONE_WAITING';

  // ── Fetch existing consents ──────────────────────────────────────────
  const { data: consentsData, mutate: mutateConsents } = useSWR(
    item.encounterCoreId
      ? `/api/clinical/consents?encounterCoreId=${item.encounterCoreId}&consentType=procedure`
      : null,
    fetcher
  );
  const existingConsents = consentsData?.items || consentsData?.consents || [];
  const hasProcedureConsent = existingConsents.length > 0;

  // ── Handlers ─────────────────────────────────────────────────────────

  const handleConsentComplete = useCallback(
    async (consentData: ConsentData) => {
      try {
        await fetch('/api/clinical/consents', {
          credentials: 'include',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...consentData,
            encounterCoreId: item.encounterCoreId,
            patientId: item.patient?.id,
          }),
        });
        mutateConsents();
        setShowConsentForm(false);
      } catch {
        // Error handling
      }
    },
    [item, mutateConsents]
  );

  const handleToggleChecklistItem = useCallback((key: string) => {
    setTimeoutChecklist((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleStartProcedure = useCallback(async () => {
    setLoading(true);
    try {
      // Save timeout checklist to nursing entry
      await fetch(`/api/opd/encounters/${item.encounterCoreId}/nursing`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timeOutChecklist: timeoutChecklist,
          procedureNotes,
        }),
      });

      // Update procedure start timestamp
      await fetch(`/api/opd/encounters/${item.encounterCoreId}/timestamps`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          procedureStartAt: new Date().toISOString(),
        }),
      });

      onComplete();
    } catch {
      // Error handling
    } finally {
      setLoading(false);
    }
  }, [item, timeoutChecklist, procedureNotes, onComplete]);

  const handleCompleteProcedure = useCallback(async () => {
    setLoading(true);
    try {
      // Save timeout sign-out checklist
      await fetch(`/api/opd/encounters/${item.encounterCoreId}/nursing`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timeOutChecklist: timeoutChecklist,
          procedureNotes,
        }),
      });

      // Update procedure end timestamp
      await fetch(`/api/opd/encounters/${item.encounterCoreId}/timestamps`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          procedureEndAt: new Date().toISOString(),
        }),
      });

      // Transition flow state to PROCEDURE_DONE_WAITING
      await fetch(`/api/opd/encounters/${item.encounterCoreId}/flow-state`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opdFlowState: 'PROCEDURE_DONE_WAITING',
        }),
      });

      onComplete();
    } catch {
      // Error handling
    } finally {
      setLoading(false);
    }
  }, [item, timeoutChecklist, procedureNotes, onComplete]);

  // ── Computed ─────────────────────────────────────────────────────────
  const totalChecklistItems = TIMEOUT_PHASES.reduce((sum, phase) => sum + phase.items.length, 0);
  const completedChecklistItems = Object.values(timeoutChecklist).filter(Boolean).length;
  const checklistProgress = Math.round((completedChecklistItems / totalChecklistItems) * 100);

  const procedureNames = (item.procedures || [])
    .map((p: any) => (language === 'ar' ? p.orderNameAr || p.orderName : p.orderName))
    .join(', ');

  // ── Section tabs ─────────────────────────────────────────────────────
  const sections = [
    { key: 'consent' as const, label: tr('الموافقة', 'Consent'), icon: FileCheck },
    { key: 'timeout' as const, label: tr('قائمة التحقق', 'Time-Out'), icon: Clipboard },
    { key: 'execute' as const, label: tr('التنفيذ', 'Execute'), icon: Syringe },
  ];

  return (
    <div className="space-y-4">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <button
          onClick={onClose}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowRight className="w-4 h-4 rtl:rotate-180" />
          {tr('رجوع للقائمة', 'Back to queue')}
        </button>
      </div>

      {/* ── Patient Card ────────────────────────────────────────────────── */}
      <div className="bg-card rounded-2xl border border-border p-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center">
            <User className="w-7 h-7 text-green-600" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-foreground">
              {item.patient?.fullName || tr('مريض', 'Patient')}
            </h2>
            <p className="text-muted-foreground">
              {tr('ملف', 'MRN')}: {item.patient?.mrn || '—'}
              {item.patient?.dob && ` • ${getAge(item.patient.dob)}`}
              {item.patient?.gender && ` • ${formatGender(item.patient.gender)}`}
            </p>
            {procedureNames && (
              <p className="text-sm text-green-700 mt-1 flex items-center gap-1.5">
                <Syringe className="w-3.5 h-3.5" />
                {procedureNames}
              </p>
            )}
            {item.doctorName && (
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                <Stethoscope className="w-3 h-3" />
                {item.doctorName}
              </p>
            )}
          </div>

          {/* Status badge */}
          <div className="shrink-0">
            {isDone ? (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-emerald-100 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="w-4 h-4 mr-1.5" />
                {tr('مكتمل', 'Completed')}
              </span>
            ) : isStarted ? (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-700 border border-blue-200">
                <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse mr-1.5" />
                {tr('قيد التنفيذ', 'In Progress')}
              </span>
            ) : (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-amber-100 text-amber-700 border border-amber-200">
                <Clock className="w-4 h-4 mr-1.5" />
                {tr('معلق', 'Pending')}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Section Tabs ────────────────────────────────────────────────── */}
      <div className="bg-card rounded-2xl border border-border">
        <div className="flex border-b border-border">
          {sections.map((section) => {
            const Icon = section.icon;
            const isActive = activeSection === section.key;
            return (
              <button
                key={section.key}
                onClick={() => setActiveSection(section.key)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors
                  ${isActive ? 'border-b-2 border-primary text-primary bg-card' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <Icon className="w-4 h-4" />
                {section.label}
                {section.key === 'consent' && hasProcedureConsent && (
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                )}
                {section.key === 'timeout' && completedChecklistItems > 0 && (
                  <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                    {checklistProgress}%
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="p-4">
          {/* ── Consent Section ────────────────────────────────────────── */}
          {activeSection === 'consent' && (
            <div>
              {hasProcedureConsent ? (
                <div className="bg-emerald-50 rounded-xl p-4 flex items-center gap-3">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                  <div>
                    <p className="font-semibold text-emerald-800">
                      {tr('تم التقاط الموافقة', 'Consent captured')}
                    </p>
                    <p className="text-sm text-emerald-600">
                      {tr(
                        'تم توقيع موافقة الإجراء بنجاح',
                        'Procedure consent has been signed successfully'
                      )}
                    </p>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="bg-amber-50 rounded-xl p-4 flex items-center gap-3 mb-4">
                    <AlertCircle className="w-8 h-8 text-amber-500" />
                    <div>
                      <p className="font-semibold text-amber-800">
                        {tr('لم يتم التقاط الموافقة بعد', 'Consent not yet captured')}
                      </p>
                      <p className="text-sm text-amber-600">
                        {tr(
                          'يجب التقاط موافقة المريض على الإجراء قبل البدء',
                          'Patient procedure consent must be captured before starting'
                        )}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowConsentForm(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 font-medium"
                  >
                    <FileCheck className="w-4 h-4" />
                    {tr('التقاط الموافقة', 'Capture Consent')}
                  </button>
                </div>
              )}

              {showConsentForm && item.patient && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                  <div className="bg-card rounded-2xl border border-border w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl">
                    <div className="p-4 border-b border-border flex items-center justify-between">
                      <h3 className="font-bold text-foreground">
                        {tr('موافقة الإجراء', 'Procedure Consent')}
                      </h3>
                      <button
                        onClick={() => setShowConsentForm(false)}
                        className="p-2 hover:bg-muted rounded-xl"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="p-4">
                      <ConsentForm
                        consentType="procedure"
                        patientName={item.patient.fullName || ''}
                        patientId={item.patient.id || ''}
                        encounterId={item.encounterCoreId}
                        onComplete={handleConsentComplete}
                        onCancel={() => setShowConsentForm(false)}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Time-Out Checklist Section ─────────────────────────────── */}
          {activeSection === 'timeout' && (
            <div className="space-y-6">
              {/* Progress bar */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-foreground">
                    {tr('تقدم قائمة التحقق', 'Checklist progress')}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {completedChecklistItems}/{totalChecklistItems}
                  </p>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-300"
                    style={{ width: `${checklistProgress}%` }}
                  />
                </div>
              </div>

              {TIMEOUT_PHASES.map((phase) => (
                <div key={phase.key}>
                  <h4 className="font-semibold text-foreground mb-3 text-sm">
                    {language === 'ar' ? phase.label.ar : phase.label.en}
                  </h4>
                  <div className="space-y-2">
                    {phase.items.map((checkItem) => {
                      const isChecked = timeoutChecklist[checkItem.key] || false;
                      return (
                        <button
                          key={checkItem.key}
                          onClick={() => handleToggleChecklistItem(checkItem.key)}
                          disabled={isDone}
                          className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors text-start
                            ${
                              isChecked
                                ? 'bg-emerald-50 border-emerald-200'
                                : 'bg-card border-border hover:bg-muted/50'
                            }
                            ${isDone ? 'opacity-70 cursor-not-allowed' : ''}`}
                        >
                          <div
                            className={`w-5 h-5 rounded flex items-center justify-center shrink-0
                              ${isChecked ? 'bg-emerald-500 text-white' : 'border-2 border-muted-foreground/30'}`}
                          >
                            {isChecked && <CheckCircle2 className="w-3.5 h-3.5" />}
                          </div>
                          <span
                            className={`text-sm ${isChecked ? 'text-emerald-800 line-through' : 'text-foreground'}`}
                          >
                            {language === 'ar' ? checkItem.ar : checkItem.en}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Execute Section ────────────────────────────────────────── */}
          {activeSection === 'execute' && (
            <div className="space-y-4">
              {/* Procedure orders */}
              <div>
                <h4 className="font-semibold text-foreground mb-2 text-sm">
                  {tr('الإجراءات المطلوبة', 'Requested Procedures')}
                </h4>
                <div className="space-y-2">
                  {(item.procedures || []).map((proc: any) => (
                    <div
                      key={proc.orderId}
                      className="flex items-center gap-3 p-3 rounded-xl border border-border"
                    >
                      <Syringe className="w-5 h-5 text-green-600 shrink-0" />
                      <div className="flex-1">
                        <p className="font-medium text-foreground text-sm">
                          {language === 'ar' ? proc.orderNameAr || proc.orderName : proc.orderName}
                        </p>
                        <p className="text-xs text-muted-foreground">{proc.orderCode}</p>
                      </div>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          proc.status === 'COMPLETED'
                            ? 'bg-emerald-100 text-emerald-700'
                            : proc.status === 'IN_PROGRESS'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {proc.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  {tr('ملاحظات الإجراء', 'Procedure Notes')}
                </label>
                <textarea
                  value={procedureNotes}
                  onChange={(e) => setProcedureNotes(e.target.value)}
                  placeholder={tr(
                    'اكتب ملاحظات عن الإجراء...',
                    'Write notes about the procedure...'
                  )}
                  rows={3}
                  disabled={isDone}
                  className="w-full p-3 border border-border rounded-xl thea-input-focus bg-card text-foreground resize-none disabled:opacity-70"
                />
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-3 pt-2">
                {!isStarted && !isDone && (
                  <button
                    onClick={handleStartProcedure}
                    disabled={loading}
                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium disabled:opacity-50"
                  >
                    {loading ? (
                      <Clock className="w-4 h-4 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                    {tr('بدء الإجراء', 'Start Procedure')}
                  </button>
                )}

                {isStarted && !isDone && (
                  <button
                    onClick={handleCompleteProcedure}
                    disabled={loading}
                    className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-medium disabled:opacity-50"
                  >
                    {loading ? (
                      <Clock className="w-4 h-4 animate-spin" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                    {tr('إنهاء الإجراء', 'Complete Procedure')}
                  </button>
                )}

                {isDone && (
                  <div className="flex items-center gap-2 text-emerald-600 font-medium">
                    <CheckCircle2 className="w-5 h-5" />
                    {tr(
                      'تم إنهاء الإجراء - بانتظار الطبيب',
                      'Procedure complete - Waiting for doctor'
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
