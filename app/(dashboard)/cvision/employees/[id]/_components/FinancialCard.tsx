'use client';

import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionBadge, CVisionButton , CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';

import { useMemo, useEffect, useState } from 'react';
import { DollarSign, Lightbulb, Sparkles, CheckCircle2, AlertCircle, Loader2, Info } from 'lucide-react';

import { calculateGOSI } from '@/lib/cvision/gosi';
import { validateSaudiIBAN } from '@/lib/cvision/iban-validator';
import type { EditableCardProps } from './types';
import SectionCard from './SectionCard';

interface FinancialCardProps extends EditableCardProps {}

interface SalarySuggestion {
  amount: number;
  source: 'grade_midpoint' | 'department_avg' | 'role_avg';
  label: string;
}

const currencyFmt = new Intl.NumberFormat('en-SA', {
  style: 'currency',
  currency: 'SAR',
  maximumFractionDigits: 0,
});

export default function FinancialCard(props: FinancialCardProps) {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const {
    profile,
    editData,
    saving,
    changeReason,
    historyOpen,
    isEditing,
    onToggleEdit,
    onCancelEdit,
    onSaveSection,
    onEditDataChange,
    onChangeReasonUpdate,
    onHistoryToggle,
    onFixProfile,
    fixingProfile,
    renderField,
    referenceData,
  } = props;

  const sectionKey = 'FINANCIAL' as const;
  const section = profile.sections[sectionKey];
  const finData = editData[sectionKey] || section?.dataJson || {};
  const employeeId = profile.employee.id;

  // ─── Salary Suggestion State ──────────────────────────────────────────────
  const [suggestion, setSuggestion] = useState<SalarySuggestion | null>(null);
  const [allSuggestions, setAllSuggestions] = useState<SalarySuggestion[]>([]);
  const [suggestionLoading, setSuggestionLoading] = useState(false);
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);

  // Check if basic salary is empty/unset
  const basicSalaryEmpty = !finData.basicSalary || finData.basicSalary === 0;

  // Fetch salary suggestions when basicSalary is empty
  useEffect(() => {
    if (!basicSalaryEmpty || suggestionDismissed) {
      setSuggestion(null);
      setAllSuggestions([]);
      return;
    }

    const ac = new AbortController();
    setSuggestionLoading(true);

    // Client-side fallback: grade midpoint from referenceData
    const gradeId = profile.employee.gradeId;
    let clientSuggestion: SalarySuggestion | null = null;
    if (gradeId && referenceData.grades) {
      const grade = referenceData.grades.find((g) => g.id === gradeId);
      if (grade?.minSalary && grade?.maxSalary) {
        const midpoint = Math.round((grade.minSalary + grade.maxSalary) / 2);
        clientSuggestion = {
          amount: midpoint,
          source: 'grade_midpoint',
          label: `${grade.name} midpoint (${grade.minSalary.toLocaleString()}\u2013${grade.maxSalary.toLocaleString()})`,
        };
      }
    }

    // Set client fallback immediately so user sees something fast
    if (clientSuggestion && !ac.signal.aborted) {
      setSuggestion(clientSuggestion);
      setAllSuggestions([clientSuggestion]);
    }

    // Then fetch full server suggestions (includes dept avg, role avg)
    fetch(`/api/cvision/employees/${employeeId}/salary-suggestion`, { credentials: 'include', signal: ac.signal })
      .then((res) => res.json())
      .then((data) => {
        if (ac.signal.aborted) return;
        if (data.success && data.suggestion) {
          setSuggestion(data.suggestion);
          setAllSuggestions(data.allSuggestions || []);
        }
      })
      .catch(() => {
        // Keep client fallback if server fails
      })
      .finally(() => {
        if (!ac.signal.aborted) setSuggestionLoading(false);
      });

    return () => ac.abort();
  }, [basicSalaryEmpty, employeeId, profile.employee.gradeId, referenceData.grades, suggestionDismissed]);

  // ─── Apply Suggestion Handler ─────────────────────────────────────────────
  const applySuggestion = (amount: number) => {
    const currentData = editData[sectionKey] || section?.dataJson || {};
    onEditDataChange(sectionKey, { ...currentData, basicSalary: amount });
    setSuggestionDismissed(true);
    // Also enter edit mode if not already editing
    if (!isEditing) {
      onToggleEdit();
    }
  };

  // ─── Computed Values ──────────────────────────────────────────────────────
  const basic = typeof finData.basicSalary === 'number' ? finData.basicSalary : 0;
  const housing = typeof finData.housingAllowance === 'number' ? finData.housingAllowance : 0;
  const transport = typeof finData.transportAllowance === 'number' ? finData.transportAllowance : 0;
  const other = typeof finData.otherAllowances === 'number' ? finData.otherAllowances : 0;
  const totalPackage = basic + housing + transport + other;

  // GOSI calculation using the proper utility
  const gosi = useMemo(() => {
    if (basic <= 0) return null;
    return calculateGOSI(basic, housing, false);
  }, [basic, housing]);

  const estNetSalary = useMemo(() => {
    if (!gosi || totalPackage <= 0) return 0;
    return Math.round(totalPackage - gosi.employeeContribution);
  }, [gosi, totalPackage]);

  // ─── IBAN Validation ──────────────────────────────────────────────────────
  const ibanValidation = useMemo(() => {
    const iban = finData.iban;
    if (!iban || typeof iban !== 'string' || iban.trim().length === 0) return null;
    // Only validate if at least 4 chars (SA + 2 digits minimum)
    if (iban.replace(/[\s\-]/g, '').length < 4) return null;
    return validateSaudiIBAN(iban);
  }, [finData.iban]);

  // Auto-fill bankName when IBAN becomes valid (only in edit mode)
  useEffect(() => {
    if (!isEditing || !ibanValidation?.isValid || !ibanValidation.bankNameEn) return;
    const currentBankName = finData.bankName;
    // Only auto-fill if bankName is empty or different from IBAN-derived name
    if (!currentBankName || currentBankName !== ibanValidation.bankNameEn) {
      const currentData = editData[sectionKey] || section?.dataJson || {};
      onEditDataChange(sectionKey, { ...currentData, bankName: ibanValidation.bankNameEn });
    }
  }, [ibanValidation?.isValid, ibanValidation?.bankNameEn, isEditing]);

  // ─── Allowance Suggestions ────────────────────────────────────────────────
  const housingEmpty = basic > 0 && (!finData.housingAllowance || finData.housingAllowance === 0);
  const transportEmpty = basic > 0 && (!finData.transportAllowance || finData.transportAllowance === 0);
  const suggestedHousing = Math.round(basic * 0.25);
  const suggestedTransport = 500;

  const applyAllowance = (field: string, amount: number) => {
    const currentData = editData[sectionKey] || section?.dataJson || {};
    onEditDataChange(sectionKey, { ...currentData, [field]: amount });
  };

  // ─── Header Content (Suggestions) ────────────────────────────────────────
  const headerContent = useMemo(() => {
    const elements: React.ReactNode[] = [];

    // Salary suggestion banner (when basicSalary is empty)
    if (basicSalaryEmpty && !suggestionDismissed) {
      if (suggestionLoading && !suggestion) {
        elements.push(
          <div key="salary-loading" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, padding: 12, background: C.blueDim, border: `1px solid ${C.border}`, borderRadius: 8 }}>
            <Loader2 style={{ height: 16, width: 16, color: C.blue, animation: 'spin 1s linear infinite' }} />
            <span style={{ fontSize: 13, color: C.blue }}>{tr('جاري البحث عن اقتراحات الرواتب...', 'Finding salary suggestions...')}</span>
          </div>
        );
      } else if (suggestion) {
        elements.push(
          <div key="salary-suggestion" style={{ marginBottom: 16, padding: 12, background: C.blueDim, border: `1px solid ${C.border}`, borderRadius: 8 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <Lightbulb style={{ height: 16, width: 16, color: C.blue, marginTop: 2 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, color: C.blue, fontWeight: 500 }}>
                  {tr('غير محدد — المقترح:', 'Not set — Suggested:')} {currencyFmt.format(suggestion.amount)}
                </p>
                <p style={{ fontSize: 12, color: C.blue, marginTop: 2 }}>
                  {tr('بناءً على', 'Based on')} {suggestion.label}
                </p>
                {allSuggestions.length > 1 && (
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {allSuggestions.slice(1).map((s, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: C.blue }}>
                        <span>{s.label}</span>
                        <button
                          type="button"
                          style={{ fontWeight: 500 }}
                          onClick={() => applySuggestion(s.amount)}
                        >
                          {currencyFmt.format(s.amount)}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                  <CVisionButton C={C} isDark={isDark}
                    size="sm"
                    variant="default"
                    style={{ height: 28, fontSize: 12 }}
                    onClick={() => applySuggestion(suggestion.amount)}
                  >
                    <Sparkles style={{ height: 12, width: 12, marginRight: 4 }} />
                    {tr('تطبيق المقترح', 'Apply Suggestion')}
                  </CVisionButton>
                  <CVisionButton C={C} isDark={isDark}
                    size="sm"
                    variant="outline"
                    style={{ height: 28, fontSize: 12 }}
                    onClick={() => {
                      setSuggestionDismissed(true);
                      if (!isEditing) onToggleEdit();
                    }}
                  >
                    {tr('تعيين يدوياً', 'Set Manually')}
                  </CVisionButton>
                </div>
              </div>
            </div>
          </div>
        );
      }
    }

    // Allowance suggestions (only in edit mode when basic is set)
    if (isEditing && basic > 0 && (housingEmpty || transportEmpty)) {
      const allowanceSuggestions: React.ReactNode[] = [];

      if (housingEmpty) {
        allowanceSuggestions.push(
          <div key="housing" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: C.orange }}>
              {tr('بدل سكن: مقترح 25% =', 'Housing Allowance: suggest 25% =')} {currencyFmt.format(suggestedHousing)}
            </span>
            <CVisionButton C={C} isDark={isDark}
              size="sm"
              variant="ghost"
              style={{ height: 24, fontSize: 12, color: C.orange, paddingLeft: 8, paddingRight: 8 }}
              onClick={() => applyAllowance('housingAllowance', suggestedHousing)}
            >
              {tr('تطبيق', 'Apply')}
            </CVisionButton>
          </div>
        );
      }

      if (transportEmpty) {
        allowanceSuggestions.push(
          <div key="transport" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: C.orange }}>
              {tr('بدل نقل: مقترح', 'Transport Allowance: suggest')} {currencyFmt.format(suggestedTransport)}
            </span>
            <CVisionButton C={C} isDark={isDark}
              size="sm"
              variant="ghost"
              style={{ height: 24, fontSize: 12, color: C.orange, paddingLeft: 8, paddingRight: 8 }}
              onClick={() => applyAllowance('transportAllowance', suggestedTransport)}
            >
              {tr('تطبيق', 'Apply')}
            </CVisionButton>
          </div>
        );
      }

      if (allowanceSuggestions.length > 0) {
        elements.push(
          <div key="allowance-suggestions" style={{ marginBottom: 16, padding: 10, background: C.orangeDim, border: `1px solid ${C.border}`, borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {allowanceSuggestions}
          </div>
        );
      }
    }

    return elements.length > 0 ? <>{elements}</> : null;
  }, [basicSalaryEmpty, suggestionDismissed, suggestionLoading, suggestion, allSuggestions, isEditing, basic, housingEmpty, transportEmpty, suggestedHousing]);

  // ─── Footer Content (Auto-Calc + IBAN) ────────────────────────────────────
  const footerContent = useMemo(() => {
    const elements: React.ReactNode[] = [];

    // Auto-calculated fields (show in both read and edit modes when there's data)
    if (totalPackage > 0 && gosi) {
      elements.push(
        <div key="auto-calc" style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
          <p style={{ fontWeight: 600, textTransform: 'uppercase', color: C.textMuted, marginBottom: 10 }}>
            {tr('محسوب', 'Calculated')}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Total Package */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: C.textMuted }}>{tr('إجمالي الحزمة', 'Total Package')}</span>
              <span style={{ fontSize: 13, fontWeight: 700 }}>
                {currencyFmt.format(totalPackage)}
              </span>
            </div>

            {/* GOSI Employee */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, color: C.textMuted }}>{tr('التأمينات (الموظف 9%)', 'GOSI (Employee 9%)')}</span>
                {gosi.isAboveMax && (
                  <CVisionBadge C={C}
                    variant="outline"
                    style={{ paddingLeft: 4, paddingRight: 4, paddingTop: 0, paddingBottom: 0, background: C.orangeDim, color: C.orange }}
                    title={tr('الراتب المؤمن عليه في التأمينات محدد بـ 45,000 ريال', 'GOSI insurable salary is capped at SAR 45,000')}
                  >
                    {tr('محدد بـ 45 ألف', 'Capped at 45K')}
                  </CVisionBadge>
                )}
              </div>
              <span style={{ fontSize: 12, fontWeight: 500, color: C.red }}>
                -{currencyFmt.format(gosi.employeeContribution)}
              </span>
            </div>

            {/* GOSI Employer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, color: C.textMuted }}>{tr('التأمينات (صاحب العمل 9%)', 'GOSI (Employer 9%)')}</span>
                <span title={tr('يدفعها صاحب العمل، لا تخصم من الراتب', 'Paid by the employer, not deducted from salary')}>
                  <Info style={{ height: 12, width: 12 }} />
                </span>
              </div>
              <span style={{ fontSize: 12, color: C.textMuted }}>
                {currencyFmt.format(gosi.employerContribution)}
              </span>
            </div>

            {/* Separator */}
            <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 4, marginBottom: 4 }} />

            {/* {tr('صافي الراتب التقديري', 'Est. Net Salary')} */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: C.textMuted }}>{tr('صافي الراتب التقديري', 'Est. Net Salary')}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.green }}>
                {currencyFmt.format(estNetSalary)}
              </span>
            </div>
          </div>
        </div>
      );
    }

    // IBAN validation feedback
    if (ibanValidation) {
      if (ibanValidation.isValid) {
        elements.push(
          <div key="iban-valid" style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, padding: 8, background: C.greenDim, border: `1px solid ${C.border}`, borderRadius: 8 }}>
            <CheckCircle2 style={{ height: 14, width: 14, color: C.green }} />
            <span style={{ fontSize: 12, color: C.green }}>
              {ibanValidation.bankNameEn} — {tr('آيبان صالح', 'Valid IBAN')} ({ibanValidation.formattedIBAN})
            </span>
          </div>
        );
      } else if (ibanValidation.errors.length > 0) {
        elements.push(
          <div key="iban-invalid" style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, padding: 8, background: C.redDim, border: `1px solid ${C.border}`, borderRadius: 8 }}>
            <AlertCircle style={{ height: 14, width: 14, color: C.red }} />
            <span style={{ fontSize: 12, color: C.red }}>
              {ibanValidation.errors[0]}
            </span>
          </div>
        );
      }
    }

    return elements.length > 0 ? <>{elements}</> : null;
  }, [totalPackage, gosi, estNetSalary, ibanValidation]);

  return (
    <SectionCard
      sectionKey={sectionKey}
      title={tr('المالية', 'Financial')}
      icon={DollarSign}
      section={section}
      editData={editData[sectionKey] || {}}
      saving={saving[sectionKey] || false}
      changeReason={changeReason[sectionKey] || ''}
      historyOpen={historyOpen[sectionKey] || false}
      isEditing={isEditing}
      canEdit={section?.canEdit ?? false}
      editReason={section?.editReason || null}
      onToggleEdit={onToggleEdit}
      onCancelEdit={onCancelEdit}
      onSaveSection={() => onSaveSection(sectionKey)}
      onEditDataChange={(data) => onEditDataChange(sectionKey, data)}
      onChangeReasonUpdate={(reason) => onChangeReasonUpdate(sectionKey, reason)}
      onHistoryToggle={(open) => onHistoryToggle(sectionKey, open)}
      onFixProfile={onFixProfile}
      fixingProfile={fixingProfile}
      renderField={renderField}
      referenceData={referenceData}
      employee={profile.employee}
      headerContent={headerContent}
      footerContent={footerContent}
    />
  );
}
