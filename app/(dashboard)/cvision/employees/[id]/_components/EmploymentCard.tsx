'use client';

import { useMemo } from 'react';
import { Briefcase } from 'lucide-react';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionButton , CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';
import type { EditableCardProps } from './types';
import SectionCard from './SectionCard';

interface EmploymentCardProps extends EditableCardProps {
  departments: Array<{ id: string; name: string; code?: string }>;
}

export default function EmploymentCard(props: EmploymentCardProps) {
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
    departments,
  } = props;

  const sectionKey = 'EMPLOYMENT' as const;
  const section = profile.sections[sectionKey];

  const legacyWarning = useMemo(() => {
    if (!section || !profile.employee) return null;

    const deptId = editData[sectionKey]?.departmentId || profile.employee.departmentId;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const hasLegacyDept = deptId && typeof deptId === 'string' && !uuidRegex.test(deptId);
    const hasEmptyDept = !deptId || deptId === '';

    const legacyDeptText = section.dataJson?.department || section.dataJson?.departmentName ||
      (hasLegacyDept ? deptId : null);

    if (!hasLegacyDept && !(hasEmptyDept && legacyDeptText)) return null;

    const exactMatch = Array.isArray(departments) && legacyDeptText
      ? departments.find((d) =>
          d.name?.toLowerCase() === String(legacyDeptText).toLowerCase() ||
          d.code?.toLowerCase() === String(legacyDeptText).toLowerCase()
        )
      : null;

    return (
      <div style={{ padding: 12, background: `${C.orange}10`, border: `1px solid ${C.orange}30`, borderRadius: 8, marginBottom: 16 }}>
        <p style={{ fontSize: 13, color: C.orange, marginBottom: 8 }}>
          <strong>{tr('تم اكتشاف قسم قديم.', 'Legacy department detected.')}</strong>{' '}
          {tr('يرجى الربط بقسم المنظمة.', 'Please map to an Organization department.')}
          {legacyDeptText && ` ${tr('القيمة القديمة:', 'Legacy value:')} "${legacyDeptText}"`}
        </p>
        {exactMatch && (
          <CVisionButton
            C={C}
            isDark={isDark}
            variant="outline"
            onClick={() => {
              onEditDataChange(sectionKey, {
                ...editData[sectionKey],
                departmentId: exactMatch.id,
              });
            }}
          >
            {tr(`ربط تلقائي بـ "${exactMatch.name}"`, `Auto-map to "${exactMatch.name}"`)}
          </CVisionButton>
        )}
      </div>
    );
  }, [section, profile.employee, editData, sectionKey, departments, onEditDataChange, C, isDark, tr]);

  return (
    <SectionCard
      sectionKey={sectionKey}
      title={tr('معلومات التوظيف', 'Employment Information')}
      icon={Briefcase}
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
      headerContent={legacyWarning}
      showPositionFallback
    />
  );
}
