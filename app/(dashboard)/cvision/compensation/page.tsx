'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { cvisionFetch, cvisionMutate, cvisionKeys } from '@/lib/cvision/hooks';
import {
  CVisionCard, CVisionCardHeader, CVisionCardBody, CVisionButton, CVisionBadge, CVisionInput,
  CVisionPageHeader, CVisionPageLayout, CVisionMiniStat, CVisionStatsRow,
  CVisionSkeletonCard, CVisionTabs, CVisionTabContent,
  CVisionTable, CVisionTableHead, CVisionTableBody, CVisionTh, CVisionTr, CVisionTd, CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';
import { toast } from 'sonner';
import { DollarSign, BarChart3, Calculator, TrendingUp } from 'lucide-react';

export default function CompensationPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const [simResult, setSimResult] = useState<any>(null);
  const [simPercent, setSimPercent] = useState(5);
  const [activeTab, setActiveTab] = useState('structure');

  const { data: structureRaw, isLoading: structureLoading } = useQuery({
    queryKey: cvisionKeys.compensation.list({ action: 'structure' }),
    queryFn: () => cvisionFetch<any>('/api/cvision/compensation', { params: { action: 'structure' } }),
  });
  const { data: analysisRaw, isLoading: analysisLoading } = useQuery({
    queryKey: cvisionKeys.compensation.list({ action: 'analysis' }),
    queryFn: () => cvisionFetch<any>('/api/cvision/compensation', { params: { action: 'analysis' } }),
  });
  const structure = structureRaw?.ok ? structureRaw.data : null;
  const analysis = analysisRaw?.ok ? analysisRaw.data : null;
  const loading = structureLoading || analysisLoading;

  const simulate = async () => {
    const d = await cvisionMutate<any>('/api/cvision/compensation', 'POST', { action: 'simulate-raise', percentage: simPercent });
    if (d.ok) setSimResult(d.data);
  };

  if (loading) return <CVisionPageLayout><CVisionSkeletonCard C={C} height={250} /></CVisionPageLayout>;

  const grades = structure?.grades || [];
  const an = analysis || {};

  const tabs = [
    { id: 'structure', label: 'Structure', labelAr: 'الهيكل', icon: <DollarSign size={14} /> },
    { id: 'analysis', label: 'Analysis', labelAr: 'التحليل', icon: <BarChart3 size={14} /> },
    { id: 'simulator', label: 'Simulator', labelAr: 'المحاكاة', icon: <Calculator size={14} /> },
  ];

  return (
    <CVisionPageLayout>
      <CVisionPageHeader C={C} title={tr('التعويضات والمزايا', 'Compensation & Benefits')} titleEn="Compensation & Benefits" icon={DollarSign} isRTL={isRTL} />

      {analysis && (
        <CVisionStatsRow>
          <CVisionMiniStat C={C} label={tr('إجمالي الرواتب (ريال)', 'Total Payroll (SAR)')} value={(an.totalPayroll || 0).toLocaleString()} icon={DollarSign} color={C.green} colorDim={C.greenDim} />
          <CVisionMiniStat C={C} label={tr('متوسط الراتب', 'Avg Salary')} value={(an.avgSalary || 0).toLocaleString()} icon={TrendingUp} color={C.blue} colorDim={C.blueDim} />
          <CVisionMiniStat C={C} label={tr('ضمن النطاق', 'In Range')} value={an.inRange || 0} icon={BarChart3} color={C.green} colorDim={C.greenDim} />
          <CVisionMiniStat C={C} label={tr('خارج النطاق', 'Out of Range')} value={(an.belowRange || 0) + (an.aboveRange || 0)} icon={Calculator} color={C.red} colorDim={C.redDim} />
        </CVisionStatsRow>
      )}

      <CVisionTabs C={C} tabs={tabs} activeTab={activeTab} onChange={setActiveTab} isRTL={isRTL} />

      <CVisionTabContent id="structure" activeTab={activeTab}>
        <CVisionCard C={C}>
          <CVisionCardBody style={{ padding: 0 }}>
            <CVisionTable C={C}>
              <CVisionTableHead C={C}>
                <CVisionTh C={C}>{tr('الدرجة', 'Grade')}</CVisionTh>
                <CVisionTh C={C}>{tr('الاسم', 'Name')}</CVisionTh>
                <CVisionTh C={C} align="right">{tr('الحد الأدنى (ريال)', 'Min (SAR)')}</CVisionTh>
                <CVisionTh C={C} align="right">{tr('المتوسط (ريال)', 'Mid (SAR)')}</CVisionTh>
                <CVisionTh C={C} align="right">{tr('الحد الأقصى (ريال)', 'Max (SAR)')}</CVisionTh>
                <CVisionTh C={C} align="center">{tr('النطاق', 'Range')}</CVisionTh>
              </CVisionTableHead>
              <CVisionTableBody>
                {grades.map((g: any) => (
                  <CVisionTr key={g.gradeId} C={C}>
                    <CVisionTd style={{ fontWeight: 500, color: C.text }}>{g.gradeId}</CVisionTd>
                    <CVisionTd style={{ color: C.text }}>{g.name} <span style={{ fontSize: 11, color: C.textMuted }}>({g.nameAr})</span></CVisionTd>
                    <CVisionTd align="right" style={{ color: C.textSecondary }}>{g.minSalary.toLocaleString()}</CVisionTd>
                    <CVisionTd align="right" style={{ fontWeight: 600, color: C.text }}>{g.midSalary.toLocaleString()}</CVisionTd>
                    <CVisionTd align="right" style={{ color: C.textSecondary }}>{g.maxSalary.toLocaleString()}</CVisionTd>
                    <CVisionTd>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div style={{ flex: 1, height: 6, background: C.barTrack, borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: '100%', background: C.blue, borderRadius: 3 }} />
                        </div>
                      </div>
                    </CVisionTd>
                  </CVisionTr>
                ))}
              </CVisionTableBody>
            </CVisionTable>
          </CVisionCardBody>
        </CVisionCard>
      </CVisionTabContent>

      <CVisionTabContent id="analysis" activeTab={activeTab}>
        <CVisionCard C={C}>
          <CVisionCardHeader C={C}>
            <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('نظرة عامة على الإنصاف', 'Pay Equity Overview')}</span>
          </CVisionCardHeader>
          <CVisionCardBody>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, textAlign: 'center' }}>
              <div>
                <div style={{ fontSize: 24, fontWeight: 700, color: C.red }}>{an.belowRange || 0}</div>
                <div style={{ fontSize: 11, color: C.textMuted }}>{tr('أقل من النطاق', 'Below Range')}</div>
              </div>
              <div>
                <div style={{ fontSize: 24, fontWeight: 700, color: C.green }}>{an.inRange || 0}</div>
                <div style={{ fontSize: 11, color: C.textMuted }}>{tr('ضمن النطاق', 'In Range')}</div>
              </div>
              <div>
                <div style={{ fontSize: 24, fontWeight: 700, color: C.orange }}>{an.aboveRange || 0}</div>
                <div style={{ fontSize: 11, color: C.textMuted }}>{tr('أعلى من النطاق', 'Above Range')}</div>
              </div>
            </div>
          </CVisionCardBody>
        </CVisionCard>
      </CVisionTabContent>

      <CVisionTabContent id="simulator" activeTab={activeTab}>
        <CVisionCard C={C}>
          <CVisionCardHeader C={C}>
            <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('محاكي زيادة الرواتب', 'What-If Raise Simulator')}</span>
          </CVisionCardHeader>
          <CVisionCardBody>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <CVisionInput C={C} type="number" value={simPercent} onChange={e => setSimPercent(parseFloat(e.target.value))} style={{ width: 80 }} />
                <span style={{ fontSize: 13, color: C.textSecondary }}>% {tr('زيادة', 'raise')}</span>
                <CVisionButton C={C} isDark={isDark} variant="primary" icon={<TrendingUp size={14} />} onClick={simulate}>{tr('محاكاة', 'Simulate')}</CVisionButton>
              </div>
              {simResult && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: C.text }}>{simResult.affectedEmployees}</div>
                    <div style={{ fontSize: 11, color: C.textMuted }}>{tr('متأثرون', 'Affected')}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: C.text }}>{simResult.currentTotal?.toLocaleString()}</div>
                    <div style={{ fontSize: 11, color: C.textMuted }}>{tr('الحالي (ريال)', 'Current (SAR)')}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: C.red }}>+{simResult.increase?.toLocaleString()}</div>
                    <div style={{ fontSize: 11, color: C.textMuted }}>{tr('الزيادة', 'Increase')}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: C.blue }}>{simResult.newTotal?.toLocaleString()}</div>
                    <div style={{ fontSize: 11, color: C.textMuted }}>{tr('الإجمالي الجديد', 'New Total')}</div>
                  </div>
                </div>
              )}
            </div>
          </CVisionCardBody>
        </CVisionCard>
      </CVisionTabContent>
    </CVisionPageLayout>
  );
}
