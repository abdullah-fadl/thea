'use client';

import { useMemo } from 'react';
import { FileText, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { useLang } from '@/hooks/use-lang';
import type { EditableCardProps } from './types';
import SectionCard from './SectionCard';

interface ContractCardProps extends EditableCardProps {}

export default function ContractCard(props: ContractCardProps) {
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

  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;

  const sectionKey = 'CONTRACT' as const;
  const section = profile.sections[sectionKey];
  const contractData = editData[sectionKey] || section?.dataJson || {};

  // Contract status indicator
  const statusBar = useMemo(() => {
    const now = new Date();

    // Probation check
    if (contractData.probationEndDate) {
      const probEnd = new Date(contractData.probationEndDate);
      if (probEnd > now) {
        const daysLeft = Math.ceil((probEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return (
          <div className="mt-4 flex items-center gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-md">
            <Clock className="h-4 w-4 text-amber-600 shrink-0" />
            <span className="text-sm text-amber-800 font-medium">
              {tr(`ينتهي التجربة خلال ${daysLeft} يوم`, `Probation ends in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`)}
            </span>
          </div>
        );
      }
    }

    // Contract expiry check
    if (contractData.endDate) {
      const endDate = new Date(contractData.endDate);
      const daysUntilExpiry = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (daysUntilExpiry < 0) {
        return (
          <div className="mt-4 flex items-center gap-2 p-2.5 bg-red-50 border border-red-200 rounded-md">
            <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
            <span className="text-sm text-red-800 font-medium">
              {tr(`انتهى العقد منذ ${Math.abs(daysUntilExpiry)} يوم`, `Contract expired ${Math.abs(daysUntilExpiry)} day${Math.abs(daysUntilExpiry) !== 1 ? 's' : ''} ago`)}
            </span>
          </div>
        );
      }

      if (daysUntilExpiry <= 90) {
        return (
          <div className="mt-4 flex items-center gap-2 p-2.5 bg-red-50 border border-red-200 rounded-md">
            <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
            <span className="text-sm text-red-800 font-medium">
              {tr(`ينتهي العقد خلال ${daysUntilExpiry} يوم`, `Contract expires in ${daysUntilExpiry} day${daysUntilExpiry !== 1 ? 's' : ''}`)}
            </span>
          </div>
        );
      }

      return (
        <div className="mt-4 flex items-center gap-2 p-2.5 bg-green-50 border border-green-200 rounded-md">
          <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
          <span className="text-sm text-green-800 font-medium">
            {tr(`ساري حتى ${endDate.toLocaleDateString('ar-SA')}`, `Active until ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`)}
          </span>
        </div>
      );
    }

    // Permanent / no end date
    if (contractData.contractType === 'PERMANENT') {
      return (
        <div className="mt-4 flex items-center gap-2 p-2.5 bg-green-50 border border-green-200 rounded-md">
          <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
          <span className="text-sm text-green-800 font-medium">{tr('عقد دائم', 'Permanent Contract')}</span>
        </div>
      );
    }

    return null;
  }, [contractData]);

  return (
    <SectionCard
      sectionKey={sectionKey}
      title={tr('العقد', 'Contract')}
      icon={FileText}
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
      footerContent={statusBar}
    />
  );
}
