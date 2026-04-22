'use client';

import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionCard, CVisionCardBody , CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';

import { useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';

import { Loader2 } from 'lucide-react';

import type { ProfileSectionKey } from '@/lib/cvision/types';
import { createRenderField } from './_components/RenderField';
import { useEmployeeProfile } from './_components/useEmployeeProfile';
import StatusChangeDialog from './_components/StatusChangeDialog';
import EmploymentFormErrorBoundary from './_components/EmploymentFormErrorBoundary';
import ProfileHeader from './_components/ProfileHeader';
import PersonalCard from './_components/PersonalCard';
import EmploymentCard from './_components/EmploymentCard';
import ContractCard from './_components/ContractCard';
import FinancialCard from './_components/FinancialCard';
import QuickStatsCard from './_components/QuickStatsCard';
import ActivityTimeline from './_components/ActivityTimeline';
import SkillsCard from './_components/SkillsCard';
import PerformanceHistoryCard from './_components/PerformanceHistoryCard';
import AIInsightsCard from './_components/AIInsightsCard';
import MuqeemCard from './_components/MuqeemCard';

export default function EmployeeProfilePage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const params = useParams();
  const router = useRouter();
  const employeeId = params.id as string;

  // All state, data loading, and save logic is encapsulated in this hook
  const {
    profile,
    loading,
    saving,
    editingSection,
    editData,
    setEditData,
    historyOpen,
    setHistoryOpen,
    changeReason,
    setChangeReason,
    fixingProfile,

    referenceData,
    departments,
    branchesList,

    statusChangeOpen,
    setStatusChangeOpen,
    statusHistory,
    loadingHistory,
    changingStatus,
    newStatus,
    setNewStatus,
    statusReason,
    setStatusReason,
    statusEffectiveDate,
    setStatusEffectiveDate,
    lastWorkingDay,
    setLastWorkingDay,

    absherLookingUp,
    absherLookupDone,
    absherLookupError,

    completeness,
    hasChanges,
    canChangeStatus,

    loadStatusHistory,
    saveAllSections,
    saveSection,
    handleStatusChange,
    handleAbsherLookup,
    handleToggleEdit,
    handleCancelEdit,
    fixProfile,
  } = useEmployeeProfile(employeeId);

  // renderField is created via createRenderField from the extracted RenderField component
  const renderField = useMemo(() => {
    if (!profile) return () => null;
    return createRenderField({
      profile,
      editData,
      setEditData,
      editingSection,
      referenceData: { ...referenceData, branches: branchesList },
      absherLookingUp,
      absherLookupDone,
      absherLookupError,
      handleAbsherLookup,
    });
  }, [profile, editData, setEditData, editingSection, referenceData, branchesList, absherLookingUp, absherLookupDone, absherLookupError, handleAbsherLookup]);

  // --- Shared card props builder ---
  function buildCardProps(targetSection: ProfileSectionKey) {
    return {
      profile: profile!,
      sectionKey: targetSection,
      editData,
      saving,
      changeReason,
      historyOpen,
      isEditing: editingSection === targetSection,
      onToggleEdit: () => handleToggleEdit(targetSection),
      onEditDataChange: (sk: string, data: Record<string, any>) => {
        setEditData(prev => ({ ...prev, [sk]: data }));
      },
      onSaveSection: saveSection,
      onCancelEdit: handleCancelEdit,
      onChangeReasonUpdate: (sk: string, reason: string) => {
        setChangeReason(prev => ({ ...prev, [sk]: reason }));
      },
      onHistoryToggle: (sk: string, open: boolean) => {
        setHistoryOpen(prev => ({ ...prev, [sk]: open }));
      },
      onFixProfile: fixProfile,
      fixingProfile,
      renderField,
      referenceData,
    };
  }

  // --- Loading state ---
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 style={{ height: 32, width: 32, animation: 'spin 1s linear infinite', color: C.textMuted }} />
      </div>
    );
  }

  // --- Empty state ---
  if (!profile) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <CVisionCard C={C}>
          <CVisionCardBody style={{ paddingTop: 48, paddingBottom: 48, textAlign: 'center' }}>
            <p style={{ color: C.textMuted }}>
              {tr('لم يتم العثور على ملف الموظف', 'Employee profile not found')}
            </p>
          </CVisionCardBody>
        </CVisionCard>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Sticky Profile Header */}
      <ProfileHeader
        profile={profile}
        referenceData={referenceData}
        completeness={completeness}
        hasChanges={hasChanges}
        saving={Object.values(saving).some(v => v)}
        canChangeStatus={canChangeStatus}
        onSaveAll={saveAllSections}
        onStatusChangeOpen={() => {
          loadStatusHistory();
          setStatusChangeOpen(true);
        }}
        onBack={() => router.back()}
      />

      {/* Two-column dashboard layout */}
      <div style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 24, paddingBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 24 }}>
          {/* Left column (60%) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <PersonalCard {...buildCardProps('PERSONAL')} />
            <EmploymentFormErrorBoundary C={C} isDark={isDark} tr={tr}>
              <EmploymentCard {...buildCardProps('EMPLOYMENT')} departments={departments} />
            </EmploymentFormErrorBoundary>
            <ContractCard {...buildCardProps('CONTRACT')} />
          </div>

          {/* Right column (40%) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <QuickStatsCard profile={profile} editData={editData} />
            <MuqeemCard profile={profile} editData={editData} />
            <FinancialCard {...buildCardProps('FINANCIAL')} />
            <SkillsCard employeeId={profile.employee.id} />
            <PerformanceHistoryCard employeeId={profile.employee.id} />
            <ActivityTimeline statusHistory={statusHistory} loading={loadingHistory} />
            <AIInsightsCard employeeId={profile.employee.id} />
          </div>
        </div>
      </div>

      {/* Status Change Dialog */}
      <StatusChangeDialog
        open={statusChangeOpen}
        onOpenChange={setStatusChangeOpen}
        profile={profile}
        editData={editData}
        newStatus={newStatus}
        setNewStatus={setNewStatus}
        statusReason={statusReason}
        setStatusReason={setStatusReason}
        statusEffectiveDate={statusEffectiveDate}
        setStatusEffectiveDate={setStatusEffectiveDate}
        lastWorkingDay={lastWorkingDay}
        setLastWorkingDay={setLastWorkingDay}
        statusHistory={statusHistory}
        loadingHistory={loadingHistory}
        changingStatus={changingStatus}
        handleStatusChange={handleStatusChange}
      />
    </div>
  );
}
