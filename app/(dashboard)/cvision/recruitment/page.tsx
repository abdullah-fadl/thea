'use client';

import { useState } from 'react';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import {
  CVisionPageLayout, CVisionPageHeader, CVisionTabs, CVisionTabContent,
  CVisionButton, CVisionDialog, CVisionDialogFooter, CVisionSkeletonStyles } from '@/components/cvision/ui';
import { Users, Briefcase, Upload, BarChart3 } from 'lucide-react';
import CandidatesTab from './_components/CandidatesTab';
import JobOpeningsTab from './_components/JobOpeningsTab';
import CVInboxTab from './_components/CVInboxTab';
import RecruitmentAnalytics from './_components/RecruitmentAnalytics';

export default function RecruitmentPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const [activeTab, setActiveTab] = useState('candidates');
  const [cvInboxOpen, setCvInboxOpen] = useState(false);

  return (
    <CVisionPageLayout>
      <CVisionSkeletonStyles />
      <CVisionPageHeader
        C={C}
        title={tr('التوظيف', 'Recruitment')}
        titleEn={isRTL ? 'Recruitment' : undefined}
        subtitle={tr('إدارة المرشحين والوظائف والتحليلات', 'Manage candidates, job openings, and analytics')}
        isRTL={isRTL}
        icon={Users}
        actions={
          <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setCvInboxOpen(true)}
            icon={<Upload size={14} />}>
            {tr('رفع السير الذاتية', 'Upload CVs')}
          </CVisionButton>
        }
      />

      <CVisionTabs
        C={C}
        tabs={[
          { id: 'candidates', label: tr('المرشحون', 'Candidates'), icon: <Users size={14} /> },
          { id: 'openings', label: tr('الوظائف', 'Job Openings'), icon: <Briefcase size={14} /> },
          { id: 'analytics', label: tr('التحليلات', 'Analytics'), icon: <BarChart3 size={14} /> },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
        isRTL={isRTL}
      />

      <CVisionTabContent id="candidates" activeTab={activeTab}>
        <CandidatesTab />
      </CVisionTabContent>

      <CVisionTabContent id="openings" activeTab={activeTab}>
        <JobOpeningsTab />
      </CVisionTabContent>

      <CVisionTabContent id="analytics" activeTab={activeTab}>
        <RecruitmentAnalytics />
      </CVisionTabContent>

      <CVisionDialog
        C={C}
        open={cvInboxOpen}
        onClose={() => setCvInboxOpen(false)}
        title={tr('صندوق السير الذاتية — رفع وتحليل', 'CV Inbox — Upload & Analyze CVs')}
        isRTL={isRTL}
        width={900}
      >
        <CVInboxTab />
      </CVisionDialog>
    </CVisionPageLayout>
  );
}
